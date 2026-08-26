-- Phase 5: single task assignees, comments/activity automation, and notifications.

alter table public.task_assignments
  drop constraint if exists task_assignments_task_id_user_id_key;
alter table public.task_assignments
  add constraint task_assignments_one_assignee_per_task unique (task_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  type text not null check (type in ('task_assigned', 'comment_added', 'mentioned')),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_data_object check (jsonb_typeof(data) = 'object')
);

create index idx_notifications_user_unread
  on public.notifications(user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, update, delete on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications
for delete to authenticated using (user_id = auth.uid());

create or replace function public.set_task_assignee(
  target_task_id uuid,
  target_user_id uuid default null
)
returns public.task_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  assignment public.task_assignments;
begin
  select project_id into target_project_id
  from public.tasks
  where id = target_task_id;

  if target_project_id is null then
    raise exception 'Only project tasks may be assigned';
  end if;
  if not private.can_edit_project(target_project_id, auth.uid()) then
    raise exception 'Only project owners and editors may assign tasks'
      using errcode = '42501';
  end if;
  if target_user_id is not null and not private.is_project_member(target_project_id, target_user_id) then
    raise exception 'Assignee must be a project member';
  end if;

  delete from public.task_assignments where task_id = target_task_id;
  if target_user_id is null then return null; end if;

  insert into public.task_assignments (task_id, user_id)
  values (target_task_id, target_user_id)
  returning * into assignment;
  return assignment;
end;
$$;

revoke all on function public.set_task_assignee(uuid, uuid) from public, anon;
grant execute on function public.set_task_assignee(uuid, uuid) to authenticated;

create or replace function public.cleanup_removed_member_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.task_assignments assignment
  using public.tasks task
  where assignment.task_id = task.id
    and task.project_id = old.project_id
    and assignment.user_id = old.user_id;
  return old;
end;
$$;

create trigger project_members_cleanup_assignment
before delete on public.project_members
for each row execute function public.cleanup_removed_member_assignment();

create or replace function public.record_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare event_name text;
begin
  if new.project_id is null then return new; end if;
  if tg_op = 'INSERT' then
    event_name := 'task_created';
  elsif new.status is distinct from old.status then
    event_name := case when new.status = 'done' then 'task_completed' else 'task_status_changed' end;
  else
    event_name := 'task_updated';
  end if;

  insert into public.activity_events (project_id, task_id, user_id, event_type, metadata)
  values (
    new.project_id,
    new.id,
    coalesce(auth.uid(), new.created_by),
    event_name,
    jsonb_build_object('taskTitle', new.title, 'status', new.status)
  );
  return new;
end;
$$;

create trigger tasks_record_activity
after insert or update on public.tasks
for each row execute function public.record_task_activity();

create or replace function public.record_assignment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.task_assignments;
  target_project_id uuid;
  task_title text;
begin
  assignment_row := case when tg_op = 'DELETE' then old else new end;
  select project_id, title into target_project_id, task_title
  from public.tasks where id = assignment_row.task_id;

  -- Cascading task/project deletion may remove the task before this child
  -- trigger runs. There is no surviving activity scope in that case.
  if target_project_id is null or not exists (
    select 1 from public.projects where id = target_project_id
  ) then return assignment_row; end if;

  insert into public.activity_events (project_id, task_id, user_id, event_type, metadata)
  values (
    target_project_id,
    assignment_row.task_id,
    auth.uid(),
    case when tg_op = 'DELETE' then 'task_unassigned' else 'task_assigned' end,
    jsonb_build_object('taskTitle', task_title, 'assigneeId', assignment_row.user_id)
  );

  if tg_op = 'INSERT' and assignment_row.user_id is distinct from auth.uid() then
    insert into public.notifications (user_id, project_id, task_id, type, data)
    values (
      assignment_row.user_id,
      target_project_id,
      assignment_row.task_id,
      'task_assigned',
      jsonb_build_object('taskTitle', task_title, 'actorId', auth.uid())
    );
  end if;
  return assignment_row;
end;
$$;

create trigger task_assignments_record_activity
after insert or delete on public.task_assignments
for each row execute function public.record_assignment_activity();

create or replace function public.record_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  comment_row public.task_comments;
  target_project_id uuid;
  task_title text;
  task_creator uuid;
  assignee_id uuid;
  mentioned_id uuid;
  event_name text;
begin
  comment_row := case when tg_op = 'DELETE' then old else new end;
  select project_id, title, created_by
  into target_project_id, task_title, task_creator
  from public.tasks where id = comment_row.task_id;

  -- A task cascade owns the deletion lifecycle; do not create orphaned
  -- activity or notifications after its project scope has disappeared.
  if target_project_id is null or not exists (
    select 1 from public.projects where id = target_project_id
  ) then return comment_row; end if;
  select user_id into assignee_id
  from public.task_assignments where task_id = comment_row.task_id;

  event_name := case
    when tg_op = 'INSERT' then 'comment_added'
    when tg_op = 'UPDATE' then 'comment_updated'
    else 'comment_deleted'
  end;
  insert into public.activity_events (project_id, task_id, user_id, event_type, metadata)
  values (
    target_project_id,
    comment_row.task_id,
    comment_row.user_id,
    event_name,
    jsonb_build_object('taskTitle', task_title, 'commentId', comment_row.id)
  );

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, project_id, task_id, type, data)
    select recipient_id, target_project_id, comment_row.task_id, 'comment_added',
      jsonb_build_object('taskTitle', task_title, 'actorId', comment_row.user_id)
    from (
      select task_creator as recipient_id
      union select assignee_id
    ) recipients
    where recipient_id is not null and recipient_id <> comment_row.user_id;

    for mentioned_id in
      select distinct (match[1])::uuid
      from regexp_matches(
        comment_row.content,
        '@([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
        'g'
      ) as match
    loop
      if mentioned_id <> comment_row.user_id
         and private.is_project_member(target_project_id, mentioned_id) then
        insert into public.notifications (user_id, project_id, task_id, type, data)
        values (
          mentioned_id,
          target_project_id,
          comment_row.task_id,
          'mentioned',
          jsonb_build_object('taskTitle', task_title, 'actorId', comment_row.user_id)
        );
      end if;
    end loop;
  end if;
  return comment_row;
end;
$$;

create trigger task_comments_record_activity
after insert or update or delete on public.task_comments
for each row execute function public.record_comment_activity();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'notifications'
  ) then alter publication supabase_realtime add table public.notifications; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'task_comments'
  ) then alter publication supabase_realtime add table public.task_comments; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'activity_events'
  ) then alter publication supabase_realtime add table public.activity_events; end if;
end;
$$;
