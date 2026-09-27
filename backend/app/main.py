import json
import os
from contextlib import asynccontextmanager
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from .auth import current_user_id, router as auth_router
from .attachments import router as attachments_router
from .calendar import router as calendar_router
from .collaboration import router as collaboration_router
from .projects import router as projects_router
from .settings import router as settings_router
from .tasks import router as tasks_router

load_dotenv()


def csv_setting(name: str, default: str = "") -> list[str]:
    return [value.strip().rstrip("/") for value in os.getenv(name, default).split(",") if value.strip()]


ALLOWED_ORIGINS = csv_setting(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,https://taskflow.bohaus.in",
)
CHAT_PROVIDER = os.getenv("CHAT_PROVIDER", "openai").strip().lower()
OPENAI_API_KEY = (
    os.getenv("GROQ_API_KEY", "").strip()
    or os.getenv("OPENAI_API_KEY", "").strip()
)
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.groq.com/openai/v1").strip().rstrip("/")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "openai/gpt-oss-20b").strip()


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    message: str = Field(min_length=1, max_length=4000)
    messages: list[ChatMessage] = Field(default_factory=list, max_length=12)
    project_id: str | None = Field(default=None, alias="projectId", max_length=128)
    workspace_id: str | None = Field(default=None, alias="workspaceId", max_length=128)


class ChatResponse(BaseModel):
    message: str
    actions: list[dict] = Field(default_factory=list)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
    yield
    await app.state.http.aclose()


app = FastAPI(
    title="TaskFlow API",
    version="1.0.0",
    docs_url=None if os.getenv("ENVIRONMENT", "production") == "production" else "/docs",
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(collaboration_router)
app.include_router(settings_router)
app.include_router(attachments_router)
app.include_router(calendar_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


async def call_openai_compatible(
    request: Request,
    body: ChatRequest,
) -> ChatResponse:
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI Assistant is not configured on this server. "
                "Ask an administrator to add GROQ_API_KEY or OPENAI_API_KEY."
            ),
        )
    messages = [message.model_dump() for message in body.messages[-8:]]
    if not messages or messages[-1].get("content") != body.message.strip():
        messages.append({"role": "user", "content": body.message.strip()})
    response = await request.app.state.http.post(
        f"{OPENAI_BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        json={"model": OPENAI_MODEL, "messages": messages, "max_tokens": 400},
    )
    try:
        payload = response.json()
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail="The model provider returned invalid JSON.") from error
    if response.is_error:
        if response.status_code in (401, 403):
            raise HTTPException(
                status_code=503,
                detail=(
                    "AI Assistant credentials are invalid or expired. "
                    "Ask an administrator to update the server API key."
                ),
            )
        if response.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="AI Assistant is temporarily busy. Please wait a moment and try again.",
            )
        raise HTTPException(
            status_code=502,
            detail="AI Assistant could not complete that request. Please try again later.",
        )
    try:
        message = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise HTTPException(status_code=502, detail="The model provider returned an invalid completion.") from error
    return ChatResponse(message=str(message), actions=[])


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    body: ChatRequest,
    _user_id=Depends(current_user_id),
) -> ChatResponse:
    try:
        if CHAT_PROVIDER == "openai":
            return await call_openai_compatible(request, body)
        raise HTTPException(status_code=503, detail="CHAT_PROVIDER must be 'openai'.")
    except httpx.TimeoutException as error:
        raise HTTPException(status_code=504, detail="The upstream agent timed out.") from error
    except httpx.RequestError as error:
        raise HTTPException(status_code=502, detail="The upstream agent is unavailable.") from error
