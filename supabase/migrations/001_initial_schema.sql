create extension if not exists pgcrypto with schema extensions;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  avatar_url text,
  timezone text not null default 'UTC',
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_normalized check (email = lower(btrim(email))),
  constraint users_email_not_blank check (btrim(email) <> ''),
  constraint users_timezone_not_blank check (btrim(timezone) <> ''),
  constraint users_locale_not_blank check (btrim(locale) <> '')
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id),
  name text not null,
  description text,
  color text,
  status text not null default 'active' check (status in ('active', 'archived')),
  due_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_not_blank check (btrim(name) <> ''),
  constraint projects_archive_consistent check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  added_by uuid not null references public.users(id),
  primary key (project_id, user_id)
);

create table public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  email_normalized text not null,
  role text not null check (role in ('editor', 'viewer')),
  inviter_id uuid not null references public.users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  token_hash text unique,
  expires_at timestamptz,
  accepted_by uuid references public.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint project_invitations_email_not_blank check (btrim(email) <> ''),
  constraint project_invitations_email_normalized check (
    email_normalized = lower(btrim(email)) and btrim(email_normalized) <> ''
  ),
  constraint project_invitations_acceptance_consistent check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or (status in ('pending', 'declined') and accepted_by is null and accepted_at is null)
  )
);

create table public.project_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  category text not null default 'custom' check (category in ('todo', 'in_progress', 'done', 'custom')),
  position integer not null,
  wip_limit integer,
  is_terminal boolean not null default false,
  created_at timestamptz not null default now(),
  constraint project_columns_name_not_blank check (btrim(name) <> ''),
  constraint project_columns_position_nonnegative check (position >= 0),
  constraint project_columns_wip_limit_positive check (wip_limit is null or wip_limit > 0),
  unique (project_id, position),
  unique (id, project_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  created_by uuid not null references public.users(id),
  title text not null,
  description text,
  notes text,
  priority text check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  column_id uuid,
  due_date date,
  start_date date,
  due_time time,
  start_time time,
  position integer,
  parent_task_id uuid references public.tasks(id) on delete set null,
  completed_at timestamptz,
  archived_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_not_blank check (btrim(title) <> ''),
  constraint tasks_position_nonnegative check (position is null or position >= 0),
  constraint tasks_version_positive check (version > 0),
  constraint tasks_due_time_requires_date check (due_time is null or due_date is not null),
  constraint tasks_start_time_requires_date check (start_time is null or start_date is not null),
  constraint tasks_column_requires_project check (column_id is null or project_id is not null),
  constraint tasks_not_own_parent check (parent_task_id is null or parent_task_id <> id),
  unique (id, project_id),
  foreign key (column_id, project_id)
    references public.project_columns(id, project_id)
    on delete set null (column_id)
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  color text,
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lists_name_not_blank check (btrim(name) <> ''),
  constraint lists_position_nonnegative check (position is null or position >= 0)
);

create table public.task_list_placements (
  task_id uuid not null references public.tasks(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  primary key (task_id, user_id)
);

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (task_id, user_id)
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  constraint task_comments_content_not_blank check (btrim(content) <> '')
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_events_type_not_blank check (btrim(event_type) <> ''),
  constraint activity_events_scope_present check (project_id is not null or task_id is not null),
  constraint activity_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.project_documents(id) on delete set null,
  title text not null,
  content text,
  position integer,
  version integer not null default 1,
  archived_at timestamptz,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_documents_title_not_blank check (btrim(title) <> ''),
  constraint project_documents_position_nonnegative check (position is null or position >= 0),
  constraint project_documents_version_positive check (version > 0),
  constraint project_documents_not_own_parent check (parent_id is null or parent_id <> id)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger lists_set_updated_at before update on public.lists
for each row execute function public.set_updated_at();
create trigger project_documents_set_updated_at before update on public.project_documents
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.users.display_name),
        avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.create_owner_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_members (project_id, user_id, role, added_by)
  values (new.id, new.owner_id, 'owner', new.owner_id)
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

create trigger projects_create_owner_membership
after insert on public.projects
for each row execute function public.create_owner_membership();

create or replace function public.validate_project_member()
returns trigger language plpgsql set search_path = '' as $$
declare project_owner uuid;
begin
  select owner_id into project_owner from public.projects where id = new.project_id;
  if project_owner is null then raise exception 'Project does not exist'; end if;
  if new.added_by <> project_owner then
    raise exception 'Membership added_by must be the project owner';
  end if;
  if (new.role = 'owner') <> (new.user_id = project_owner) then
    raise exception 'Only the project owner may have the owner role';
  end if;
  if tg_op = 'UPDATE' and (
    new.project_id <> old.project_id or new.user_id <> old.user_id
    or new.added_by <> old.added_by or new.joined_at <> old.joined_at
  ) then
    raise exception 'Project membership identity fields are immutable';
  end if;
  return new;
end;
$$;

create trigger project_members_validate
before insert or update on public.project_members
for each row execute function public.validate_project_member();

create or replace function public.protect_project_owner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'Project ownership transfer is not supported';
  end if;
  if (new.status, new.archived_at) is distinct from (old.status, old.archived_at)
     and auth.uid() is not null and auth.uid() <> old.owner_id then
    raise exception 'Only the project owner may archive or restore a project';
  end if;
  return new;
end;
$$;

create trigger projects_protect_owner
before update on public.projects
for each row execute function public.protect_project_owner();

create or replace function public.protect_invitation_update()
returns trigger language plpgsql set search_path = '' as $$
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
  return new;
end;
$$;

create trigger project_invitations_protect_update
before update on public.project_invitations
for each row execute function public.protect_invitation_update();

create or replace function public.accept_project_invitation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.project_members (project_id, user_id, role, added_by)
    values (new.project_id, new.accepted_by, new.role, new.inviter_id)
    on conflict (project_id, user_id) do update
      set role = excluded.role;
  end if;
  return new;
end;
$$;

create trigger project_invitations_create_membership
after update of status on public.project_invitations
for each row execute function public.accept_project_invitation();

create or replace function public.normalize_task_completion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  if tg_op = 'UPDATE' then
    if new.created_by <> old.created_by or new.created_at <> old.created_at then
      raise exception 'Task creator and creation time are immutable';
    end if;
    if new.version <= old.version then new.version := old.version + 1; end if;
  end if;
  return new;
end;
$$;

create trigger tasks_normalize_completion
before insert or update on public.tasks
for each row execute function public.normalize_task_completion();

create or replace function public.validate_task_relationships()
returns trigger language plpgsql set search_path = '' as $$
declare related_project uuid;
begin
  if new.parent_task_id is not null then
    select project_id into related_project from public.tasks where id = new.parent_task_id;
    if related_project is distinct from new.project_id then
      raise exception 'Parent task must belong to the same project scope';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_validate_relationships
before insert or update on public.tasks
for each row execute function public.validate_task_relationships();

create or replace function public.validate_task_assignment()
returns trigger language plpgsql set search_path = '' as $$
declare task_project uuid;
begin
  select project_id into task_project from public.tasks where id = new.task_id;
  if task_project is null then raise exception 'Only project tasks may be assigned'; end if;
  if not exists (
    select 1 from public.project_members
    where project_id = task_project and user_id = new.user_id
  ) then
    raise exception 'Assignee must be a project member';
  end if;
  return new;
end;
$$;

create trigger task_assignments_validate
before insert or update on public.task_assignments
for each row execute function public.validate_task_assignment();

create or replace function public.validate_task_list_placement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.lists where id = new.list_id and user_id = new.user_id
  ) then
    raise exception 'List must belong to the placement user';
  end if;
  if not exists (
    select 1 from public.tasks t
    where t.id = new.task_id and (
      (t.project_id is null and t.created_by = new.user_id)
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = t.project_id and pm.user_id = new.user_id
      )
    )
  ) then
    raise exception 'Task is not accessible to the placement user';
  end if;
  return new;
end;
$$;

create trigger task_list_placements_validate
before insert or update on public.task_list_placements
for each row execute function public.validate_task_list_placement();

create or replace function public.protect_comment_author()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    new.task_id <> old.task_id or new.user_id <> old.user_id
    or new.created_at <> old.created_at
  ) then
    raise exception 'Comment identity fields are immutable';
  end if;
  if tg_op = 'UPDATE' and new.content is distinct from old.content and new.edited_at is null then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger task_comments_protect_author
before update on public.task_comments
for each row execute function public.protect_comment_author();

create or replace function public.validate_project_document_parent()
returns trigger language plpgsql set search_path = '' as $$
declare parent_project uuid;
begin
  if new.parent_id is not null then
    select project_id into parent_project from public.project_documents where id = new.parent_id;
    if parent_project is distinct from new.project_id then
      raise exception 'Parent document must belong to the same project';
    end if;
  end if;
  if tg_op = 'UPDATE' and (
    new.project_id <> old.project_id or new.created_by <> old.created_by
    or new.created_at <> old.created_at
  ) then
    raise exception 'Document project, creator, and creation time are immutable';
  end if;
  return new;
end;
$$;

create trigger project_documents_validate_parent
before insert or update on public.project_documents
for each row execute function public.validate_project_document_parent();
