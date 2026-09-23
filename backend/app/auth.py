import os
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4
import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .database import session

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)
JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_MINUTES = int(os.environ.get("JWT_EXPIRES_MINUTES", "10080"))

class Credentials(BaseModel):
    # Login accepts syntactically valid reserved fixture domains such as
    # owner@taskflow.local. Registration remains strict via EmailStr below.
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_login_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        local, separator, domain = normalized.partition("@")
        if (
            not separator
            or not local
            or not domain
            or "." not in domain
            or any(character.isspace() for character in normalized)
        ):
            raise ValueError("Enter a valid email address.")
        return normalized

class Registration(Credentials):
    email: EmailStr
    display_name: str = Field(default="", max_length=120)

class ProfilePatch(BaseModel):
    displayName: str | None = Field(default=None, max_length=120)
    onboardingCompleted: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)

def token_for(user_id: UUID) -> str:
    if len(JWT_SECRET) < 32:
        raise HTTPException(status_code=503, detail="JWT_SECRET is not configured securely.")
    now = datetime.now(UTC)
    return jwt.encode({"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=JWT_MINUTES)}, JWT_SECRET, algorithm="HS256")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash or not password_hash.startswith(("$2a$", "$2b$", "$2y$")):
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (TypeError, ValueError):
        return False

async def current_user_id(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> UUID:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        return UUID(jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as error:
        raise HTTPException(status_code=401, detail="Invalid or expired session.") from error

async def user_payload(database: AsyncSession, user_id: UUID) -> dict:
    row = (await database.execute(text("select a.id,a.email,p.display_name from auth.users a left join public.users p on p.id=a.id where a.id=:id and a.deleted_at is null"), {"id": user_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=401, detail="Account no longer exists.")
    return {"id": str(row["id"]), "uid": str(row["id"]), "email": row["email"], "displayName": row["display_name"] or "", "onboardingRequired": False}

@router.post("/login")
async def login(values: Credentials, database: AsyncSession = Depends(session)):
    row = (await database.execute(text("select id,encrypted_password from auth.users where lower(email)=lower(:email) and deleted_at is null"), {"email": values.email})).mappings().first()
    valid = row and verify_password(values.password, row["encrypted_password"])
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"accessToken": token_for(row["id"]), "user": await user_payload(database, row["id"])}

@router.post("/register", status_code=201)
async def register(values: Registration, database: AsyncSession = Depends(session)):
    user_id = uuid4()
    password_hash = hash_password(values.password)
    try:
        await database.execute(text("insert into auth.users (id,email,encrypted_password,created_at,confirmed_at) values (:id,lower(:email),:password,now(),now())"), {"id": user_id, "email": values.email, "password": password_hash})
        await database.execute(text("insert into public.users (id,email,display_name) values (:id,lower(:email),nullif(:name,''))"), {"id": user_id, "email": values.email, "name": values.display_name.strip()})
        await database.commit()
    except Exception as error:
        await database.rollback()
        if "unique" in str(error).lower():
            raise HTTPException(status_code=409, detail="An account already exists for this email address.") from error
        raise
    return {"accessToken": token_for(user_id), "user": await user_payload(database, user_id)}

@router.get("/me")
async def me(user_id: UUID = Depends(current_user_id), database: AsyncSession = Depends(session)):
    return {"user": await user_payload(database, user_id)}

@router.post("/logout", status_code=204)
async def logout():
    return None

@router.patch("/me")
async def update_me(values: ProfilePatch, user_id: UUID=Depends(current_user_id), database: AsyncSession=Depends(session)):
    if values.displayName is not None:
        await database.execute(text("update public.users set display_name=nullif(btrim(:name),'') where id=:id"), {"name": values.displayName, "id": user_id})
    if values.password:
        hashed = hash_password(values.password)
        await database.execute(text("update auth.users set encrypted_password=:password where id=:id"), {"password": hashed, "id": user_id})
    await database.commit()
    return {"user": await user_payload(database, user_id)}

@router.delete("/me", status_code=204)
async def delete_me(user_id: UUID=Depends(current_user_id), database: AsyncSession=Depends(session)):
    await database.execute(text("delete from auth.users where id=:id"), {"id": user_id})
    await database.commit()
