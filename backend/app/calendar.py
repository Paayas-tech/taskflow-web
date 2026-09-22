from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .auth import current_user_id
from .common import record
from .database import session
router=APIRouter(prefix="/api/calendar",tags=["calendar"])
@router.get("/google")
async def connection(user:UUID=Depends(current_user_id),db:AsyncSession=Depends(session)):
 try:
  row=(await db.execute(text("select id,provider,calendar_account_email,scopes,last_synced_at,sync_status,sync_error,created_at,updated_at from user_calendar_connections where user_id=:u and provider='google'"),{"u":user})).mappings().first(); return record(row) if row else None
 except Exception: await db.rollback(); return None
def unavailable(): raise HTTPException(501,"Google Calendar is not configured for this TaskFlow environment yet.")
@router.post("/google/connect")
async def connect(_user:UUID=Depends(current_user_id)): return unavailable()
@router.post("/google/sync")
async def sync(_user:UUID=Depends(current_user_id)): return unavailable()
@router.delete("/google")
async def disconnect(_user:UUID=Depends(current_user_id)): return unavailable()
