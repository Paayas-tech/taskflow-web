from uuid import UUID

import httpx
from fastapi.testclient import TestClient

import app.main as main_module
from app.auth import current_user_id
from app.main import app


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
