from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .auth import current_user_id
from .common import record, require_project, require_task
from .database import session

router=APIRouter(prefix="/api/tasks",tags=["tasks"])
FIELDS={"title":"title","description":"description","notes":"notes","priority":"priority","status":"status","workType":"work_type","storyId":"story_id","columnId":"column_id","position":"position","dueDate":"due_date","startDate":"start_date","startTime":"start_time","endDate":"end_date","endTime":"end_time","reminder":"reminder_enabled","reminderAt":"reminder_at","completedAt":"completed_at","archivedAt":"archived_at","parentTaskId":"parent_task_id"}

class TaskBody(BaseModel):
    id: UUID|None=None; projectId: UUID|None=None; title:str; description:str=""; notes:str=""
    priority:str|None="medium"; status:str="todo"; workType:str="task"; storyId:UUID|None=None
    columnId:UUID|None=None; position:int|None=None; dueDate:str|None=None; startDate:str|None=None
    startTime:str|None=None; endDate:str|None=None; endTime:str|None=None; reminder:bool=False
    reminderAt:str|None=None; parentTaskId:UUID|None=None

def task_dict(row):
    result=record(row); assignee=result.pop("assignee_id",None); assigned_at=result.pop("assigned_at",None); result["task_assignments"]={"user_id":assignee,"assigned_at":assigned_at} if assignee else None
    return result

async def query_tasks(db,user,where="true",params=None,order="t.created_at desc"):
    params={**(params or {}),"u":user}; rows=(await db.execute(text(f"""select t.*,a.user_id assignee_id,a.assigned_at from tasks t left join task_assignments a on a.task_id=t.id left join projects p on p.id=t.project_id left join project_members m on m.project_id=t.project_id and m.user_id=:u where ({where}) and ((t.project_id is null and t.created_by=:u) or p.owner_id=:u or m.user_id=:u) order by {order}"""),params)).mappings().all(); return [task_dict(r) for r in rows]

@router.get("")
async def list_tasks(projectId:UUID|None=None,assignedTo:UUID|None=None,personal:bool=False,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    if projectId: return await query_tasks(db,user,"t.project_id=:p",{"p":projectId},"t.position nulls last,t.created_at desc")
    if assignedTo: return await query_tasks(db,user,"a.user_id=:a",{"a":assignedTo},"t.due_date nulls last")
    if personal: return await query_tasks(db,user,"t.project_id is null")
    return await query_tasks(db,user)

@router.post("",status_code=201)
async def create(body:TaskBody,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    if body.projectId: await require_project(db,body.projectId,user,True)
    values=body.model_dump(); tid=values.pop("id") or uuid4(); params={"id":tid,"created":user,"project":values.pop("projectId")}
    cols=[]; binds=[]
    for key,col in FIELDS.items():
        if key in values: cols.append(col); binds.append(f":{key}"); params[key]=values[key]
    await db.execute(text(f"insert into tasks(id,created_by,project_id,{','.join(cols)}) values(:id,:created,:project,{','.join(binds)})"),params); await db.commit(); row=await require_task(db,tid,user); return task_dict(row)

@router.patch("/{task_id}")
async def update(task_id:UUID,body:dict,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    await require_task(db,task_id,user,True); sets=[]; params={"id":task_id}
    for key,col in FIELDS.items():
        if key in body: sets.append(f"{col}=:{key}"); params[key]=body[key] if body[key]!="" else None
    if "dueDate" in body: sets.append("start_date=:dueDate")
    if not sets: return task_dict(await require_task(db,task_id,user))
    await db.execute(text("update tasks set "+",".join(sets)+" where id=:id"),params); await db.commit(); return task_dict(await require_task(db,task_id,user))

@router.delete("/{task_id}",status_code=204)
async def delete(task_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    await require_task(db,task_id,user,True); await db.execute(text("delete from tasks where id=:id"),{"id":task_id}); await db.commit()

@router.post("/reorder",status_code=204)
async def reorder(items:list[dict],user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    for item in items:
        tid=UUID(str(item["taskId"])); await require_task(db,tid,user,True)
        await db.execute(text("update tasks set column_id=:c,position=:p,status=:s,completed_at=:d where id=:id"),{"id":tid,"c":item.get("columnId"),"p":max(0,int(item.get("position",0))),"s":item.get("status","todo"),"d":item.get("completedAt")})
    await db.commit()

@router.put("/{task_id}/assignee",status_code=204)
async def assign(task_id:UUID,body:dict,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    task=await require_task(db,task_id,user,True); assignee=body.get("userId")
    await db.execute(text("delete from task_assignments where task_id=:id"),{"id":task_id})
    if assignee:
        member=(await db.execute(text("select 1 from project_members where project_id=:p and user_id=:u"),{"p":task["project_id"],"u":assignee})).first()
        if not member: raise HTTPException(422,"Assignee must be a project member.")
        await db.execute(text("insert into task_assignments(task_id,user_id) values(:t,:u)"),{"t":task_id,"u":assignee})
    await db.commit()
