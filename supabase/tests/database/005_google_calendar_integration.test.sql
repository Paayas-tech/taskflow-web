begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;
select extensions.plan(9);

select extensions.has_table('public', 'user_calendar_connections', 'calendar connection metadata table exists');
select extensions.has_table('private', 'user_calendar_tokens', 'calendar tokens use a private table');
select extensions.has_table('private', 'google_calendar_oauth_states', 'OAuth state uses a private table');
select extensions.has_function('public', 'store_google_calendar_oauth_state', array['text', 'uuid', 'text', 'timestamp with time zone'], 'server-only OAuth state writer exists');
select extensions.has_function('public', 'consume_google_calendar_oauth_state', array['text'], 'server-only OAuth state consumer exists');
select extensions.has_function('public', 'store_google_calendar_credentials', array['uuid', 'text', 'text[]', 'text', 'text', 'timestamp with time zone'], 'atomic credential writer exists');
select extensions.ok(not has_table_privilege('authenticated', 'private.user_calendar_tokens', 'select'), 'authenticated users cannot read token storage');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner@taskflow.local","role":"authenticated"}', true);
insert into public.user_calendar_connections (user_id, provider, calendar_account_email)
values ('00000000-0000-0000-0000-000000000101', 'google', 'owner@example.com');
select extensions.is((select count(*)::integer from public.user_calendar_connections), 1, 'a user can read their own connection metadata');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","email":"editor@taskflow.local","role":"authenticated"}', true);
select extensions.is((select count(*)::integer from public.user_calendar_connections), 0, 'a user cannot read another user connection');

select * from extensions.finish();
rollback;
