import jwt
from uuid import UUID
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
import app.auth as auth
from app.database import session
from app.main import app

USER = UUID(int=101)


class AuthDatabase:
    def __init__(self):
        self.version = 0
        self.password = auth.hash_password("InitialPass123!")
        self.deleted = False
        self.commit = AsyncMock()

    async def execute(self, statement, params):
        sql = str(statement)
        result = MagicMock()
        if "update auth.users" in sql:
            self.version += 1
            if "password" in params:
                self.password = params["password"]
        elif "select token_version" in sql:
            result.scalar_one_or_none.return_value = None if self.deleted else self.version
        elif "select id,encrypted_password" in sql:
            result.mappings.return_value.first.return_value = {
                "id": USER, "encrypted_password": self.password, "token_version": self.version}
        else:
            result.mappings.return_value.first.return_value = {
                "id": USER, "email": "owner@example.com", "display_name": "Owner"}
        return result


@pytest.fixture
def auth_client(monkeypatch):
    monkeypatch.setattr(auth, "JWT_SECRET", "test-only-secret-with-at-least-32-characters")
    db = AuthDatabase()
    async def database():
        yield db
    app.dependency_overrides[session] = database
    with TestClient(app) as client:
        yield client, db
    app.dependency_overrides.clear()


def login(client, password="InitialPass123!"):
    response = client.post("/api/auth/login", json={"email": "owner@example.com", "password": password})
    assert response.status_code == 200
    return response.json()["accessToken"]


def headers(token):
    return {"Authorization": "Bearer " + token}


def test_logout_revokes_every_previously_issued_token(auth_client):
    client, db = auth_client
    first, second = login(client), login(client)
    assert client.get("/api/auth/me", headers=headers(first)).status_code == 200
    assert client.post("/api/auth/logout", headers=headers(first)).status_code == 204
    assert db.version == 1
    for token in (first, second):
        assert client.get("/api/auth/me", headers=headers(token)).status_code == 401
    assert client.get("/api/auth/me", headers=headers(login(client))).status_code == 200


def test_password_change_revokes_old_tokens_and_new_login_works(auth_client):
    client, db = auth_client
    token = login(client)
    assert client.patch("/api/auth/me", headers=headers(token), json={"password": "ChangedPass123!"}).status_code == 200
    assert db.version == 1
    assert client.get("/api/auth/me", headers=headers(token)).status_code == 401
    assert client.post("/api/auth/login", json={"email": "owner@example.com", "password": "InitialPass123!"}).status_code == 401
    assert client.get("/api/auth/me", headers=headers(login(client, "ChangedPass123!"))).status_code == 200


def test_deleted_account_is_rejected(auth_client):
    client, db = auth_client
    token = login(client)
    db.deleted = True
    assert client.get("/api/auth/me", headers=headers(token)).status_code == 401


def test_legacy_token_without_version_is_rejected(auth_client):
    client, _ = auth_client
    claims = jwt.decode(login(client), auth.JWT_SECRET, algorithms=["HS256"])
    del claims["tv"]
    legacy = jwt.encode(claims, auth.JWT_SECRET, algorithm="HS256")
    assert client.get("/api/auth/me", headers=headers(legacy)).status_code == 401
