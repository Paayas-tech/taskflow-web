import os,re
from pathlib import Path
from uuid import UUID,uuid4
from fastapi import APIRouter,Depends,File,Form,HTTPException,UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .auth import current_user_id
from .common import record,require_project
from .database import session
router=APIRouter(prefix="/api/attachments",tags=["attachments"])
ROOT=Path(os.getenv("UPLOAD_DIR","/data/uploads")).resolve(); MAX=10*1024*1024
def safe(name): return re.sub(r"[^A-Za-z0-9._-]","_",Path(name).name)[:200] or "file"
@router.get("")
async def list_files(projectId:UUID,entityType:str|None=None,entityId:UUID|None=None,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 await require_project(db,projectId,user); clauses=["a.project_id=:p"]; params={"p":projectId}
 if entityType: clauses.append("a.entity_type=:t");params["t"]=entityType
 if entityId: clauses.append("a.entity_id=:e");params["e"]=entityId
 # Some restored installations predate the attachments migration. Treat that
 # exactly like an empty attachment list rather than breaking every task drawer.
 if not (await db.execute(text("select to_regclass('public.attachments')"))).scalar_one_or_none():
  return []
 rows=(await db.execute(text("select a.*,u.display_name,u.avatar_url from attachments a left join users u on u.id=a.uploaded_by where "+" and ".join(clauses)+" order by a.created_at desc"),params)).mappings().all(); return [record(r) for r in rows]
@router.post("",status_code=201)
async def upload(projectId:UUID=Form(),entityType:str=Form(),entityId:UUID=Form(),file:UploadFile=File(),user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 await require_project(db,projectId,user,True); payload=await file.read(MAX+1)
 if not payload or len(payload)>MAX: raise HTTPException(413,"Attachment must be between 1 byte and 10 MB.")
 aid=uuid4(); filename=safe(file.filename or "file"); relative=f"projects/{projectId}/{entityType}/{entityId}/{aid}-{filename}"; target=(ROOT/relative).resolve()
 if ROOT not in target.parents: raise HTTPException(400,"Invalid filename.")
 target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(payload)
 try:
  row=(await db.execute(text("insert into attachments(id,project_id,entity_type,entity_id,storage_path,file_name,content_type,size_bytes,uploaded_by) values(:id,:p,:t,:e,:s,:f,:c,:z,:u) returning *"),{"id":aid,"p":projectId,"t":entityType,"e":entityId,"s":relative,"f":file.filename,"c":file.content_type or "application/octet-stream","z":len(payload),"u":user})).mappings().first(); await db.commit(); return record(row)
 except Exception: target.unlink(missing_ok=True); raise
@router.get("/{attachment_id}/content")
async def content(attachment_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 row=(await db.execute(text("select * from attachments where id=:id"),{"id":attachment_id})).mappings().first()
 if not row: raise HTTPException(404,"Attachment not found.")
 await require_project(db,row["project_id"],user); return FileResponse(ROOT/row["storage_path"],filename=row["file_name"],media_type=row["content_type"])
@router.delete("/{attachment_id}",status_code=204)
async def remove(attachment_id:UUID,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 row=(await db.execute(text("select * from attachments where id=:id"),{"id":attachment_id})).mappings().first()
 if not row: raise HTTPException(404,"Attachment not found.")
 await require_project(db,row["project_id"],user,True); await db.execute(text("delete from attachments where id=:id"),{"id":attachment_id}); await db.commit(); (ROOT/row["storage_path"]).unlink(missing_ok=True)
