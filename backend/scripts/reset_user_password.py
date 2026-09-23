"""Set one existing user's password using TaskFlow's production bcrypt helper."""

import argparse
import getpass
import os
import sys

import psycopg

from app.auth import hash_password


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reset one existing TaskFlow account password."
    )
    parser.add_argument("--email", required=True, help="Exact existing account email")
    args = parser.parse_args()
    email = args.email.strip().lower()
    password = getpass.getpass("New password: ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        print("Passwords do not match.", file=sys.stderr)
        return 2
    if len(password) < 8:
        print("Password must contain at least 8 characters.", file=sys.stderr)
        return 2

    with psycopg.connect(os.environ["SYNC_DATABASE_URL"]) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """update auth.users
                   set encrypted_password = %s
                   where lower(email) = lower(%s) and deleted_at is null
                   returning id""",
                (hash_password(password), email),
            )
            row = cursor.fetchone()
            if not row:
                print("No active account matched that email.", file=sys.stderr)
                return 1
        connection.commit()

    print(f"Password updated for {email}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
