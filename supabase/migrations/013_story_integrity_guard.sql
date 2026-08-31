-- Protect existing task-to-Story relationships from changes made to the
-- referenced Story row. Task-side validation is defined in migration 012;
-- this guard covers updates initiated from the Story side.
create or replace function public.guard_linked_story_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.tasks as linked_task
    where linked_task.story_id = old.id
  ) then
    if new.work_type is distinct from old.work_type then
      raise exception 'Cannot change Story type while tasks are linked to it.';
    end if;

    if new.project_id is distinct from old.project_id then
      raise exception 'Cannot change Story project while tasks are linked to it.';
    end if;
  end if;

  return new;
end;
$$;

-- Recreating the trigger makes this migration safe to reapply during local
-- development while keeping production behavior deterministic.
drop trigger if exists tasks_guard_linked_story_changes on public.tasks;

create trigger tasks_guard_linked_story_changes
before update of work_type, project_id on public.tasks
for each row
when (
  old.work_type = 'story'
  and (
    new.work_type is distinct from old.work_type
    or new.project_id is distinct from old.project_id
  )
)
execute function public.guard_linked_story_changes();
