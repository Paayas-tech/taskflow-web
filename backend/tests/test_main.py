from fastapi.testclient import TestClient

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
