begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select extensions.plan(7);

select extensions.has_column('public', 'projects', 'health_status', 'projects have a health status');
select extensions.is((select health_status from public.projects where id = '00000000-0000-0000-0000-000000000201'), 'on_track', 'existing projects default to on track');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","email":"editor@taskflow.local","role":"authenticated"}', true);
select extensions.is(public.set_project_health_status('00000000-0000-0000-0000-000000000201', 'at_risk'), 'at_risk', 'editor can update project health');
select extensions.is((select health_status from public.projects where id = '00000000-0000-0000-0000-000000000201'), 'at_risk', 'editor reads the updated health');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000103","email":"viewer@taskflow.local","role":"authenticated"}', true);
select extensions.is((select health_status from public.projects where id = '00000000-0000-0000-0000-000000000201'), 'at_risk', 'viewer can read project health');
select extensions.throws_ok($$select public.set_project_health_status('00000000-0000-0000-0000-000000000201', 'off_track')$$, '42501', 'Project health can only be changed by an owner or editor', 'viewer cannot update project health');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000104","email":"outsider@taskflow.local","role":"authenticated"}', true);
select extensions.is((select count(*)::integer from public.projects where id = '00000000-0000-0000-0000-000000000201'), 0, 'non-member cannot read project health');

select * from extensions.finish();
rollback;
