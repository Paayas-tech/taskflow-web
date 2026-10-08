import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

from app.tasks import list_tasks, update


def test_my_tasks_include_personal_and_assigned_project_tasks():
    user = UUID("00000000-0000-0000-0000-000000000101")
    with patch("app.tasks.query_tasks", new_callable=AsyncMock) as query:
        query.return_value = [{"id": "assigned-task"}]
        result = asyncio.run(list_tasks(projectId=None, assignedTo=None,
            personal=False, mine=True, user=user, db=object()))
        assert result == [{"id": "assigned-task"}]
        where = query.call_args.args[2]
        assert "t.archived_at is null" in where
        assert "t.project_id is null and t.created_by=:u" in where
        assert "a.user_id=:u" in where


def test_personal_only_contract_remains_unchanged():
    with patch("app.tasks.query_tasks", new_callable=AsyncMock) as query:
        query.return_value = []
        asyncio.run(list_tasks(projectId=None, assignedTo=None,
            personal=True, mine=False, user=UUID(int=1), db=object()))
        assert query.call_args.args[2] == "t.project_id is null"


def test_status_only_update_moves_to_matching_project_column():
    task_id, project_id, column_id = UUID(int=1), UUID(int=2), UUID(int=3)
    column_result = MagicMock()
    column_result.scalar_one_or_none.return_value = column_id
    db = MagicMock()
    db.execute = AsyncMock(side_effect=[column_result, MagicMock()])
    db.commit = AsyncMock()
    with patch("app.tasks.require_task", new_callable=AsyncMock) as require, \
         patch("app.tasks.validate_column", new_callable=AsyncMock) as validate:
        require.return_value = {"id": task_id, "project_id": project_id}
        validate.return_value = {"id": column_id, "category": "done"}
        asyncio.run(update(task_id, {"status": "done"}, user=UUID(int=4), db=db))
        params = db.execute.call_args_list[-1].args[1]
        assert params["columnId"] == column_id
        assert params["status"] == "done"
        assert params["completedAt"]
