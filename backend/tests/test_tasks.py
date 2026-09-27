import pytest
from fastapi import HTTPException

from app.tasks import database_value, normalize_status


def test_database_value_normalizes_empty_form_fields() -> None:
    assert database_value("") is None
    assert database_value(None) is None
    assert database_value("todo") == "todo"
    assert database_value(False) is False


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("todo", "todo"),
        ("to do", "todo"),
        ("in-progress", "in_progress"),
        ("in progress", "in_progress"),
        ("completed", "done"),
        ("done", "done"),
    ],
)
def test_normalize_status_accepts_client_and_database_values(value, expected) -> None:
    assert normalize_status(value) == expected


def test_normalize_status_rejects_database_constraint_violations() -> None:
    with pytest.raises(HTTPException) as error:
        normalize_status("almost finished")
    assert error.value.status_code == 422
