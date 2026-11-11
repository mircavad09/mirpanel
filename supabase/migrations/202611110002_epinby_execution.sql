begin;
create table if not exists mirpanel_community.epinby_order_units (
 id uuid primary key default gen_random_uuid(),
 dispatch_id uuid not null references mirpanel_community.api_dispatches(id),
 unit_index integer not null check(unit_index>=0),
 body_cipher text not null,
 state text not null default 'queued' check(state in ('queued','checking','succeeded','delivered','failed')),
 external_id text unique,
 result_cipher text,
 reason text,
 next_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(dispatch_id,unit_index)
);
create table if not exists mirpanel_community.epinby_events (
 event_id text primary key,
 unit_id uuid references mirpanel_community.epinby_order_units,
 payload_cipher text not null,
 received_at timestamptz not null default now()
);
alter table mirpanel_community.epinby_order_units enable row level security;
alter table mirpanel_community.epinby_events enable row level security;
revoke all on mirpanel_community.epinby_order_units,mirpanel_community.epinby_events from public,anon,authenticated;
create index if not exists epinby_units_due on mirpanel_community.epinby_order_units(next_at) where state in ('queued','checking','succeeded');
commit;
