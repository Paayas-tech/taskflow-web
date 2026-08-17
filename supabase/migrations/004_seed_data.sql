-- Deterministic fixtures for the isolated Stage 2 development database.
-- These UUIDs and addresses are synthetic and are not production credentials.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000101',
    'authenticated',
    'authenticated',
    'owner@taskflow.local',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Test Owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000102',
    'authenticated',
    'authenticated',
    'editor@taskflow.local',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Test Editor"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000103',
    'authenticated',
    'authenticated',
    'viewer@taskflow.local',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Test Viewer"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000104',
    'authenticated',
    'authenticated',
    'outsider@taskflow.local',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Test Outsider"}'::jsonb,
    now(),
    now()
  );

insert into public.projects (
  id, owner_id, name, description, color, status, due_date
)
values (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  'TaskFlow launch',
  'Synthetic project used to verify collaboration and Kanban behavior.',
  '#6d5dfc',
  'active',
  current_date + 30
);

insert into public.project_members (project_id, user_id, role, added_by)
values
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000102',
    'editor',
    '00000000-0000-0000-0000-000000000101'
  ),
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000103',
    'viewer',
    '00000000-0000-0000-0000-000000000101'
  );

insert into public.project_invitations (
  id, project_id, email, email_normalized, role, inviter_id, token_hash, expires_at
)
values (
  '00000000-0000-0000-0000-000000000801',
  '00000000-0000-0000-0000-000000000201',
  'outsider@taskflow.local',
  'outsider@taskflow.local',
  'viewer',
  '00000000-0000-0000-0000-000000000101',
  'local-fixture-token-hash',
  now() + interval '7 days'
);

insert into public.project_columns (
  id, project_id, name, category, position, is_terminal
)
values
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    'To do',
    'todo',
    0,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000201',
    'In progress',
    'in_progress',
    1,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000201',
    'Done',
    'done',
    2,
    true
  );

insert into public.tasks (
  id, project_id, created_by, title, description, priority, status,
  column_id, due_date, position, completed_at
)
values
  (
    '00000000-0000-0000-0000-000000000401',
    null,
    '00000000-0000-0000-0000-000000000101',
    'Review personal inbox',
    'Personal task fixture',
    'medium',
    'todo',
    null,
    current_date,
    0,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    'Define launch checklist',
    'Project task fixture',
    'high',
    'in_progress',
    '00000000-0000-0000-0000-000000000302',
    current_date + 2,
    0,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000102',
    'Create project structure',
    'Completed project task fixture',
    'low',
    'done',
    '00000000-0000-0000-0000-000000000303',
    current_date - 1,
    0,
    now()
  );

insert into public.lists (id, user_id, name, color, position)
values (
  '00000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000101',
  'Personal',
  '#8b7cf6',
  0
);

insert into public.task_list_placements (task_id, list_id, user_id)
values (
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000101'
);

insert into public.task_assignments (id, task_id, user_id)
values (
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000102'
);

insert into public.task_comments (id, task_id, user_id, content)
values (
  '00000000-0000-0000-0000-000000000701',
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000102',
  'The launch checklist is ready for review.'
);

insert into public.activity_events (
  id, project_id, task_id, user_id, event_type, metadata
)
values (
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000102',
  'task.updated',
  '{"field":"status","from":"todo","to":"in_progress"}'::jsonb
);

insert into public.project_documents (
  id, project_id, title, content, position, created_by
)
values (
  '00000000-0000-0000-0000-000000000a01',
  '00000000-0000-0000-0000-000000000201',
  'Launch notes',
  'Synthetic knowledge document for local schema verification.',
  0,
  '00000000-0000-0000-0000-000000000101'
);

do $$
begin
  if (select count(*) from public.users) <> 4 then
    raise exception 'Seed verification failed: expected four users';
  end if;
  if (select count(*) from public.project_members where project_id = '00000000-0000-0000-0000-000000000201') <> 3 then
    raise exception 'Seed verification failed: owner membership trigger or member fixtures failed';
  end if;
  if (select count(*) from public.tasks) <> 3 then
    raise exception 'Seed verification failed: expected three tasks';
  end if;
end;
$$;
