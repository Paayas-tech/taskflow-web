create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_project_member(
  target_project_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null and exists (
    select 1
    from public.project_members pm
    where pm.project_id = target_project_id
      and pm.user_id = target_user_id
  );
$$;

create or replace function private.project_role(
  target_project_id uuid,
  target_user_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select pm.role
  from public.project_members pm
  where pm.project_id = target_project_id
    and pm.user_id = target_user_id;
$$;

create or replace function private.is_project_owner(
  target_project_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null and exists (
    select 1 from public.projects p
    where p.id = target_project_id and p.owner_id = target_user_id
  );
$$;

create or replace function private.can_edit_project(
  target_project_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.project_role(target_project_id, target_user_id) in ('owner', 'editor'), false);
$$;

create or replace function private.task_project_id(target_task_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.project_id from public.tasks t where t.id = target_task_id;
$$;

create or replace function private.can_read_task(
  target_task_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null and exists (
    select 1
    from public.tasks t
    where t.id = target_task_id
      and (
        (t.project_id is null and t.created_by = target_user_id)
        or private.is_project_member(t.project_id, target_user_id)
      )
  );
$$;

create or replace function private.is_task_assignee(
  target_task_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null and exists (
    select 1 from public.task_assignments ta
    where ta.task_id = target_task_id and ta.user_id = target_user_id
  );
$$;

create or replace function private.can_update_task(
  target_task_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null and exists (
    select 1
    from public.tasks t
    where t.id = target_task_id
      and (
        t.created_by = target_user_id
        or private.is_task_assignee(t.id, target_user_id)
      )
      and (
        t.project_id is null
        or private.is_project_member(t.project_id, target_user_id)
      )
  );
$$;

create or replace function private.can_delete_task(
  target_task_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null and exists (
    select 1
    from public.tasks t
    where t.id = target_task_id
      and (
        (t.project_id is null and t.created_by = target_user_id)
        or private.can_edit_project(t.project_id, target_user_id)
      )
  );
$$;

create or replace function private.invitation_matches_current_user(target_email text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
    and lower(coalesce(auth.jwt() ->> 'email', '')) = target_email;
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invitations enable row level security;
alter table public.project_columns enable row level security;
alter table public.tasks enable row level security;
alter table public.lists enable row level security;
alter table public.task_list_placements enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_comments enable row level security;
alter table public.activity_events enable row level security;
alter table public.project_documents enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.users to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_members to authenticated;
grant select, insert, update, delete on public.project_invitations to authenticated;
grant select, insert, update, delete on public.project_columns to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.lists to authenticated;
grant select, insert, update, delete on public.task_list_placements to authenticated;
grant select, insert, update, delete on public.task_assignments to authenticated;
grant select, insert, update, delete on public.task_comments to authenticated;
grant select on public.activity_events to authenticated;
grant select, insert, update, delete on public.project_documents to authenticated;

create policy users_select_own on public.users
for select to authenticated
using (id = auth.uid());

create policy users_update_own on public.users
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and email = lower(coalesce(auth.jwt() ->> 'email', email)));

create policy projects_select_members on public.projects
for select to authenticated
using (private.is_project_member(id));

create policy projects_insert_owner on public.projects
for insert to authenticated
with check (owner_id = auth.uid());

create policy projects_update_owner_editor on public.projects
for update to authenticated
using (private.can_edit_project(id))
with check (private.can_edit_project(id));

create policy projects_delete_owner on public.projects
for delete to authenticated
using (private.is_project_owner(id));

create policy project_members_select_project_members on public.project_members
for select to authenticated
using (private.is_project_member(project_id));

create policy project_members_insert_owner on public.project_members
for insert to authenticated
with check (private.is_project_owner(project_id));

create policy project_members_update_owner on public.project_members
for update to authenticated
using (private.is_project_owner(project_id))
with check (private.is_project_owner(project_id));

create policy project_members_delete_owner on public.project_members
for delete to authenticated
using (private.is_project_owner(project_id) and user_id <> auth.uid());

create policy project_invitations_select_owner_or_invitee on public.project_invitations
for select to authenticated
using (
  private.is_project_owner(project_id)
  or private.invitation_matches_current_user(email_normalized)
);

create policy project_invitations_insert_owner on public.project_invitations
for insert to authenticated
with check (
  private.is_project_owner(project_id)
  and inviter_id = auth.uid()
  and email_normalized = lower(btrim(email))
);

create policy project_invitations_update_invitee on public.project_invitations
for update to authenticated
using (
  status = 'pending'
  and private.invitation_matches_current_user(email_normalized)
)
with check (
  private.invitation_matches_current_user(email_normalized)
  and (
    (status = 'accepted' and accepted_by = auth.uid() and accepted_at is not null)
    or (status = 'declined' and accepted_by is null and accepted_at is null)
  )
);

create policy project_invitations_delete_owner on public.project_invitations
for delete to authenticated
using (private.is_project_owner(project_id));

create policy project_columns_select_members on public.project_columns
for select to authenticated
using (private.is_project_member(project_id));

create policy project_columns_insert_editors on public.project_columns
for insert to authenticated
with check (private.can_edit_project(project_id));

create policy project_columns_update_editors on public.project_columns
for update to authenticated
using (private.can_edit_project(project_id))
with check (private.can_edit_project(project_id));

create policy project_columns_delete_editors on public.project_columns
for delete to authenticated
using (private.can_edit_project(project_id));

create policy tasks_select_accessible on public.tasks
for select to authenticated
using (
  (project_id is null and created_by = auth.uid())
  or private.is_project_member(project_id)
);

create policy tasks_insert_accessible on public.tasks
for insert to authenticated
with check (
  created_by = auth.uid()
  and (project_id is null or private.is_project_member(project_id))
);

create policy tasks_update_creator_or_assignee on public.tasks
for update to authenticated
using (private.can_update_task(id))
with check (
  (project_id is null and created_by = auth.uid())
  or (project_id is not null and private.is_project_member(project_id))
);

create policy tasks_delete_owner_editor on public.tasks
for delete to authenticated
using (private.can_delete_task(id));

create policy lists_select_own on public.lists
for select to authenticated using (user_id = auth.uid());
create policy lists_insert_own on public.lists
for insert to authenticated with check (user_id = auth.uid());
create policy lists_update_own on public.lists
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy lists_delete_own on public.lists
for delete to authenticated using (user_id = auth.uid());

create policy task_list_placements_select_own on public.task_list_placements
for select to authenticated using (user_id = auth.uid());
create policy task_list_placements_insert_own on public.task_list_placements
for insert to authenticated with check (user_id = auth.uid());
create policy task_list_placements_update_own on public.task_list_placements
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy task_list_placements_delete_own on public.task_list_placements
for delete to authenticated using (user_id = auth.uid());

create policy task_assignments_select_members on public.task_assignments
for select to authenticated
using (private.is_project_member(private.task_project_id(task_id)));

create policy task_assignments_insert_editors on public.task_assignments
for insert to authenticated
with check (private.can_edit_project(private.task_project_id(task_id)));

create policy task_assignments_update_editors on public.task_assignments
for update to authenticated
using (private.can_edit_project(private.task_project_id(task_id)))
with check (private.can_edit_project(private.task_project_id(task_id)));

create policy task_assignments_delete_editors on public.task_assignments
for delete to authenticated
using (private.can_edit_project(private.task_project_id(task_id)));

create policy task_comments_select_task_readers on public.task_comments
for select to authenticated
using (private.can_read_task(task_id));

create policy task_comments_insert_task_readers on public.task_comments
for insert to authenticated
with check (user_id = auth.uid() and private.can_read_task(task_id));

create policy task_comments_update_author on public.task_comments
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and private.can_read_task(task_id));

create policy task_comments_delete_author on public.task_comments
for delete to authenticated
using (user_id = auth.uid());

create policy activity_events_select_members on public.activity_events
for select to authenticated
using (
  (project_id is not null and private.is_project_member(project_id))
  or (project_id is null and task_id is not null and private.can_read_task(task_id))
);

create policy project_documents_select_members on public.project_documents
for select to authenticated
using (private.is_project_member(project_id));

create policy project_documents_insert_editors on public.project_documents
for insert to authenticated
with check (created_by = auth.uid() and private.can_edit_project(project_id));

create policy project_documents_update_editors on public.project_documents
for update to authenticated
using (private.can_edit_project(project_id))
with check (private.can_edit_project(project_id));

create policy project_documents_delete_editors on public.project_documents
for delete to authenticated
using (private.can_edit_project(project_id));
