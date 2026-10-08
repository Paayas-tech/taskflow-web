import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

from app.agent_tools import execute_tool

USER, PROJECT = UUID(int=1), UUID(int=2)


def test_task_creation_uses_authenticated_user_and_standard_route():
    with patch("app.agent_tools.create", new_callable=AsyncMock) as create:
        create.return_value = {"id": "task", "title": "Backup", "status": "todo", "project_id": None, "notes": "large data"}
        result = asyncio.run(execute_tool("create_task", {"title": " Backup "}, USER, object()))
        assert result["success"]
        assert result["task"] == {"id": "task", "title": "Backup", "status": "todo", "project_id": None}
        assert create.call_args.kwargs["user"] == USER
        assert create.call_args.args[0].title == "Backup"


def test_retrieval_is_scoped_to_authenticated_user_and_bounded():
    with patch("app.agent_tools.query_tasks", new_callable=AsyncMock) as query:
        query.return_value = []
        result = asyncio.run(execute_tool("list_tasks", {"taskTitle": "100%", "limit": 3}, USER, object()))
        assert result == {"success": True, "tasks": []}
        assert query.call_args.args[1] == USER
        assert query.call_args.kwargs["limit"] == 3
        assert query.call_args.args[3]["title"] == "%100\\%%"


def test_foreign_project_is_denied_before_task_creation():
    from fastapi import HTTPException
    with patch("app.agent_tools.require_project", new_callable=AsyncMock) as require, \
         patch("app.agent_tools.create", new_callable=AsyncMock) as create:
        require.side_effect = HTTPException(404, "Project not found.")
        result = asyncio.run(execute_tool("create_task", {"title": "Secret", "projectId": str(PROJECT)}, USER, object()))
        assert not result["success"]
        create.assert_not_awaited()


def test_invalid_parameters_cannot_override_identity():
    result = asyncio.run(execute_tool("create_task", {"title": "Task", "userId": "attacker"}, USER, object()))
    assert not result["success"]


def test_invalid_priority_and_limit_are_rejected():
    for name, arguments in [("create_task", {"title": "Task", "priority": "urgent"}), ("list_tasks", {"limit": 1000})]:
        assert not asyncio.run(execute_tool(name, arguments, USER, object()))["success"]
