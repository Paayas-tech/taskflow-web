begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;
select extensions.plan(15);

select extensions.has_table('public', 'attachments', 'shared attachment metadata table exists');
select extensions.ok((select not public from storage.buckets where id = 'taskflow-attachments'), 'attachment bucket is private');
select extensions.is((select file_size_limit from storage.buckets where id = 'taskflow-attachments'), 10485760::bigint, 'bucket enforces the 10 MB limit');

insert into public.tasks (id, project_id, created_by, title, status, work_type)
values ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'Fixture Story', 'todo', 'story');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner@taskflow.local","role":"authenticated"}', true);
select extensions.lives_ok($$
  insert into public.attachments (id, project_id, entity_type, entity_id, storage_path, file_name, content_type, size_bytes, uploaded_by)
  values ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000201', 'project', '00000000-0000-0000-0000-000000000201', 'projects/00000000-0000-0000-0000-000000000201/project/00000000-0000-0000-0000-000000000201/00000000-0000-0000-0000-000000000601-file.pdf', 'file.pdf', 'application/pdf', 100, '00000000-0000-0000-0000-000000000101')
$$, 'owner can add a project attachment');
select extensions.is((select count(*)::integer from public.attachments), 1, 'owner can read project attachment metadata');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","email":"editor@taskflow.local","role":"authenticated"}', true);
select extensions.lives_ok($$
  insert into public.attachments (id, project_id, entity_type, entity_id, storage_path, file_name, content_type, size_bytes, uploaded_by)
  values ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000201', 'story', '00000000-0000-0000-0000-000000000404', 'projects/00000000-0000-0000-0000-000000000201/story/00000000-0000-0000-0000-000000000404/00000000-0000-0000-0000-000000000602-image.png', 'image.png', 'image/png', 100, '00000000-0000-0000-0000-000000000102')
$$, 'editor can add a Story attachment');
select extensions.lives_ok($$delete from public.attachments where id = '00000000-0000-0000-0000-000000000602'$$, 'editor can delete attachment metadata');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000103","email":"viewer@taskflow.local","role":"authenticated"}', true);
select extensions.is((select count(*)::integer from public.attachments), 1, 'viewer can read attachment metadata');
select extensions.throws_ok($$
  insert into public.attachments (id, project_id, entity_type, entity_id, storage_path, file_name, content_type, size_bytes, uploaded_by)
  values ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000201', 'task', '00000000-0000-0000-0000-000000000402', 'projects/00000000-0000-0000-0000-000000000201/task/00000000-0000-0000-0000-000000000402/00000000-0000-0000-0000-000000000603-file.pdf', 'file.pdf', 'application/pdf', 100, '00000000-0000-0000-0000-000000000103')
$$, '42501', null, 'viewer cannot add attachments');
select extensions.lives_ok($$delete from public.attachments where id = '00000000-0000-0000-0000-000000000601'$$, 'viewer delete is safely filtered by RLS');
select extensions.is((select count(*)::integer from public.attachments), 1, 'viewer cannot delete attachment metadata');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000104","email":"outsider@taskflow.local","role":"authenticated"}', true);
select extensions.is((select count(*)::integer from public.attachments), 0, 'non-member cannot read attachment metadata');

set local role postgres;
select extensions.throws_ok($$
  insert into public.attachments (project_id, entity_type, entity_id, storage_path, file_name, content_type, size_bytes, uploaded_by)
  values ('00000000-0000-0000-0000-000000000201', 'project', '00000000-0000-0000-0000-000000000402', 'invalid-project', 'file.pdf', 'application/pdf', 100, '00000000-0000-0000-0000-000000000101')
$$, 'P0001', 'Project attachment entity must match project', 'project entity validation rejects mismatches');
select extensions.throws_ok($$
  insert into public.attachments (project_id, entity_type, entity_id, storage_path, file_name, content_type, size_bytes, uploaded_by)
  values ('00000000-0000-0000-0000-000000000201', 'story', '00000000-0000-0000-0000-000000000402', 'invalid-story', 'file.pdf', 'application/pdf', 100, '00000000-0000-0000-0000-000000000101')
$$, 'P0001', 'Story attachments require a Story entity', 'Story attachment cannot target an ordinary task');
select extensions.throws_ok($$
  insert into public.attachments (project_id, entity_type, entity_id, storage_path, file_name, content_type, size_bytes, uploaded_by)
  values ('00000000-0000-0000-0000-000000000201', 'task', '00000000-0000-0000-0000-000000000401', 'cross-scope', 'file.pdf', 'application/pdf', 100, '00000000-0000-0000-0000-000000000101')
$$, 'P0001', 'Attachment task entity is unavailable', 'personal or cross-scope task attachment is rejected');

select * from extensions.finish();
rollback;
