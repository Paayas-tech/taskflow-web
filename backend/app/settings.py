import json
from uuid import UUID
from fastapi import APIRouter,Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .auth import current_user_id
from .database import session
router=APIRouter(prefix="/api/settings",tags=["settings"])
@router.get("")
async def get(user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 row=(await db.execute(text("select settings_data from user_settings where user_id=:u"),{"u":user})).mappings().first(); return row["settings_data"] if row else {}
@router.put("")
async def put(body:dict,user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 await db.execute(text("insert into user_settings(user_id,settings_data) values(:u,cast(:s as jsonb)) on conflict(user_id) do update set settings_data=excluded.settings_data"),{"u":user,"s":json.dumps(body)}); await db.commit(); return body
