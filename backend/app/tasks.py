import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import current_user_id
from .common import record, require_project, require_task
from .database import session
from .email import APP_URL, send_task_assignment_safely

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

FIELDS = {
    "title": "title", "description": "description", "notes": "notes",
    "priority": "priority", "status": "status", "workType": "work_type",
    "storyId": "story_id", "columnId": "column_id", "position": "position",
    "dueDate": "due_date", "startDate": "start_date", "startTime": "start_time",
    "endDate": "end_date", "endTime": "end_time", "reminder": "reminder_enabled",
    "reminderAt": "reminder_at", "completedAt": "completed_at",
    "archivedAt": "archived_at", "parentTaskId": "parent_task_id",
}

STATUS_ALIASES = {
    "todo": "todo", "to do": "todo", "backlog": "todo",
    "in_progress": "in_progress", "in-progress": "in_progress",
    "in progress": "in_progress", "working": "in_progress",
    "done": "done", "completed": "done", "complete": "done",
}


def database_value(value: Any) -> Any:
    """Translate empty optional form fields into SQL NULL values."""
    return None if value == "" else value


def normalize_status(value: Any) -> str:
    normalized = STATUS_ALIASES.get(str(value or "").strip().lower())
    if not normalized:
        raise HTTPException(status_code=422, detail="Status must be todo, in_progress, or done.")
    return normalized


class TaskBody(BaseModel):
    id: UUID | None = None
    projectId: UUID | None = None
    title: str
    description: str = ""
    notes: str = ""
    priority: str | None = "medium"
    status: str = "todo"
    workType: str = "task"
    storyId: UUID | None = None
    columnId: UUID | None = None
    position: int | None = None
    dueDate: str | None = None
    startDate: str | None = None
    startTime: str | None = None
    endDate: str | None = None
    endTime: str | None = None
    reminder: bool = False
    reminderAt: str | None = None
    parentTaskId: UUID | None = None


class ReorderItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    taskId: UUID
    columnId: UUID | None = None
    position: int = Field(default=0, ge=0)
    status: str = "todo"
    completedAt: str | None = None


def task_dict(row):
    result = record(row)
    assignee = result.pop("assignee_id", None)
    assigned_at = result.pop("assigned_at", None)
    result["task_assignments"] = (
        {"user_id": assignee, "assigned_at": assigned_at} if assignee else None
    )
    return result


async def query_tasks(db, user, where="true", params=None, order="t.created_at desc", limit=None):
    params = {**(params or {}), "u": user}
    limit_sql = ""
    if limit is not None:
        params["row_limit"] = max(1, min(int(limit), 100))
        limit_sql = "limit :row_limit"
    rows = (await db.execute(text(f"""
        select t.*,a.user_id assignee_id,a.assigned_at
        from tasks t
        left join task_assignments a on a.task_id=t.id
        left join projects p on p.id=t.project_id
        left join project_members m on m.project_id=t.project_id and m.user_id=:u
        where ({where}) and ((t.project_id is null and t.created_by=:u)
          or p.owner_id=:u or m.user_id=:u)
        order by {order}
        {limit_sql}
    """), params)).mappings().all()
    return [task_dict(row) for row in rows]


async def validate_column(db: AsyncSession, task, column_id: UUID | None):
    if column_id is None:
        return None
    if task["project_id"] is None:
        raise HTTPException(status_code=422, detail="Personal tasks cannot be placed in a project column.")
    column = (await db.execute(
        text("select id,category from project_columns where id=:column and project_id=:project"),
        {"column": column_id, "project": task["project_id"]},
    )).mappings().first()
    if not column:
        raise HTTPException(status_code=422, detail="The selected board column does not belong to this project.")
    return column


async def table_exists(db: AsyncSession, table_name: str) -> bool:
    return bool((await db.execute(
        text("select to_regclass(:table_name)"),
        {"table_name": f"public.{table_name}"},
    )).scalar_one_or_none())


@router.get("")
async def list_tasks(projectId: UUID | None = None, assignedTo: UUID | None = None,
                     personal: bool = False, mine: bool = False, user: UUID = Depends(current_user_id),
                     db: AsyncSession = Depends(session)):
    if projectId:
        return await query_tasks(db, user, "t.project_id=:p", {"p": projectId}, "t.position nulls last,t.created_at desc")
    if assignedTo:
        return await query_tasks(db, user, "a.user_id=:a", {"a": assignedTo}, "t.due_date nulls last")
    if personal:
        return await query_tasks(db, user, "t.project_id is null")
    if mine:
        return await query_tasks(db, user,
            "t.archived_at is null and ((t.project_id is null and t.created_by=:u) or a.user_id=:u)",
            order="t.completed_at desc nulls last,t.due_date nulls last,t.created_at desc")
    return await query_tasks(db, user)


@router.post("", status_code=201)
async def create(body: TaskBody, user: UUID = Depends(current_user_id),
                 db: AsyncSession = Depends(session)):
    if body.projectId:
        await require_project(db, body.projectId, user, True)
    values = body.model_dump()
    values["status"] = normalize_status(values["status"])
    task_id = values.pop("id") or uuid4()
    params = {"id": task_id, "created": user, "project": values.pop("projectId")}
    columns, binds = [], []
    for key, column in FIELDS.items():
        if key in values:
            columns.append(column)
            binds.append(f":{key}")
            params[key] = database_value(values[key])
    await db.execute(text(
        f"insert into tasks(id,created_by,project_id,{','.join(columns)}) "
        f"values(:id,:created,:project,{','.join(binds)})"
    ), params)
    await db.commit()
    return task_dict(await require_task(db, task_id, user))


@router.patch("/{task_id}")
async def update(task_id: UUID, body: dict, user: UUID = Depends(current_user_id),
                 db: AsyncSession = Depends(session)):
    task = await require_task(db, task_id, user, True)
    sets, params = [], {"id": task_id}
    # Accept the canonical database spelling emitted by the REST client while
    # preserving compatibility with older camel-case clients.
    if "completed_at" in body:
        body["completedAt"] = body.pop("completed_at")
    if "status" in body:
        body["status"] = normalize_status(body["status"])
        body["completedAt"] = (
            body.get("completedAt") or datetime.now(timezone.utc).isoformat()
            if body["status"] == "done" else None
        )
        # Mobile and drawer clients may submit only a status. Keep the stored
        # Kanban column aligned so a reload cannot put a completed task in To Do.
        if task["project_id"] and "columnId" not in body:
            target_column = (await db.execute(text(
                "select id from project_columns where project_id=:project and category=:status "
                "order by position,id limit 1"
            ), {"project": task["project_id"], "status": body["status"]})).scalar_one_or_none()
            body["columnId"] = target_column
    column = await validate_column(db, task, body.get("columnId")) if "columnId" in body else None
    if column and column["category"] != "custom" and "status" in body:
        if column["category"] != body["status"]:
            raise HTTPException(status_code=422, detail="Task status does not match the selected board column.")
    for key, column_name in FIELDS.items():
        if key in body:
            sets.append(f"{column_name}=:{key}")
            params[key] = database_value(body[key])
    if "dueDate" in body and "startDate" not in body:
        sets.append("start_date=:dueDate")
    if not sets:
        return task_dict(task)
    await db.execute(text("update tasks set " + ",".join(sets) + " where id=:id"), params)
    await db.commit()
    return task_dict(await require_task(db, task_id, user))


@router.delete("/{task_id}")
async def delete(task_id: UUID, user: UUID = Depends(current_user_id),
                 db: AsyncSession = Depends(session)):
    await require_task(db, task_id, user, True)
    attachment_paths: list[str] = []
    if await table_exists(db, "attachments"):
        attachment_paths = list((await db.execute(text(
            "delete from attachments where entity_id=:id and entity_type in ('task','story') "
            "returning storage_path"
        ), {"id": task_id})).scalars().all())

    cleanup = {
        "task_dependencies": "delete from task_dependencies where task_id=:id or depends_on_task_id=:id",
        "task_attachments": "delete from task_attachments where task_id=:id",
        "task_activities": "delete from task_activities where task_id=:id",
        "task_comments": "delete from task_comments where task_id=:id",
        "activity_events": "delete from activity_events where task_id=:id",
        "notifications": "delete from notifications where task_id=:id",
        "task_assignments": "delete from task_assignments where task_id=:id",
        "task_list_placements": "delete from task_list_placements where task_id=:id",
        "story_tasks": "delete from story_tasks where task_id=:id or story_id=:id",
    }
    for table_name, statement in cleanup.items():
        if await table_exists(db, table_name):
            await db.execute(text(statement), {"id": task_id})
    await db.execute(text("update tasks set parent_task_id=null where parent_task_id=:id"), {"id": task_id})
    await db.execute(text("update tasks set story_id=null where story_id=:id"), {"id": task_id})
    await db.execute(text("delete from tasks where id=:id"), {"id": task_id})
    await db.commit()

    upload_root = Path(os.getenv("UPLOAD_DIR", "/data/uploads")).resolve()
    for relative_path in attachment_paths:
        target = (upload_root / relative_path).resolve()
        if upload_root in target.parents:
            target.unlink(missing_ok=True)
    return {"success": True, "id": str(task_id)}


@router.post("/reorder")
async def reorder(items: list[ReorderItem], user: UUID = Depends(current_user_id),
                  db: AsyncSession = Depends(session)):
    updated_ids: list[UUID] = []
    for item in items:
        task = await require_task(db, item.taskId, user, True)
        status = normalize_status(item.status)
        column = await validate_column(db, task, item.columnId)
        if column and column["category"] != "custom" and column["category"] != status:
            raise HTTPException(status_code=422, detail="Task status does not match the selected board column.")
        completed_at = (
            item.completedAt or datetime.now(timezone.utc).isoformat()
            if status == "done" else None
        )
        await db.execute(text(
            "update tasks set column_id=:column,position=:position,status=:status,"
            "completed_at=:completed where id=:id"
        ), {"id": item.taskId, "column": item.columnId, "position": item.position,
             "status": status, "completed": completed_at})
        updated_ids.append(item.taskId)
    await db.commit()
    return [task_dict(await require_task(db, task_id, user)) for task_id in updated_ids]


@router.put("/{task_id}/assignee", status_code=204)
async def assign(task_id: UUID, body: dict, background_tasks: BackgroundTasks,
                 user: UUID = Depends(current_user_id),
                 db: AsyncSession = Depends(session)):
    task = await require_task(db, task_id, user, True)
    assignee = body.get("userId")
    await db.execute(text("delete from task_assignments where task_id=:id"), {"id": task_id})
    if assignee:
        member = (await db.execute(text(
            "select 1 from project_members where project_id=:project and user_id=:user"
        ), {"project": task["project_id"], "user": assignee})).first()
        if not member:
            raise HTTPException(status_code=422, detail="Assignee must be a project member.")
        await db.execute(text(
            "insert into task_assignments(task_id,user_id) values(:task,:user)"
        ), {"task": task_id, "user": assignee})
        recipient = (await db.execute(text(
            "select a.email,p.name project_name from auth.users a "
            "join projects p on p.id=:project "
            "where a.id=:user and a.deleted_at is null"
        ), {"project": task["project_id"], "user": assignee})).mappings().first()
        if recipient:
            background_tasks.add_task(
                send_task_assignment_safely,
                recipient["email"],
                task_title=task["title"],
                project_name=recipient["project_name"],
                task_url=f"{APP_URL}/projects/{task['project_id']}/board?task={task_id}",
            )
    await db.commit()
