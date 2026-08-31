-- Shared private attachments for projects, Stories, and project tasks.
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  entity_type text not null check (entity_type in ('project', 'story', 'task')),
  entity_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_entity
  on public.attachments(project_id, entity_type, entity_id, created_at desc);
create index if not exists idx_attachments_uploaded_by
  on public.attachments(uploaded_by, created_at desc);

create or replace function public.validate_attachment_entity()
returns trigger language plpgsql set search_path = '' as $$
declare target_project uuid; target_type text; file_extension text;
begin
  if new.content_type not in (
    'application/pdf', 'text/plain', 'text/csv', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg', 'image/webp'
  ) then raise exception 'Attachment content type is not supported'; end if;
  file_extension := lower(substring(new.file_name from '\.([^.]+)$'));
  if (new.content_type = 'application/pdf' and file_extension <> 'pdf')
    or (new.content_type = 'text/plain' and file_extension <> 'txt')
    or (new.content_type = 'text/csv' and file_extension <> 'csv')
    or (new.content_type = 'application/msword' and file_extension <> 'doc')
    or (new.content_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' and file_extension <> 'docx')
    or (new.content_type = 'application/vnd.ms-excel' and file_extension <> 'xls')
    or (new.content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and file_extension <> 'xlsx')
    or (new.content_type = 'application/vnd.ms-powerpoint' and file_extension <> 'ppt')
    or (new.content_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation' and file_extension <> 'pptx')
    or (new.content_type = 'image/png' and file_extension <> 'png')
    or (new.content_type = 'image/jpeg' and file_extension not in ('jpg', 'jpeg'))
    or (new.content_type = 'image/webp' and file_extension <> 'webp')
  then raise exception 'Attachment extension does not match content type'; end if;
  if new.entity_type = 'project' then
    if new.entity_id is distinct from new.project_id then
      raise exception 'Project attachment entity must match project';
    end if;
  else
    select project_id, work_type into target_project, target_type
      from public.tasks where id = new.entity_id;
    if target_project is null then raise exception 'Attachment task entity is unavailable'; end if;
    if target_project is distinct from new.project_id then
      raise exception 'Attachment entity must belong to the same project';
    end if;
    if new.entity_type = 'story' and target_type is distinct from 'story' then
      raise exception 'Story attachments require a Story entity';
    end if;
    if new.entity_type = 'task' and target_type is distinct from 'task' then
      raise exception 'Task attachments require a task entity';
    end if;
  end if;
  if new.storage_path not like format(
    'projects/%s/%s/%s/%s-%%', new.project_id, new.entity_type, new.entity_id, new.id
  ) then raise exception 'Attachment storage path does not match its entity'; end if;
  return new;
end;
$$;

drop trigger if exists attachments_validate_entity on public.attachments;
create trigger attachments_validate_entity
before insert or update of project_id, entity_type, entity_id on public.attachments
for each row execute function public.validate_attachment_entity();

alter table public.attachments enable row level security;
grant select, insert, delete on public.attachments to authenticated;

create policy attachments_select_project_members on public.attachments
for select to authenticated using (private.is_project_member(project_id));
create policy attachments_insert_project_editors on public.attachments
for insert to authenticated with check (
  uploaded_by = auth.uid() and private.can_edit_project(project_id)
);
create policy attachments_delete_project_editors on public.attachments
for delete to authenticated using (private.can_edit_project(project_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'taskflow-attachments', 'taskflow-attachments', false, 10485760,
  array[
    'application/pdf', 'text/plain', 'text/csv', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg', 'image/webp'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.attachment_path_project_id(object_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
declare parts text[];
begin
  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) <> 5 or parts[1] <> 'projects' then return null; end if;
  if parts[3] not in ('project', 'story', 'task') then return null; end if;
  return parts[2]::uuid;
exception when invalid_text_representation then return null;
end;
$$;

create policy attachment_objects_select_members on storage.objects
for select to authenticated using (
  bucket_id = 'taskflow-attachments'
  and private.is_project_member(private.attachment_path_project_id(name))
);
create policy attachment_objects_insert_editors on storage.objects
for insert to authenticated with check (
  bucket_id = 'taskflow-attachments'
  and private.can_edit_project(private.attachment_path_project_id(name))
);
create policy attachment_objects_delete_editors on storage.objects
for delete to authenticated using (
  bucket_id = 'taskflow-attachments'
  and private.can_edit_project(private.attachment_path_project_id(name))
);

-- Metadata is removed with a deleted project. Task/Story metadata is removed
-- by this trigger; application deletion flows should remove Storage objects
-- before deleting their entity so the underlying private file is not orphaned.
create or replace function public.delete_task_attachment_metadata()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.attachments
   where project_id = old.project_id and entity_id = old.id
     and entity_type in ('story', 'task');
  return old;
end;
$$;
drop trigger if exists tasks_delete_attachment_metadata on public.tasks;
create trigger tasks_delete_attachment_metadata
after delete on public.tasks for each row execute function public.delete_task_attachment_metadata();

revoke all on function public.validate_attachment_entity() from public, anon, authenticated;
revoke all on function public.delete_task_attachment_metadata() from public, anon, authenticated;
