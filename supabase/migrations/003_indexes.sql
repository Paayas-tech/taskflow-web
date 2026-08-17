create index idx_project_members_user
  on public.project_members(user_id, project_id);

create index idx_projects_owner
  on public.projects(owner_id, status, updated_at desc);

create index idx_invitations_email
  on public.project_invitations(email_normalized, status);

create unique index idx_invitations_one_pending_per_email
  on public.project_invitations(project_id, email_normalized)
  where status = 'pending';

create index idx_tasks_project
  on public.tasks(project_id, column_id, position);

create index idx_tasks_status
  on public.tasks(project_id, status, due_date);

create index idx_tasks_creator_personal
  on public.tasks(created_by, status, due_date)
  where project_id is null;

create index idx_tasks_parent
  on public.tasks(parent_task_id)
  where parent_task_id is not null;

create index idx_tasks_assignee
  on public.task_assignments(user_id, task_id);

create index idx_lists_user_position
  on public.lists(user_id, position);

create index idx_task_list_placements_list
  on public.task_list_placements(list_id, user_id);

create index idx_comments_task
  on public.task_comments(task_id, created_at);

create index idx_activity_project
  on public.activity_events(project_id, created_at desc);

create index idx_activity_task
  on public.activity_events(task_id, created_at desc)
  where task_id is not null;

create index idx_documents_project
  on public.project_documents(project_id, parent_id, position);
