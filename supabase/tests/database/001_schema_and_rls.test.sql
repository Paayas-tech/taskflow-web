begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;
do $$
declare
  pgtap_schema text;
begin
  select n.nspname
  into pgtap_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgtap';

  perform set_config('search_path', format('public,%I', pgtap_schema), true);
end;
$$;
select extensions.plan(56);

select extensions.ok(
  (
    select count(*) = 14
    from unnest(array[
      'users', 'projects', 'project_members', 'project_invitations',
      'project_columns', 'tasks', 'lists', 'task_list_placements',
      'task_assignments', 'task_comments', 'activity_events', 'project_documents',
      'user_settings', 'notifications'
    ]) as expected(table_name)
    where to_regclass('public.' || expected.table_name) is not null
  ),
  'all fourteen core tables exist'
);

select extensions.is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'users', 'projects', 'project_members', 'project_invitations',
        'project_columns', 'tasks', 'lists', 'task_list_placements',
        'task_assignments', 'task_comments', 'activity_events', 'project_documents',
        'user_settings', 'notifications'
      )
      and c.relrowsecurity
  ),
  14,
  'RLS is enabled on every core table'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner@taskflow.local","role":"authenticated"}',
  true
);

select extensions.is((select count(*)::integer from public.projects), 1, 'owner reads their project');
select extensions.is((select count(*)::integer from public.project_members), 3, 'owner reads the project roster');
select extensions.is((select count(*)::integer from public.tasks), 3, 'owner reads personal and member project tasks');
select extensions.is((select count(*)::integer from public.lists), 1, 'owner reads their personal lists');
select extensions.is((select count(*)::integer from public.project_invitations), 1, 'owner reads project invitations');
select extensions.is((select count(*)::integer from public.project_columns), 3, 'owner reads project columns');
select extensions.is((select count(*)::integer from public.task_comments), 1, 'owner reads project task comments');
select extensions.is((select count(*)::integer from public.activity_events), 1, 'owner reads project activity');
select extensions.is((select count(*)::integer from public.project_documents), 1, 'owner reads project documents');

select extensions.results_eq(
  $$
    insert into public.project_invitations (
      id, project_id, email, email_normalized, role, inviter_id, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000802',
      '00000000-0000-0000-0000-000000000201',
      'future-member@taskflow.local',
      'future-member@taskflow.local',
      'editor',
      '00000000-0000-0000-0000-000000000101',
      now() + interval '7 days'
    )
    returning id
  $$,
  $$ values ('00000000-0000-0000-0000-000000000802'::uuid) $$,
  'owner can create a pending editor invitation'
);
select extensions.results_eq(
  $$
    delete from public.project_invitations
    where id = '00000000-0000-0000-0000-000000000802'
    returning id
  $$,
  $$ values ('00000000-0000-0000-0000-000000000802'::uuid) $$,
  'owner can cancel a pending invitation'
);

select extensions.results_eq(
  $$
    insert into public.user_settings (
      user_id, theme, background, default_view, reminder_default_time,
      settings_data
    ) values (
      '00000000-0000-0000-0000-000000000101',
      'dark',
      'lavender',
      'today',
      30,
      '{"theme":{"mode":"dark"}}'::jsonb
    )
    returning user_id
  $$,
  $$ values ('00000000-0000-0000-0000-000000000101'::uuid) $$,
  'owner can create their settings row'
);
select extensions.is(
  (select count(*)::integer from public.user_settings),
  1,
  'owner reads their settings row'
);
select extensions.results_eq(
  $$
    update public.user_settings
    set theme = 'light'
    where user_id = '00000000-0000-0000-0000-000000000101'
    returning theme
  $$,
  $$ values ('light'::text) $$,
  'owner can update their settings row'
);

update public.tasks
set end_date = due_date,
    end_time = '17:00',
    reminder_enabled = true,
    reminder_at = now() + interval '1 hour'
where id = '00000000-0000-0000-0000-000000000401';
select extensions.ok(
  (
    select end_date = due_date
      and end_time = '17:00'::time
      and reminder_enabled
      and reminder_at is not null
    from public.tasks
    where id = '00000000-0000-0000-0000-000000000401'
  ),
  'personal task scheduling and reminder fields persist'
);
select extensions.throws_ok(
  $$
    update public.tasks
    set reminder_enabled = false
    where id = '00000000-0000-0000-0000-000000000401'
  $$,
  '23514',
  null,
  'task reminder state must remain internally consistent'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000102","email":"editor@taskflow.local","role":"authenticated"}',
  true
);

select extensions.is((select count(*)::integer from public.projects), 1, 'editor reads a member project');
select extensions.is((select count(*)::integer from public.project_members), 3, 'editor reads the project roster');
select extensions.is((select count(*)::integer from public.tasks), 2, 'editor reads project tasks but not owner personal tasks');
select extensions.is((select count(*)::integer from public.lists), 0, 'editor cannot read another user list');
select extensions.is((select count(*)::integer from public.project_invitations), 0, 'editor cannot read owner invitations');

select extensions.results_eq(
  $$
    update public.projects
    set description = 'Editor-updated description'
    where id = '00000000-0000-0000-0000-000000000201'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'editor cannot update owner-managed project metadata'
);

select extensions.results_eq(
  $$
    update public.projects
    set status = 'archived', archived_at = now()
    where id = '00000000-0000-0000-0000-000000000201'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'editor cannot archive a project'
);

select extensions.results_eq(
  $$
    update public.tasks
    set title = 'Editor updated assigned task'
    where id = '00000000-0000-0000-0000-000000000402'
    returning id
  $$,
  $$ values ('00000000-0000-0000-0000-000000000402'::uuid) $$,
  'an assignee can update an accessible project task'
);

select extensions.results_eq(
  $$
    insert into public.tasks (
      id, project_id, created_by, title, status, column_id, position
    ) values (
      '00000000-0000-0000-0000-000000000499',
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000102',
      'Editor-created collaboration task',
      'todo',
      '00000000-0000-0000-0000-000000000301',
      99
    ) returning id
  $$,
  $$ values ('00000000-0000-0000-0000-000000000499'::uuid) $$,
  'editor can create a project task'
);
select extensions.results_eq(
  $$
    delete from public.tasks
    where id = '00000000-0000-0000-0000-000000000499'
    returning id
  $$,
  $$ values ('00000000-0000-0000-0000-000000000499'::uuid) $$,
  'editor can delete a project task'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000103","email":"viewer@taskflow.local","role":"authenticated"}',
  true
);

select extensions.is((select count(*)::integer from public.projects), 1, 'viewer reads a member project');
select extensions.is((select count(*)::integer from public.tasks), 2, 'viewer reads project tasks');
select extensions.results_eq(
  $$
    update public.projects
    set description = 'Viewer must not update'
    where id = '00000000-0000-0000-0000-000000000201'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'viewer cannot update project metadata'
);
select extensions.results_eq(
  $$
    update public.tasks
    set title = 'Viewer must not update'
    where id = '00000000-0000-0000-0000-000000000402'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'unassigned viewer cannot update a task'
);
select extensions.throws_ok(
  $$
    insert into public.tasks (project_id, created_by, title, status)
    values (
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000103',
      'Viewer must not create',
      'todo'
    )
  $$,
  '42501',
  null,
  'viewer cannot create a project task'
);
select extensions.results_eq(
  $$
    delete from public.tasks
    where id = '00000000-0000-0000-0000-000000000402'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'viewer cannot delete a project task'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000104","email":"outsider@taskflow.local","role":"authenticated"}',
  true
);

select extensions.is((select count(*)::integer from public.projects), 0, 'unrelated user cannot read projects');
select extensions.is((select count(*)::integer from public.project_members), 0, 'unrelated user cannot read rosters');
select extensions.is((select count(*)::integer from public.tasks), 0, 'unrelated user cannot read tasks');
select extensions.is((select count(*)::integer from public.project_invitations), 1, 'invitee reads a pending invitation by JWT email');
select extensions.is((select count(*)::integer from public.user_settings), 0, 'unrelated user cannot read owner settings');

select extensions.throws_ok(
  $$
    insert into public.user_settings (user_id)
    values ('00000000-0000-0000-0000-000000000101')
  $$,
  '42501',
  null,
  'a user cannot create settings for another user'
);

select extensions.results_eq(
  $$
    update public.user_settings
    set theme = 'dark'
    where user_id = '00000000-0000-0000-0000-000000000101'
    returning user_id
  $$,
  $$ select null::uuid where false $$,
  'a user cannot update another user settings row'
);

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select extensions.is(
  (select count(*)::integer from public.user_settings),
  0,
  'unauthenticated users cannot read settings'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000104","email":"outsider@taskflow.local","role":"authenticated"}',
  true
);

select extensions.throws_ok(
  $$
    insert into public.tasks (created_by, title)
    values ('00000000-0000-0000-0000-000000000101', 'Impersonated task')
  $$,
  '42501',
  null,
  'a user cannot create a personal task for another creator'
);
select extensions.throws_ok(
  $$
    insert into public.project_invitations (
      project_id, email, email_normalized, role, inviter_id
    ) values (
      '00000000-0000-0000-0000-000000000201',
      'blocked@taskflow.local',
      'blocked@taskflow.local',
      'viewer',
      '00000000-0000-0000-0000-000000000104'
    )
  $$,
  '42501',
  null,
  'non-owner cannot create a project invitation'
);

select extensions.results_eq(
  $$
    update public.project_invitations
    set status = 'accepted',
        accepted_by = '00000000-0000-0000-0000-000000000104',
        accepted_at = now()
    where id = '00000000-0000-0000-0000-000000000801'
    returning id
  $$,
  $$ values ('00000000-0000-0000-0000-000000000801'::uuid) $$,
  'invitee can accept a pending invitation addressed to their JWT email'
);

select extensions.is(
  (
    select count(*)::integer
    from public.project_members
    where project_id = '00000000-0000-0000-0000-000000000201'
      and user_id = '00000000-0000-0000-0000-000000000104'
      and role = 'viewer'
  ),
  1,
  'accepting an invitation creates the matching project membership'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner@taskflow.local","role":"authenticated"}',
  true
);

update public.tasks
set status = 'done'
where id = '00000000-0000-0000-0000-000000000401';
select extensions.ok(
  (select completed_at is not null from public.tasks where id = '00000000-0000-0000-0000-000000000401'),
  'completion timestamp is populated when a task becomes done'
);

update public.tasks
set status = 'todo'
where id = '00000000-0000-0000-0000-000000000401';
select extensions.ok(
  (select completed_at is null from public.tasks where id = '00000000-0000-0000-0000-000000000401'),
  'completion timestamp is cleared when a task is reopened'
);

select extensions.is(
  (
    select count(*)::integer from public.project_members
    where project_id = '00000000-0000-0000-0000-000000000201'
      and user_id = '00000000-0000-0000-0000-000000000101'
      and role = 'owner'
  ),
  1,
  'project creation produced exactly one owner membership'
);

select extensions.results_eq(
  $$
    update public.project_members
    set role = 'editor'
    where project_id = '00000000-0000-0000-0000-000000000201'
      and user_id = '00000000-0000-0000-0000-000000000103'
    returning role
  $$,
  $$ values ('editor'::text) $$,
  'owner can change a member role'
);
select extensions.results_eq(
  $$
    delete from public.project_members
    where project_id = '00000000-0000-0000-0000-000000000201'
      and user_id = '00000000-0000-0000-0000-000000000103'
    returning user_id
  $$,
  $$ values ('00000000-0000-0000-0000-000000000103'::uuid) $$,
  'owner can remove a member'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000103","email":"viewer@taskflow.local","role":"authenticated"}',
  true
);
select extensions.is((select count(*)::integer from public.projects), 0, 'removed member immediately loses project access');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner@taskflow.local","role":"authenticated"}',
  true
);

select extensions.results_eq(
  $$
    select name
    from public.project_columns
    where project_id = '00000000-0000-0000-0000-000000000201'
    order by position
  $$,
  $$ values ('To do'::text), ('In progress'::text), ('Done'::text) $$,
  'Kanban columns retain deterministic position ordering'
);

select extensions.results_eq(
  $$
    delete from public.projects
    where id = '00000000-0000-0000-0000-000000000201'
    returning id
  $$,
  $$ values ('00000000-0000-0000-0000-000000000201'::uuid) $$,
  'owner can delete a project'
);

select extensions.is(
  (
    (select count(*) from public.project_members where project_id = '00000000-0000-0000-0000-000000000201')
    + (select count(*) from public.project_columns where project_id = '00000000-0000-0000-0000-000000000201')
    + (select count(*) from public.tasks where project_id = '00000000-0000-0000-0000-000000000201')
    + (select count(*) from public.project_documents where project_id = '00000000-0000-0000-0000-000000000201')
    + (select count(*) from public.project_invitations where project_id = '00000000-0000-0000-0000-000000000201')
    + (select count(*) from public.activity_events where project_id = '00000000-0000-0000-0000-000000000201')
  )::integer,
  0,
  'project deletion cascades through all project-owned records'
);

select extensions.is(
  (
    select count(*)::integer from public.tasks
    where id = '00000000-0000-0000-0000-000000000401'
  ),
  1,
  'project deletion does not remove a personal task'
);

select * from extensions.finish();
rollback;
