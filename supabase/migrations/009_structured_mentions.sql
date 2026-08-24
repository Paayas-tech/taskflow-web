-- Accept structured mention tokens while preserving legacy @UUID comments.
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
    target_project_id, comment_row.task_id, comment_row.user_id, event_name,
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
      select distinct coalesce(match[1], match[2])::uuid
      from regexp_matches(
        comment_row.content,
        '@\[[^]]*\]\(user:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)|@([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
        'g'
      ) as match
    loop
      if mentioned_id <> comment_row.user_id
         and private.is_project_member(target_project_id, mentioned_id) then
        insert into public.notifications (user_id, project_id, task_id, type, data)
        values (
          mentioned_id, target_project_id, comment_row.task_id, 'mentioned',
          jsonb_build_object('taskTitle', task_title, 'actorId', comment_row.user_id)
        );
      end if;
    end loop;
  end if;
  return comment_row;
end;
$$;
