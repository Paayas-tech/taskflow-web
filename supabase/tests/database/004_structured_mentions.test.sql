begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;
select extensions.plan(3);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner@taskflow.local","role":"authenticated"}', true);
select extensions.lives_ok(
  $$ insert into public.task_comments (task_id, user_id, content) values (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000101',
    'Hello @[Viewer](user:00000000-0000-0000-0000-000000000103)'
  ) $$,
  'structured mention comments are accepted'
);
select extensions.lives_ok(
  $$ insert into public.task_comments (task_id, user_id, content) values (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000101',
    'Legacy @00000000-0000-0000-0000-000000000103'
  ) $$,
  'legacy mention comments remain accepted'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000103","email":"viewer@taskflow.local","role":"authenticated"}', true);
select extensions.ok(
  (select count(*) >= 2 from public.notifications where type = 'mentioned' and task_id = '00000000-0000-0000-0000-000000000402'),
  'structured and legacy mentions both notify the authorized member'
);

select * from extensions.finish();
rollback;
