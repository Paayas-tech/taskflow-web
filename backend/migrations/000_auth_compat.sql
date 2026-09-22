create extension if not exists pgcrypto;
create schema if not exists auth;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create table if not exists auth.users (
  id uuid primary key,
  email text unique not null,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  deleted_at timestamptz
);
create index if not exists auth_users_email_lower_idx on auth.users (lower(email));

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$;
