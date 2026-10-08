"""Small, authenticated task tools shared by the model orchestration route."""
import logging
from typing import Literal
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import text

from .common import require_project
from .tasks import TaskBody, create, query_tasks

logger = logging.getLogger(__name__)


class Scope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    projectId: UUID | None = None
    projectName: str | None = Field(default=None, min_length=1, max_length=200)


class CreateTask(Scope):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(default="", max_length=4000)
    priority: Literal["low", "medium", "high"] = "medium"


class ListTasks(Scope):
    taskTitle: str | None = Field(default=None, min_length=1, max_length=500)
    status: Literal["todo", "in_progress", "done"] | None = None
    limit: int = Field(default=15, ge=1, le=15)


MODELS = {"create_task": CreateTask, "list_tasks": ListTasks}
TOOLS = [{"type": "function", "function": {
    "name": name,
    "description": description,
    "parameters": MODELS[name].model_json_schema(),
}} for name, description in [
    ("create_task", "Create a personal task, or a task in an accessible project. Use projectName when named by the user."),
    ("list_tasks", "Retrieve accessible, non-archived tasks, optionally by project, title, or status."),
]]


def literal_pattern(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def resolve_project(scope, context_project, user, db):
    if scope.projectId:
        await require_project(db, scope.projectId, user)
        return scope.projectId
    if scope.projectName:
        name = scope.projectName.strip()
        if not name:
            raise HTTPException(422, "Specify a project name.")
        rows = (await db.execute(text("""
            select p.id,p.name from projects p
            where p.archived_at is null and p.name ilike :name
              and (p.owner_id=:user or exists (select 1 from project_members m
                where m.project_id=p.id and m.user_id=:user))
            order by (lower(p.name)=lower(:exact)) desc,p.name limit 3
        """), {"name": "%" + literal_pattern(name) + "%", "exact": name, "user": user})).mappings().all()
        exact = [row for row in rows if row["name"].casefold() == name.casefold()]
        matches = exact if len(exact) == 1 else rows
        if len(matches) != 1:
            raise HTTPException(422, "Project not found or ambiguous. Specify an exact accessible project name.")
        return matches[0]["id"]
    if context_project:
        try:
            project = UUID(context_project)
        except ValueError as error:
            raise HTTPException(422, "Invalid project context.") from error
        await require_project(db, project, user)
        return project
    return None


def compact_task(row):
    return {key: row.get(key) for key in ("id", "title", "status", "project_id")}


async def execute_tool(name, arguments, user, db, context_project=None):
    if name not in MODELS:
        return {"success": False, "error": "Unsupported task tool."}
    try:
        values = MODELS[name].model_validate(arguments)
        project = await resolve_project(values, context_project, user, db)
        if name == "create_task":
            title = values.title.strip()
            if not title:
                raise HTTPException(422, "Task title cannot be blank.")
            task = await create(TaskBody(title=title, description=values.description,
                priority=values.priority, projectId=project), user=user, db=db)
            return {"success": True, "task": compact_task(task)}
        where, params = ["t.archived_at is null"], {}
        if project:
            where.append("t.project_id=:project")
            params["project"] = project
        if values.taskTitle:
            where.append("t.title ilike :title")
            params["title"] = "%" + literal_pattern(values.taskTitle.strip()) + "%"
        if values.status:
            where.append("t.status=:status")
            params["status"] = values.status
        rows = await query_tasks(db, user, " and ".join(where), params,
                                 order="t.updated_at desc,t.id", limit=values.limit)
        return {"success": True, "tasks": [compact_task(row) for row in rows]}
    except ValidationError:
        return {"success": False, "error": "Invalid task parameters. Check title, project, priority, status, and limit."}
    except HTTPException as error:
        return {"success": False, "error": str(error.detail)}
    except Exception:
        await db.rollback()
        logger.exception("Task tool execution failed: %s", name)
        return {"success": False, "error": "The task action could not be saved or loaded. Please try again."}
