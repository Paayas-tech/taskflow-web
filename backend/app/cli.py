"""Administrative commands for the self-hosted TaskFlow backend."""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from collections.abc import Sequence

import psycopg

from .auth import hash_password


def _validated_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must contain at least 8 characters.")
    if len(value) > 128:
        raise ValueError("Password must contain no more than 128 characters.")
    return value


def _prompt_for_password() -> str:
    password = getpass.getpass("New password: ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        raise ValueError("Passwords do not match.")
    return _validated_password(password)


def reset_password(connection: psycopg.Connection, email: str, password: str):
    """Update an active account and return its id and normalized email."""
    normalized_email = email.strip().lower()
    if not normalized_email:
        raise ValueError("Email is required.")

    with connection.cursor() as cursor:
        cursor.execute(
            """update auth.users
               set encrypted_password = %s
               where lower(email) = lower(%s) and deleted_at is null
               returning id, email""",
            (hash_password(_validated_password(password)), normalized_email),
        )
        row = cursor.fetchone()

    if row is None:
        connection.rollback()
        return None

    connection.commit()
    return row


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="TaskFlow administration commands.")
    commands = parser.add_subparsers(dest="command", required=True)
    reset = commands.add_parser(
        "reset-password",
        help="Set the password for an existing active account.",
    )
    reset.add_argument("email", help="Existing account email")
    reset.add_argument(
        "new_password",
        nargs="?",
        help="New password (omit this argument for a hidden prompt)",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command != "reset-password":
        return 2

    try:
        password = (
            _validated_password(args.new_password)
            if args.new_password is not None
            else _prompt_for_password()
        )
        database_url = os.environ.get("SYNC_DATABASE_URL")
        if not database_url:
            raise RuntimeError("SYNC_DATABASE_URL is not configured.")

        with psycopg.connect(database_url) as connection:
            row = reset_password(connection, args.email, password)
    except (ValueError, RuntimeError, psycopg.Error) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2

    if row is None:
        print(f'Error: no active user exists with email "{args.email.strip()}".', file=sys.stderr)
        return 1

    user_id, email = row
    print(f"Password updated successfully for user {user_id} ({email}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
