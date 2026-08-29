-- Keep collaborative data consistent when an authenticated account is deleted.
-- Owned projects belong to the account and are removed; contributions to projects
-- owned by someone else remain, with their creator reference anonymized.

alter table public.projects
  drop constraint projects_owner_id_fkey,
  add constraint projects_owner_id_fkey
    foreign key (owner_id) references public.users(id) on delete cascade;

alter table public.project_members
  alter column added_by drop not null,
  drop constraint project_members_added_by_fkey,
  add constraint project_members_added_by_fkey
    foreign key (added_by) references public.users(id) on delete set null;

alter table public.project_invitations
  drop constraint project_invitations_inviter_id_fkey,
  add constraint project_invitations_inviter_id_fkey
    foreign key (inviter_id) references public.users(id) on delete cascade,
  drop constraint project_invitations_accepted_by_fkey,
  add constraint project_invitations_accepted_by_fkey
    foreign key (accepted_by) references public.users(id) on delete set null,
  drop constraint project_invitations_acceptance_consistent,
  add constraint project_invitations_acceptance_consistent check (
    (status = 'accepted' and accepted_at is not null)
    or (status in ('pending', 'declined') and accepted_by is null and accepted_at is null)
  );

alter table public.tasks
  alter column created_by drop not null,
  drop constraint tasks_created_by_fkey,
  add constraint tasks_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;

alter table public.project_documents
  alter column created_by drop not null,
  drop constraint project_documents_created_by_fkey,
  add constraint project_documents_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;

create or replace function public.cleanup_deleting_user_data()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Personal tasks belong solely to the departing account. Project tasks are
  -- retained and anonymized by the foreign key above unless their owned project
  -- is itself deleted by cascade.
  delete from public.tasks
  where project_id is null and created_by = old.id;
  return old;
end;
$$;

drop trigger if exists cleanup_deleting_user_data on public.users;
create trigger cleanup_deleting_user_data
before delete on public.users
for each row execute function public.cleanup_deleting_user_data();
