begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;
select extensions.plan(7);

select extensions.has_function(
  'public', 'get_visible_user_profiles', array['uuid[]'],
  'visible profile RPC exists'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner@taskflow.local","role":"authenticated"}', true);
select extensions.is(
  (select count(*)::integer from public.get_visible_user_profiles(array['00000000-0000-0000-0000-000000000101'::uuid])),
  1, 'a user can resolve their own approved profile'
);
select extensions.is(
  (select count(*)::integer from public.get_visible_user_profiles(array['00000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000103'::uuid])),
  2, 'a project member can resolve fellow members'
);
select extensions.is(
  (select count(*)::integer from public.get_visible_user_profiles(array['00000000-0000-0000-0000-000000000104'::uuid])),
  0, 'an unrelated profile is not exposed'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000105","email":"unrelated@taskflow.local","role":"authenticated"}', true);
select extensions.is(
  (select count(*)::integer from public.get_visible_user_profiles(array['00000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000102'::uuid])),
  0, 'an unrelated user cannot enumerate project members'
);
select extensions.is(
  (select count(*)::integer from public.get_visible_user_profiles(array['00000000-0000-0000-0000-000000000104'::uuid])),
  0, 'an unrelated user cannot resolve another profile'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000104","email":"outsider@taskflow.local","role":"authenticated"}', true);
select extensions.is(
  (select count(*)::integer from public.get_visible_user_profiles(array['00000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000102'::uuid])),
  1, 'a pending invitee can resolve only their inviter among requested project users'
);

select * from extensions.finish();
rollback;
