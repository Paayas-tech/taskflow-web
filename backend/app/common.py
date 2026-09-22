from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def json_value(value):
    if isinstance(value, (UUID, date, datetime, time, Decimal)):
        return str(value)
    return value


def record(row) -> dict:
    return {key: json_value(value) for key, value in dict(row).items()}


async def require_project(database: AsyncSession, project_id: UUID, user_id: UUID, edit=False):
    row = (await database.execute(text("""
      select p.*, case when p.owner_id=:user then 'owner' else pm.role end as viewer_role
      from public.projects p left join public.project_members pm
        on pm.project_id=p.id and pm.user_id=:user
      where p.id=:project and (p.owner_id=:user or pm.user_id=:user)
    """), {"project": project_id, "user": user_id})).mappings().first()
    if not row:
        raise HTTPException(404, "Project not found.")
    if edit and row["viewer_role"] not in ("owner", "editor"):
        raise HTTPException(403, "Editor access is required.")
    return row


async def require_task(database: AsyncSession, task_id: UUID, user_id: UUID, edit=False):
    row = (await database.execute(text("""
      select t.*, case when t.project_id is null then 'owner'
        when p.owner_id=:user then 'owner' else pm.role end as viewer_role
      from public.tasks t
      left join public.projects p on p.id=t.project_id
      left join public.project_members pm on pm.project_id=t.project_id and pm.user_id=:user
      where t.id=:task and ((t.project_id is null and t.created_by=:user)
        or p.owner_id=:user or pm.user_id=:user)
    """), {"task": task_id, "user": user_id})).mappings().first()
    if not row:
        raise HTTPException(404, "Task not found.")
    if edit and row["viewer_role"] not in ("owner", "editor"):
        raise HTTPException(403, "Editor access is required.")
    return row
