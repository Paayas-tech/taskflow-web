-- Apply to existing installations before starting the updated API.
alter table auth.users add column if not exists token_version bigint not null default 0;
