from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .auth import current_user_id
from .common import record,require_project,require_task
from .database import session
router=APIRouter(prefix="/api",tags=["collaboration"])
class CommentBody(BaseModel): content:str

@router.get("/tasks/{task_id}/comments")
async def comments(task_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 await require_task(db,task_id,user); rows=(await db.execute(text("select c.*,u.display_name,u.avatar_url from task_comments c join users u on u.id=c.user_id where task_id=:t order by c.created_at"),{"t":task_id})).mappings().all(); return [record(r) for r in rows]
@router.post("/tasks/{task_id}/comments",status_code=201)
async def add_comment(task_id:UUID,body:CommentBody,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 await require_task(db,task_id,user); row=(await db.execute(text("insert into task_comments(task_id,user_id,content) values(:t,:u,:c) returning *"),{"t":task_id,"u":user,"c":body.content.strip()})).mappings().first(); await db.commit(); return record(row)
@router.patch("/comments/{comment_id}")
async def edit_comment(comment_id:UUID,body:CommentBody,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 row=(await db.execute(text("update task_comments set content=:c,edited_at=now() where id=:id and user_id=:u returning *"),{"c":body.content.strip(),"id":comment_id,"u":user})).mappings().first(); await db.commit()
 if not row: raise HTTPException(404,"Comment not found.")
 return record(row)
@router.delete("/comments/{comment_id}",status_code=204)
async def del_comment(comment_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 await db.execute(text("delete from task_comments where id=:id and user_id=:u"),{"id":comment_id,"u":user}); await db.commit()
@router.get("/activity")
async def activity(projectId:UUID|None=None,taskId:UUID|None=None,limit:int=50,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 if projectId: await require_project(db,projectId,user); clause="e.project_id=:v"; value=projectId
 elif taskId: await require_task(db,taskId,user); clause="e.task_id=:v"; value=taskId
 else: raise HTTPException(422,"A project or task is required.")
 rows=(await db.execute(text(f"select e.*,u.display_name,u.avatar_url from activity_events e left join users u on u.id=e.user_id where {clause} order by e.created_at desc limit :lim"),{"v":value,"lim":min(limit,100)})).mappings().all(); return [record(r) for r in rows]
@router.get("/notifications")
async def notifications(limit:int=100,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 rows=(await db.execute(text("select * from notifications where user_id=:u order by created_at desc limit :l"),{"u":user,"l":min(limit,100)})).mappings().all(); return [record(r) for r in rows]
@router.patch("/notifications/{notification_id}")
async def read(notification_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 row=(await db.execute(text("update notifications set read_at=now() where id=:id and user_id=:u returning *"),{"id":notification_id,"u":user})).mappings().first(); await db.commit()
 if not row: raise HTTPException(404,"Notification not found.")
 return record(row)
@router.post("/notifications/read-all",status_code=204)
async def read_all(user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 await db.execute(text("update notifications set read_at=now() where user_id=:u and read_at is null"),{"u":user}); await db.commit()
@router.delete("/notifications/{notification_id}",status_code=204)
async def del_notice(notification_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 await db.execute(text("delete from notifications where id=:id and user_id=:u"),{"id":notification_id,"u":user}); await db.commit()
