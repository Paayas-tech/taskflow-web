from uuid import UUID
from unittest.mock import AsyncMock
import copy
import json

import httpx
import pytest
from fastapi.testclient import TestClient

import app.main as main_module
from app.auth import current_user_id
from app.main import app


@pytest.fixture(autouse=True)
def isolate_chat_configuration(monkeypatch):
    monkeypatch.setattr(main_module, "CHAT_PROVIDER", "openai")
    yield
    app.dependency_overrides.clear()


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_chat_requires_auth_in_supabase_mode() -> None:
    with TestClient(app) as client:
        response = client.post("/api/chat", json={"message": "Hello", "messages": []})
    assert response.status_code in (401, 503)


def authenticated_client():
    app.dependency_overrides[current_user_id] = lambda: UUID("00000000-0000-0000-0000-000000000101")
    return TestClient(app)


def test_chat_explains_missing_server_key(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "OPENAI_API_KEY", "")
    with authenticated_client() as client:
        response = client.post("/api/chat", json={"message": "Hello", "messages": []})
    app.dependency_overrides.clear()
    assert response.status_code == 503
    assert "GROQ_API_KEY" in response.json()["detail"]


def test_chat_hides_rejected_key_details(monkeypatch) -> None:
    class InvalidKeyClient:
        async def post(self, *_args, **_kwargs):
            return httpx.Response(401, json={"error": {"message": "raw provider secret detail"}})

        async def aclose(self):
            return None

    monkeypatch.setattr(main_module, "OPENAI_API_KEY", "invalid")
    with authenticated_client() as client:
        client.app.state.http = InvalidKeyClient()
        response = client.post("/api/chat", json={"message": "Hello", "messages": []})
    app.dependency_overrides.clear()
    assert response.status_code == 503
    assert response.json()["detail"] == (
        "AI Assistant credentials are invalid or expired. "
        "Ask an administrator to update the server API key."
    )


def test_chat_returns_valid_provider_json(monkeypatch) -> None:
    class WorkingClient:
        async def post(self, *_args, **_kwargs):
            return httpx.Response(200, json={"choices": [{"message": {"content": "Ready."}}]})

        async def aclose(self):
            return None

    monkeypatch.setattr(main_module, "OPENAI_API_KEY", "configured")
    with authenticated_client() as client:
        client.app.state.http = WorkingClient()
        response = client.post("/api/chat", json={"message": "Hello", "messages": []})
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {"message": "Ready.", "actions": []}


def test_chat_accepts_groq_provider(monkeypatch) -> None:
    class WorkingClient:
        async def post(self, *_args, **_kwargs):
            return httpx.Response(200, json={"choices": [{"message": {"content": "Ready."}}]})

        async def aclose(self):
            pass

    monkeypatch.setattr(main_module, "CHAT_PROVIDER", "groq")
    monkeypatch.setattr(main_module, "OPENAI_API_KEY", "test-only")
    with authenticated_client() as client:
        client.app.state.http = WorkingClient()
        assert client.post("/api/chat", json={"message": "Hello"}).status_code == 200


class ScriptedProvider:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.requests = []

    async def post(self, *_args, **kwargs):
        self.requests.append(copy.deepcopy(kwargs["json"]))
        return next(self.responses)

    async def aclose(self):
        pass


def tool_completion(name, arguments):
    return httpx.Response(200, json={"choices": [{"message": {
        "content": None,
        "tool_calls": [{"id": "call_1", "type": "function", "function": {
            "name": name, "arguments": arguments,
        }}],
    }}]})


@pytest.mark.parametrize("name,result", [
    ("create_task", {"success": True, "task": {"id": "task-1", "title": "Ship release", "status": "todo"}}),
    ("list_tasks", {"success": True, "tasks": [{"id": "task-1", "title": "Ship release", "status": "todo"}]}),
])
def test_chat_executes_authenticated_tools(monkeypatch, name, result):
    executor = AsyncMock(return_value=result)
    monkeypatch.setattr(main_module, "execute_tool", executor)
    monkeypatch.setattr(main_module, "OPENAI_API_KEY", "test-only")
    provider = ScriptedProvider([
        tool_completion(name, '{"title":"Ship release"}' if name == "create_task" else '{}'),
        httpx.Response(200, json={"choices": [{"message": {"content": "Finished."}}]}),
    ])
    with authenticated_client() as client:
        client.app.state.http = provider
        response = client.post("/api/chat", json={"message": "Ship release"})
    assert response.status_code == 200
    assert response.json()["actions"] == [{"name": name, "status": "completed", "result": result}]
    assert executor.await_args.args[2] == UUID("00000000-0000-0000-0000-000000000101")
    messages = provider.requests[1]["messages"]
    assert messages[-2]["tool_calls"][0]["id"] == messages[-1]["tool_call_id"]
    assert json.loads(messages[-1]["content"]) == result


def test_chat_rejects_malformed_tool_arguments(monkeypatch):
    executor = AsyncMock()
    monkeypatch.setattr(main_module, "execute_tool", executor)
    monkeypatch.setattr(main_module, "OPENAI_API_KEY", "test-only")
    provider = ScriptedProvider([
        tool_completion("create_task", '{broken'),
        httpx.Response(200, json={"choices": [{"message": {"content": "Invalid parameters."}}]}),
    ])
    with authenticated_client() as client:
        client.app.state.http = provider
        response = client.post("/api/chat", json={"message": "Create a task"})
    assert response.status_code == 200
    assert response.json()["actions"][0]["status"] == "failed"
    executor.assert_not_awaited()


def test_chat_preserves_committed_action_when_followup_rate_limited(monkeypatch):
    executor = AsyncMock(return_value={"success": True, "task": {
        "id": "task-1", "title": "Ship release", "status": "todo",
    }})
    monkeypatch.setattr(main_module, "execute_tool", executor)
    monkeypatch.setattr(main_module, "OPENAI_API_KEY", "test-only")
    provider = ScriptedProvider([
        tool_completion("create_task", '{"title":"Ship release"}'),
        httpx.Response(429, json={"error": {"message": "Rate limited"}}),
    ])
    with authenticated_client() as client:
        client.app.state.http = provider
        response = client.post("/api/chat", json={"message": "Create Ship release"})
    assert response.status_code == 200
    assert response.json()["message"] == 'Created task "Ship release".'
    assert response.json()["actions"][0]["status"] == "completed"
    executor.assert_awaited_once()
