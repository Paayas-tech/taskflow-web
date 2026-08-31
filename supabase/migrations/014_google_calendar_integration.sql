-- Google Calendar connection metadata is safe for the signed-in user to read.
-- OAuth tokens are kept in the private schema and are only accessed by Edge
-- Functions with the service-role key.

create table if not exists public.user_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  calendar_account_email text,
  scopes text[] not null default '{}'::text[],
  last_synced_at timestamptz,
  sync_status text not null default 'idle'
    check (sync_status in ('idle', 'syncing', 'success', 'error')),
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider),
  constraint calendar_account_email_not_blank
    check (calendar_account_email is null or btrim(calendar_account_email) <> '')
);

create index if not exists idx_user_calendar_connections_user
  on public.user_calendar_connections(user_id);

drop trigger if exists user_calendar_connections_set_updated_at
  on public.user_calendar_connections;
create trigger user_calendar_connections_set_updated_at
before update on public.user_calendar_connections
for each row execute function public.set_updated_at();

alter table public.user_calendar_connections enable row level security;

grant select, insert, update, delete
  on public.user_calendar_connections to authenticated;

drop policy if exists user_calendar_connections_select_own
  on public.user_calendar_connections;
create policy user_calendar_connections_select_own
on public.user_calendar_connections for select to authenticated
using (user_id = auth.uid());

drop policy if exists user_calendar_connections_insert_own
  on public.user_calendar_connections;
create policy user_calendar_connections_insert_own
on public.user_calendar_connections for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists user_calendar_connections_update_own
  on public.user_calendar_connections;
create policy user_calendar_connections_update_own
on public.user_calendar_connections for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_calendar_connections_delete_own
  on public.user_calendar_connections;
create policy user_calendar_connections_delete_own
on public.user_calendar_connections for delete to authenticated
using (user_id = auth.uid());

create schema if not exists private;
revoke all on schema private from public, anon;

create table if not exists private.user_calendar_tokens (
  connection_id uuid primary key
    references public.user_calendar_connections(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on private.user_calendar_tokens from public, anon, authenticated;

create table if not exists private.google_calendar_oauth_states (
  state_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  code_verifier_ciphertext text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_google_calendar_oauth_states_expiry
  on private.google_calendar_oauth_states(expires_at);

revoke all on private.google_calendar_oauth_states
  from public, anon, authenticated;

-- The private schema is intentionally not exposed through PostgREST. These
-- narrowly scoped SECURITY DEFINER functions are the only Data API bridge used
-- by authenticated Edge Functions running with the service role.
create or replace function public.store_google_calendar_oauth_state(
  p_state_hash text,
  p_user_id uuid,
  p_code_verifier_ciphertext text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.google_calendar_oauth_states
  where user_id = p_user_id or expires_at <= now();

  insert into private.google_calendar_oauth_states (
    state_hash, user_id, code_verifier_ciphertext, expires_at
  ) values (
    p_state_hash, p_user_id, p_code_verifier_ciphertext, p_expires_at
  );
end;
$$;

create or replace function public.consume_google_calendar_oauth_state(
  p_state_hash text
)
returns table (
  user_id uuid,
  code_verifier_ciphertext text,
  expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  delete from private.google_calendar_oauth_states
  where state_hash = p_state_hash
  returning user_id, code_verifier_ciphertext, expires_at;
$$;

create or replace function public.store_google_calendar_credentials(
  p_user_id uuid,
  p_calendar_account_email text,
  p_scopes text[],
  p_access_token_ciphertext text,
  p_refresh_token_ciphertext text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection_id uuid;
begin
  insert into public.user_calendar_connections (
    user_id, provider, calendar_account_email, scopes, sync_status, sync_error
  ) values (
    p_user_id, 'google', nullif(btrim(p_calendar_account_email), ''),
    coalesce(p_scopes, '{}'::text[]), 'idle', null
  )
  on conflict (user_id, provider) do update set
    calendar_account_email = excluded.calendar_account_email,
    scopes = excluded.scopes,
    sync_status = 'idle',
    sync_error = null,
    updated_at = now()
  returning id into v_connection_id;

  insert into private.user_calendar_tokens (
    connection_id, access_token_ciphertext, refresh_token_ciphertext,
    expires_at, updated_at
  ) values (
    v_connection_id, p_access_token_ciphertext,
    p_refresh_token_ciphertext, p_expires_at, now()
  )
  on conflict (connection_id) do update set
    access_token_ciphertext = excluded.access_token_ciphertext,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    expires_at = excluded.expires_at,
    updated_at = now();

  return v_connection_id;
end;
$$;

create or replace function public.get_google_calendar_tokens(
  p_connection_id uuid
)
returns table (
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  expires_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select access_token_ciphertext, refresh_token_ciphertext, expires_at
  from private.user_calendar_tokens
  where connection_id = p_connection_id;
$$;

create or replace function public.update_google_calendar_access_token(
  p_connection_id uuid,
  p_access_token_ciphertext text,
  p_expires_at timestamptz
)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.user_calendar_tokens
  set access_token_ciphertext = p_access_token_ciphertext,
      expires_at = p_expires_at,
      updated_at = now()
  where connection_id = p_connection_id;
$$;

revoke all on function public.store_google_calendar_oauth_state(text, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.consume_google_calendar_oauth_state(text)
  from public, anon, authenticated;
revoke all on function public.store_google_calendar_credentials(uuid, text, text[], text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_google_calendar_tokens(uuid)
  from public, anon, authenticated;
revoke all on function public.update_google_calendar_access_token(uuid, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.store_google_calendar_oauth_state(text, uuid, text, timestamptz)
  to service_role;
grant execute on function public.consume_google_calendar_oauth_state(text)
  to service_role;
grant execute on function public.store_google_calendar_credentials(uuid, text, text[], text, text, timestamptz)
  to service_role;
grant execute on function public.get_google_calendar_tokens(uuid)
  to service_role;
grant execute on function public.update_google_calendar_access_token(uuid, text, timestamptz)
  to service_role;
