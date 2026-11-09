create table mirpanel_community.api_integration_drafts (
  id uuid primary key,
  details jsonb not null,
  key_cipher text,
  reason text not null,
  updated_at timestamptz not null default now()
);
alter table mirpanel_community.api_integration_drafts enable row level security;
revoke all on mirpanel_community.api_integration_drafts from public, anon, authenticated;
