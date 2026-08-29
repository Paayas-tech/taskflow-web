-- New accounts start in light mode. Existing accounts that still carry the
-- former automatic default are migrated to light; explicit dark choices stay.
alter table public.user_settings
  alter column theme set default 'light';

update public.user_settings
set theme = 'light'
where theme = 'system';
