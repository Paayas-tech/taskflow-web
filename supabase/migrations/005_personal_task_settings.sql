-- Phase 2: preserve TaskFlow's existing personal task and settings behavior.

alter table public.tasks
  add column if not exists end_date date,
  add column if not exists end_time time,
  add column if not exists reminder_enabled boolean not null default false,
  add column if not exists reminder_at timestamptz;

alter table public.tasks
  add constraint tasks_end_time_requires_date
    check (end_time is null or end_date is not null),
  add constraint tasks_end_date_requires_due_date
    check (end_date is null or due_date is not null),
  add constraint tasks_date_range_valid
    check (end_date is null or due_date is null or end_date >= due_date),
  add constraint tasks_reminder_consistent
    check (
      (reminder_enabled and reminder_at is not null)
      or (not reminder_enabled and reminder_at is null)
    );

create index if not exists idx_tasks_personal_reminders
  on public.tasks(created_by, reminder_at)
  where project_id is null and reminder_enabled;

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  background text not null default 'calm',
  default_view text not null default 'dashboard',
  default_list_id uuid references public.lists(id) on delete set null,
  reminder_default_time integer not null default 15
    check (reminder_default_time between 1 and 1440),
  enable_browser_notifications boolean not null default true,
  enable_in_app_reminders boolean not null default true,
  enable_sound boolean not null default false,
  time_format text not null default '12_hour'
    check (time_format in ('12_hour', '24_hour')),
  date_format text not null default 'DD/MM/YYYY'
    check (date_format in ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  week_starts_on text not null default 'sunday'
    check (week_starts_on in ('sunday', 'monday', 'saturday')),
  locale text not null default 'en',
  timezone text not null default 'UTC',
  settings_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_user_settings_user
  on public.user_settings(user_id);

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

grant select, insert, update, delete on public.user_settings to authenticated;

create policy user_settings_select_own on public.user_settings
for select to authenticated using (user_id = auth.uid());

create policy user_settings_insert_own on public.user_settings
for insert to authenticated with check (user_id = auth.uid());

create policy user_settings_update_own on public.user_settings
for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_settings_delete_own on public.user_settings
for delete to authenticated using (user_id = auth.uid());
