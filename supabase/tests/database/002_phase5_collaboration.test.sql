begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;
do $$
declare pgtap_schema text;
begin
  select n.nspname into pgtap_schema
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgtap';
  perform set_config('search_path', format('public,%I', pgtap_schema), true);
end;
$$;
select extensions.plan(31);

select extensions.has_table('public', 'notifications', 'notifications table exists');
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass),
  'notifications have RLS enabled'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner@taskflow.local","role":"authenticated"}', true);

select extensions.lives_ok(
  $$ select public.set_task_assignee('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000103') $$,
  'owner can assign a project task to a viewer member'
);
select extensions.lives_ok(
  $$ select public.set_task_assignee('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000102') $$,
  'owner can replace the single assignee'
);
select extensions.is(
  (select count(*)::integer from public.task_assignments where task_id = '00000000-0000-0000-0000-000000000402' and user_id = '00000000-0000-0000-0000-000000000102'),
  1,
  'a task retains exactly the selected assignee'
);
select extensions.throws_ok(
  $$ select public.set_task_assignee('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000104') $$,
  'P0001',
  'Assignee must be a project member',
  'a non-member cannot be assigned'
);
select extensions.results_eq(
  $$ insert into public.task_comments (task_id, user_id, content) values ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000101', 'Owner comment') returning user_id $$,
  $$ values ('00000000-0000-0000-0000-000000000101'::uuid) $$,
  'owner can add a task comment'
);
select extensions.results_eq(
  $$ insert into public.task_comments (task_id, user_id, content) values ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000101', 'Hello @00000000-0000-0000-0000-000000000103') returning user_id $$,
  $$ values ('00000000-0000-0000-0000-000000000101'::uuid) $$,
  'a project-member UID mention is accepted'
);
select extensions.ok(
  (select count(*) > 1 from public.activity_events where project_id = '00000000-0000-0000-0000-000000000201'),
  'task, assignment, and comment changes create activity'
);
select extensions.throws_ok(
  $$ insert into public.notifications (user_id, type) values ('00000000-0000-0000-0000-000000000101', 'comment_added') $$,
  '42501', null,
  'clients cannot forge notifications'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","email":"editor@taskflow.local","role":"authenticated"}', true);
select extensions.ok((select count(*) >= 2 from public.notifications), 'assignee receives assignment and comment notifications');
select extensions.lives_ok($$ update public.notifications set read_at = now() where read_at is null $$, 'user can mark own notifications read');
select extensions.results_eq(
  $$ insert into public.task_comments (id, task_id, user_id, content) values ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000102', 'Editor comment') returning id $$,
  $$ values ('00000000-0000-0000-0000-000000000702'::uuid) $$,
  'editor can comment on a project task'
);
select extensions.results_eq(
  $$ update public.task_comments set content = 'Edited editor comment' where id = '00000000-0000-0000-0000-000000000702' returning id $$,
  $$ values ('00000000-0000-0000-0000-000000000702'::uuid) $$,
  'comment author can edit their comment'
);
select extensions.lives_ok(
  $$ select public.set_task_assignee('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000103') $$,
  'editor can assign a task to another project member'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000103","email":"viewer@taskflow.local","role":"authenticated"}', true);
select extensions.throws_ok(
  $$ select public.set_task_assignee('00000000-0000-0000-0000-000000000402', null) $$,
  '42501', 'Only project owners and editors may assign tasks',
  'viewer cannot change task assignment'
);
select extensions.results_eq(
  $$ insert into public.task_comments (task_id, user_id, content) values ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000103', 'Viewer comment') returning user_id $$,
  $$ values ('00000000-0000-0000-0000-000000000103'::uuid) $$,
  'viewer can participate in project discussion'
);
select extensions.results_eq(
  $$ update public.task_comments set content = 'Not allowed' where id = '00000000-0000-0000-0000-000000000702' returning id $$,
  $$ select null::uuid where false $$,
  'viewer cannot edit another author comment'
);
select extensions.ok((select count(*) > 1 from public.activity_events), 'viewer can read project activity');
select extensions.ok((select count(*) >= 1 from public.notifications where type = 'mentioned'), 'mentioned member receives a notification');
select extensions.results_eq(
  $$ delete from public.task_comments where id = '00000000-0000-0000-0000-000000000702' returning id $$,
  $$ select null::uuid where false $$,
  'viewer cannot delete another author comment'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000104","email":"outsider@taskflow.local","role":"authenticated"}', true);
select extensions.is((select count(*)::integer from public.activity_events), 0, 'outsider cannot read project activity');
select extensions.is((select count(*)::integer from public.task_comments), 0, 'outsider cannot read task comments');
select extensions.is((select count(*)::integer from public.notifications), 0, 'outsider cannot read another user notifications');
select extensions.throws_ok(
  $$ insert into public.task_comments (task_id, user_id, content) values ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000104', 'Blocked') $$,
  '42501', null,
  'outsider cannot comment on an inaccessible task'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner@taskflow.local","role":"authenticated"}', true);
select extensions.lives_ok(
  $$ select public.set_task_assignee('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000103') $$,
  'owner can select a member before removal'
);
select extensions.results_eq(
  $$ delete from public.project_members where project_id = '00000000-0000-0000-0000-000000000201' and user_id = '00000000-0000-0000-0000-000000000103' returning user_id $$,
  $$ values ('00000000-0000-0000-0000-000000000103'::uuid) $$,
  'owner can remove the assigned member'
);
select extensions.is(
  (select count(*)::integer from public.task_assignments where task_id = '00000000-0000-0000-0000-000000000402'),
  0,
  'removing a member clears their task assignment'
);
select extensions.throws_ok(
  $$ insert into public.task_comments (task_id, user_id, content) values ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000101', '   ') $$,
  '23514', null,
  'blank comments remain invalid'
);
select extensions.is(
  (select count(*)::integer from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('notifications', 'task_comments', 'activity_events')),
  3,
  'collaboration tables are enabled for Realtime'
);
select extensions.results_eq(
  $$ delete from public.notifications where user_id = '00000000-0000-0000-0000-000000000102' returning user_id $$,
  $$ select null::uuid where false $$,
  'owner cannot delete another user notifications'
);

select * from extensions.finish();
rollback;
