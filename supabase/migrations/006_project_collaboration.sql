-- Phase 4 collaboration permissions.
-- Owners manage project metadata and membership. Editors collaborate on project
-- tasks and columns. Viewers retain read-only access.

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
        (t.project_id is null and t.created_by = target_user_id)
        or (
          t.project_id is not null
          and private.project_role(t.project_id, target_user_id) in ('owner', 'editor')
        )
      )
  );
$$;

drop policy if exists projects_update_owner_editor on public.projects;
create policy projects_update_owner on public.projects
for update to authenticated
using (private.is_project_owner(id))
with check (private.is_project_owner(id));

drop policy if exists tasks_insert_accessible on public.tasks;
create policy tasks_insert_owner_editor on public.tasks
for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    project_id is null
    or private.project_role(project_id) in ('owner', 'editor')
  )
);

create or replace function public.protect_invitation_update()
returns trigger language plpgsql set search_path = '' as $$
declare
  project_status text;
begin
  if (new.project_id, new.email, new.email_normalized, new.role, new.inviter_id,
      new.token_hash, new.expires_at, new.created_at)
     is distinct from
     (old.project_id, old.email, old.email_normalized, old.role, old.inviter_id,
      old.token_hash, old.expires_at, old.created_at) then
    raise exception 'Invitation identity fields are immutable';
  end if;
  if old.status <> 'pending' or new.status not in ('accepted', 'declined') then
    raise exception 'Only pending invitations may be accepted or declined';
  end if;
  if new.status = 'accepted' then
    if old.expires_at is not null and old.expires_at <= now() then
      raise exception 'Invitation has expired';
    end if;
    select status into project_status
    from public.projects
    where id = old.project_id;
    if project_status <> 'active' then
      raise exception 'Archived projects cannot accept invitations';
    end if;
  end if;
  return new;
end;
$$;
