import json
import os
from contextlib import asynccontextmanager
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

load_dotenv()


def csv_setting(name: str, default: str = "") -> list[str]:
    return [value.strip().rstrip("/") for value in os.getenv(name, default).split(",") if value.strip()]


ALLOWED_ORIGINS = csv_setting(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,https://taskflow.bohaus.in",
)
CHAT_PROVIDER = os.getenv("CHAT_PROVIDER", "supabase").strip().lower()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
SUPABASE_AGENT_FUNCTION = os.getenv("SUPABASE_AGENT_FUNCTION", "agent-chat").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
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
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def bearer_token(authorization: str | None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="A valid bearer token is required.")
    return token.strip()


async def call_supabase_agent(request: Request, body: ChatRequest, authorization: str | None) -> ChatResponse:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="The Supabase agent gateway is not configured.")
    token = bearer_token(authorization)
    response = await request.app.state.http.post(
        f"{SUPABASE_URL}/functions/v1/{SUPABASE_AGENT_FUNCTION}",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        json=body.model_dump(by_alias=True),
    )
    try:
        payload = response.json()
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail="The agent returned an invalid response.") from error
    if response.is_error:
        detail = payload.get("message") or payload.get("error") or "The agent request failed."
        raise HTTPException(status_code=response.status_code, detail=str(detail))
    message = payload.get("message") or payload.get("reply") or payload.get("content")
    if not isinstance(message, str):
        raise HTTPException(status_code=502, detail="The agent response did not contain a message.")
    actions = payload.get("actions")
    return ChatResponse(message=message, actions=actions if isinstance(actions, list) else [])


async def validate_supabase_user(request: Request, authorization: str | None) -> None:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured.")
    token = bearer_token(authorization)
    response = await request.app.state.http.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
    )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired.")


async def call_openai_compatible(
    request: Request,
    body: ChatRequest,
    authorization: str | None,
) -> ChatResponse:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="The model provider is not configured.")
    await validate_supabase_user(request, authorization)
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
        provider_error = payload.get("error", {})
        detail = provider_error.get("message") if isinstance(provider_error, dict) else provider_error
        raise HTTPException(status_code=502, detail=str(detail or "The model provider rejected the request."))
    try:
        message = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise HTTPException(status_code=502, detail="The model provider returned an invalid completion.") from error
    return ChatResponse(message=str(message), actions=[])


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    body: ChatRequest,
    authorization: str | None = Header(default=None),
) -> ChatResponse:
    try:
        if CHAT_PROVIDER == "supabase":
            return await call_supabase_agent(request, body, authorization)
        if CHAT_PROVIDER == "openai":
            return await call_openai_compatible(request, body, authorization)
        raise HTTPException(status_code=503, detail="CHAT_PROVIDER must be 'supabase' or 'openai'.")
    except httpx.TimeoutException as error:
        raise HTTPException(status_code=504, detail="The upstream agent timed out.") from error
    except httpx.RequestError as error:
        raise HTTPException(status_code=502, detail="The upstream agent is unavailable.") from error
