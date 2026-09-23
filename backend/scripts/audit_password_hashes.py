"""Report imported password-hash health without exposing hashes or accounts."""

import os

import psycopg


with psycopg.connect(os.environ["SYNC_DATABASE_URL"]) as connection:
    with connection.cursor() as cursor:
        cursor.execute(
            """select
                 count(*) as total,
                 count(*) filter (where encrypted_password is null or encrypted_password = '') as missing,
                 count(*) filter (where encrypted_password like '$2a$%') as bcrypt_2a,
                 count(*) filter (where encrypted_password like '$2b$%') as bcrypt_2b,
                 count(*) filter (
                   where encrypted_password is not null
                     and encrypted_password <> ''
                     and encrypted_password not like '$2a$%'
                     and encrypted_password not like '$2b$%'
                 ) as unsupported
               from auth.users
               where deleted_at is null"""
        )
        total, missing, bcrypt_2a, bcrypt_2b, unsupported = cursor.fetchone()

print(f"Active users: {total}")
print(f"Missing hashes: {missing}")
print(f"bcrypt $2a$: {bcrypt_2a}")
print(f"bcrypt $2b$: {bcrypt_2b}")
print(f"Unsupported hashes: {unsupported}")
raise SystemExit(1 if missing or unsupported else 0)
