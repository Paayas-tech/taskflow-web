from uuid import UUID, uuid4
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .auth import current_user_id
from .common import record, require_project
from .database import session
from .email import send_project_invitation_safely

router = APIRouter(prefix="/api/projects", tags=["projects"])

class ProjectBody(BaseModel):
    id: UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    color: str = ""
    dueDate: str | None = None

class ProjectPatch(BaseModel):
    name: str | None = None; description: str | None = None; color: str | None = None
    dueDate: str | None = None; status: str | None = None; healthStatus: str | None = None

class InviteBody(BaseModel):
    email: EmailStr; role: str = "viewer"; projectName: str | None = None

@router.get("")
async def list_projects(user: UUID = Depends(current_user_id), db: AsyncSession = Depends(session)):
    rows=(await db.execute(text("""select p.*, case when p.owner_id=:u then 'owner' else pm.role end viewer_role
      from projects p left join project_members pm on pm.project_id=p.id and pm.user_id=:u
      where p.owner_id=:u or pm.user_id=:u order by p.created_at"""),{"u":user})).mappings().all()
    return [record(r) for r in rows]

@router.post("", status_code=201)
async def create_project(body: ProjectBody, user: UUID=Depends(current_user_id), db: AsyncSession=Depends(session)):
    pid=body.id or uuid4()
    await db.execute(text("insert into projects(id,owner_id,name,description,color,due_date) values(:id,:u,:n,:d,:c,:due)"),{"id":pid,"u":user,"n":body.name.strip(),"d":body.description,"c":body.color,"due":body.dueDate or None})
    await db.execute(text("insert into project_members(project_id,user_id,role,added_by) values(:p,:u,'owner',:u) on conflict do nothing"),{"p":pid,"u":user})
    await db.execute(text("insert into project_columns(project_id,name,category,position,is_terminal) values (:p,'To Do','todo',0,false),(:p,'In Progress','in_progress',1,false),(:p,'Done','done',2,true)"),{"p":pid})
    await db.commit(); return record(await require_project(db,pid,user))

@router.patch("/{project_id}")
async def update_project(project_id: UUID, body: ProjectPatch, user: UUID=Depends(current_user_id), db: AsyncSession=Depends(session)):
    await require_project(db,project_id,user,True); values=body.model_dump(exclude_unset=True)
    mapping={"name":"name","description":"description","color":"color","dueDate":"due_date","healthStatus":"health_status"}
    sets=[]; params={"id":project_id}
    for key,col in mapping.items():
        if key in values: sets.append(f"{col}=:{key}"); params[key]=values[key] or None
    if "status" in values:
        params["status"]=values["status"]; sets += ["status=:status", "archived_at=case when :status='archived' then now() else null end"]
    if sets: await db.execute(text("update projects set "+", ".join(sets)+" where id=:id"),params); await db.commit()
    return record(await require_project(db,project_id,user))

@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    row=await require_project(db,project_id,user,True)
    if row["viewer_role"]!="owner": raise HTTPException(403,"Only the owner can delete a project.")
    await db.execute(text("delete from projects where id=:id"),{"id":project_id}); await db.commit()

@router.get("/all/columns")
async def all_columns(user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    rows=(await db.execute(text("select c.* from project_columns c join projects p on p.id=c.project_id left join project_members m on m.project_id=p.id and m.user_id=:u where p.owner_id=:u or m.user_id=:u order by c.position"),{"u":user})).mappings().all(); return [record(r) for r in rows]

@router.get("/{project_id}/columns")
async def columns(project_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    await require_project(db,project_id,user); rows=(await db.execute(text("select * from project_columns where project_id=:p order by position"),{"p":project_id})).mappings().all(); return [record(r) for r in rows]

@router.get("/all/members")
async def all_members(user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    rows=(await db.execute(text("select m.*,u.display_name,u.avatar_url from project_members m join projects p on p.id=m.project_id join users u on u.id=m.user_id left join project_members mine on mine.project_id=p.id and mine.user_id=:u where p.owner_id=:u or mine.user_id=:u order by m.joined_at"),{"u":user})).mappings().all(); return [record(r) for r in rows]

@router.get("/{project_id}/members")
async def members(project_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    await require_project(db,project_id,user); rows=(await db.execute(text("select m.*,u.display_name,u.avatar_url from project_members m join users u on u.id=m.user_id where m.project_id=:p order by m.joined_at"),{"p":project_id})).mappings().all(); return [record(r) for r in rows]

@router.patch("/{project_id}/members/{member_id}")
async def member_role(project_id:UUID,member_id:UUID,body:dict,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    await require_project(db,project_id,user,True); role=body.get("role")
    if role not in ("editor","viewer"): raise HTTPException(422,"Invalid role.")
    row=(await db.execute(text("update project_members set role=:r where project_id=:p and user_id=:u and role<>'owner' returning *"),{"r":role,"p":project_id,"u":member_id})).mappings().first(); await db.commit()
    if not row: raise HTTPException(404,"Member not found.")
    return record(row)

@router.delete("/{project_id}/members/{member_id}",status_code=204)
async def remove_member(project_id:UUID,member_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    await require_project(db,project_id,user,True); await db.execute(text("delete from project_members where project_id=:p and user_id=:u and role<>'owner'"),{"p":project_id,"u":member_id}); await db.commit()

@router.get("/{project_id}/invitations")
async def invitations(project_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    await require_project(db,project_id,user); rows=(await db.execute(text("select i.*,u.display_name inviter_display_name from project_invitations i left join users u on u.id=i.inviter_id where project_id=:p order by i.created_at desc"),{"p":project_id})).mappings().all(); return [record(r) for r in rows]

@router.get("/invitations/mine")
async def my_invites(user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    rows=(await db.execute(text("select i.*,p.name project_name,p.color project_color,u.display_name inviter_display_name from project_invitations i join auth.users a on a.id=:u join projects p on p.id=i.project_id left join users u on u.id=i.inviter_id where i.email_normalized=lower(a.email) and i.status='pending' order by i.created_at desc"),{"u":user})).mappings().all(); return [record(r) for r in rows]

@router.post("/{project_id}/invitations",status_code=201)
async def invite(project_id:UUID,body:InviteBody,background_tasks:BackgroundTasks,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    project=await require_project(db,project_id,user,True); role=body.role.lower()
    if role not in ("editor","viewer"): raise HTTPException(422,"Invalid role.")
    recipient=str(body.email).lower()
    inviter=(await db.execute(text("select coalesce(nullif(display_name,''),email) as name from users where id=:u"),{"u":user})).mappings().first()
    row=(await db.execute(text("insert into project_invitations(project_id,email,email_normalized,role,inviter_id,expires_at) values(:p,:e,lower(:e),:r,:u,now()+interval '7 days') returning *"),{"p":project_id,"e":recipient,"r":role,"u":user})).mappings().first(); await db.commit()
    background_tasks.add_task(
        send_project_invitation_safely,
        recipient,
        project_name=body.projectName or project["name"],
        inviter_name=(inviter or {}).get("name") or "A TaskFlow teammate",
        role=role,
    )
    return record(row)

@router.patch("/invitations/{invite_id}")
async def respond(invite_id:UUID,body:dict,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    status=body.get("status");
    if status not in ("accepted","declined"): raise HTTPException(422,"Invalid response.")
    row=(await db.execute(text("""update project_invitations i set status=:s,accepted_by=case when :s='accepted' then :u end,accepted_at=case when :s='accepted' then now() end from auth.users a where i.id=:id and i.status='pending' and a.id=:u and i.email_normalized=lower(a.email) returning i.*"""),{"s":status,"u":user,"id":invite_id})).mappings().first()
    if not row: raise HTTPException(404,"Invitation not found.")
    if status=="accepted": await db.execute(text("insert into project_members(project_id,user_id,role,added_by) values(:p,:u,:r,:by) on conflict do nothing"),{"p":row["project_id"],"u":user,"r":row["role"],"by":row["inviter_id"]})
    await db.commit(); return record(row)

@router.delete("/{project_id}/invitations/{invite_id}",status_code=204)
async def cancel(project_id:UUID,invite_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
    await require_project(db,project_id,user,True); await db.execute(text("delete from project_invitations where id=:id and project_id=:p"),{"id":invite_id,"p":project_id}); await db.commit()
