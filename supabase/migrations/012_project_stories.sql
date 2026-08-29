-- Stories are project-scoped work items that group ordinary project tasks.
-- They intentionally remain separate from parent_task_id, which represents
-- true task/subtask relationships.
alter table public.tasks
  add column if not exists work_type text not null default 'task',
  add column if not exists story_id uuid references public.tasks(id) on delete set null;

alter table public.tasks
  add constraint tasks_work_type_valid
    check (work_type in ('task', 'story')),
  add constraint tasks_story_scope_valid
    check (
      (work_type = 'story' and project_id is not null and story_id is null)
      or work_type = 'task'
    );

create index if not exists idx_tasks_project_story
  on public.tasks(project_id, story_id)
  where story_id is not null;

create index if not exists idx_tasks_project_work_type
  on public.tasks(project_id, work_type, created_at desc)
  where project_id is not null;

create or replace function public.validate_task_story()
returns trigger language plpgsql set search_path = '' as $$
declare linked_project uuid; linked_type text;
begin
  if new.story_id is null then return new; end if;
  select project_id, work_type
    into linked_project, linked_type
    from public.tasks
    where id = new.story_id;
  if linked_type is distinct from 'story' then
    raise exception 'Tasks may only be linked to a story';
  end if;
  if linked_project is distinct from new.project_id then
    raise exception 'Story and task must belong to the same project';
  end if;
  return new;
end;
$$;

create trigger tasks_validate_story
before insert or update of story_id, project_id, work_type on public.tasks
for each row execute function public.validate_task_story();
