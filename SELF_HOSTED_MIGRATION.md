# Supabase to self-hosted PostgreSQL cutover

This migration is intentionally performed before the frontend is switched. Keep
the hosted Supabase project available until the final verification succeeds.

## Prepare secrets

In `backend/.env`, generate independent secrets and URL-encode the database
password inside both database URLs:

```bash
openssl rand -base64 36
openssl rand -hex 48
```

Set `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`,
`SYNC_DATABASE_URL`, and `JWT_SECRET`. Never commit this file.

## Create PostgreSQL and restore the dump

Run only for a new, empty `postgres_data` volume:

```bash
docker compose up -d postgres
docker compose ps
docker compose exec -T postgres pg_isready -U taskflow -d taskflow

docker compose build api
docker compose run --rm \
  -v /home/deploy/migration/supabase-export:/migration:ro \
  -e AUTH_USERS_CSV=/migration/auth_users.csv \
  api python scripts/import_auth_users.py

docker compose exec -T postgres pg_restore \
  -U taskflow -d taskflow --no-owner --no-acl --exit-on-error \
  < /home/deploy/migration/supabase-export/public.dump
```

Verify counts without exposing account data:

```bash
docker compose exec -T postgres psql -U taskflow -d taskflow -c \
  'select (select count(*) from auth.users) auth_users,
          (select count(*) from public.users) profiles,
          (select count(*) from public.projects) projects,
          (select count(*) from public.tasks) tasks;'
```

Do not run `docker compose down -v`; it deletes the PostgreSQL volume.

## Audit and smoke-test imported authentication

The login endpoint reads `auth.users.encrypted_password` and verifies Supabase
`$2a$`/`$2b$` bcrypt hashes directly. Check the imported hash inventory without
printing addresses or hashes:

```bash
docker compose run --rm api python scripts/audit_password_hashes.py
```

For a disposable fixture account only, set a known password with the same
hashing helper used by registration and password changes:

```bash
docker compose run --rm api python scripts/reset_user_password.py \
  --email owner@taskflow.local
```

Then verify both login and authenticated `/api/auth/me` access:

```bash
docker compose run --rm --network host api python scripts/smoke_auth.py \
  --email owner@taskflow.local
```

On Docker installations where host networking is unavailable, run the helper
inside the active API container instead:

```bash
docker compose exec api python scripts/smoke_auth.py \
  --base-url http://127.0.0.1:8000 \
  --email owner@taskflow.local
```
