create table mirpanel_community.epinby_connection (
  id boolean primary key default true check(id),
  api_key_cipher text,
  webhook_secret_cipher text,
  credential_version bigint not null default 0,
  last_attempt_at timestamptz,
  last_attempt_status text,
  last_checked_at timestamptz,
  last_status text,
  balance text,
  currency text
);
alter table mirpanel_community.epinby_connection enable row level security;
revoke all on mirpanel_community.epinby_connection from public, anon, authenticated;
insert into mirpanel_community.epinby_connection(id) values(true);
