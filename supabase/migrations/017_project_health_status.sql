-- Phase 1 project overview: a manually maintained project health signal.
alter table public.projects
  add column if not exists health_status text not null default 'on_track';

alter table public.projects
  drop constraint if exists projects_health_status_valid;
alter table public.projects
  add constraint projects_health_status_valid check (
    health_status in ('on_track', 'at_risk', 'off_track', 'on_hold', 'complete')
  );

create or replace function public.set_project_health_status(
  target_project_id uuid,
  target_health_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare updated_health_status text;
begin
  if target_health_status not in ('on_track', 'at_risk', 'off_track', 'on_hold', 'complete') then
    raise exception 'Invalid project health status';
  end if;
  if not private.can_edit_project(target_project_id) then
    raise exception 'Project health can only be changed by an owner or editor' using errcode = '42501';
  end if;

  update public.projects
     set health_status = target_health_status
   where id = target_project_id
  returning health_status into updated_health_status;

  if updated_health_status is null then raise exception 'Project is unavailable'; end if;
  return updated_health_status;
end;
$$;

revoke all on function public.set_project_health_status(uuid, text) from public, anon;
grant execute on function public.set_project_health_status(uuid, text) to authenticated;
