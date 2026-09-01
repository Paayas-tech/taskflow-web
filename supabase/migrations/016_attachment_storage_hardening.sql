-- Harden private attachment object paths so direct Storage API calls cannot
-- create files for missing or cross-project entities.
create or replace function private.attachment_storage_path_is_valid(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[];
  path_project_id uuid;
  path_entity_id uuid;
begin
  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) <> 5
    or parts[1] <> 'projects'
    or parts[3] not in ('project', 'story', 'task')
    or parts[5] !~ '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}-[A-Za-z0-9_-]+(\.[a-z0-9]+)?$'
  then
    return false;
  end if;

  path_project_id := parts[2]::uuid;
  path_entity_id := parts[4]::uuid;

  if parts[3] = 'project' then
    return path_entity_id = path_project_id
      and exists (select 1 from public.projects where id = path_project_id);
  end if;

  return exists (
    select 1
    from public.tasks
    where id = path_entity_id
      and project_id = path_project_id
      and work_type = parts[3]
  );
exception
  when invalid_text_representation then return false;
end;
$$;

revoke all on function private.attachment_storage_path_is_valid(text) from public, anon;
grant execute on function private.attachment_storage_path_is_valid(text) to authenticated;

create or replace function public.validate_attachment_storage_path()
returns trigger
language plpgsql
set search_path = ''
as $$
declare parts text[];
begin
  parts := string_to_array(new.storage_path, '/');
  if not private.attachment_storage_path_is_valid(new.storage_path)
    or parts[2] <> new.project_id::text
    or parts[3] <> new.entity_type
    or parts[4] <> new.entity_id::text
    or parts[5] not like new.id::text || '-%'
  then
    raise exception 'Attachment storage path does not match its entity';
  end if;
  return new;
end;
$$;

drop trigger if exists attachments_validate_storage_path on public.attachments;
create trigger attachments_validate_storage_path
before insert or update of project_id, entity_type, entity_id, storage_path on public.attachments
for each row execute function public.validate_attachment_storage_path();

revoke all on function public.validate_attachment_storage_path() from public, anon, authenticated;

drop policy if exists attachment_objects_select_members on storage.objects;
drop policy if exists attachment_objects_insert_editors on storage.objects;
drop policy if exists attachment_objects_delete_editors on storage.objects;

create policy attachment_objects_select_members on storage.objects
for select to authenticated using (
  bucket_id = 'taskflow-attachments'
  and private.attachment_storage_path_is_valid(name)
  and private.is_project_member(private.attachment_path_project_id(name))
);

create policy attachment_objects_insert_editors on storage.objects
for insert to authenticated with check (
  bucket_id = 'taskflow-attachments'
  and private.attachment_storage_path_is_valid(name)
  and private.can_edit_project(private.attachment_path_project_id(name))
);

create policy attachment_objects_delete_editors on storage.objects
for delete to authenticated using (
  bucket_id = 'taskflow-attachments'
  and private.attachment_storage_path_is_valid(name)
  and private.can_edit_project(private.attachment_path_project_id(name))
);
