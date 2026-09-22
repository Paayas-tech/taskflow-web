import csv
import os
import psycopg

with psycopg.connect(os.environ["SYNC_DATABASE_URL"]) as connection, connection.cursor() as cursor, open(os.environ.get("AUTH_USERS_CSV", "/migration/auth_users.csv"), newline="", encoding="utf-8") as handle:
    for row in csv.DictReader(handle):
        cursor.execute("""insert into auth.users (id,email,encrypted_password,raw_user_meta_data,created_at,confirmed_at,last_sign_in_at)
          values (%s,%s,%s,%s::jsonb,%s,nullif(%s,'')::timestamptz,nullif(%s,'')::timestamptz)
          on conflict (id) do update set email=excluded.email,encrypted_password=excluded.encrypted_password,raw_user_meta_data=excluded.raw_user_meta_data""",
          (row["id"],row["email"],row["encrypted_password"],row["raw_user_meta_data"] or "{}",row["created_at"],row["confirmed_at"],row["last_sign_in_at"]))
    connection.commit()
