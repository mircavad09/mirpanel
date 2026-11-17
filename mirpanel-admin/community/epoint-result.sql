create table if not exists mirpanel_community.epoint_wallet_intents (
 id uuid primary key,
 user_id text not null references mirpanel_community."user"(id),
 cents bigint not null check(cents between 100 and 50000),
 provider_transaction text not null unique check(length(provider_transaction) between 1 and 128),
 status text not null default 'new' check(status in ('new','success','failed','error','server_error','returned')),
 created_at timestamptz not null default clock_timestamp(),
 credited_at timestamptz,
 check ((status='success')=(credited_at is not null))
);
alter table mirpanel_community.epoint_wallet_intents enable row level security;
revoke all on mirpanel_community.epoint_wallet_intents from public,anon,authenticated;
