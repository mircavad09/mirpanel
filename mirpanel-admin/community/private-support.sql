begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(92700111);
create table if not exists mirpanel_community.support_bot_config(
 id boolean primary key default true check(id), version integer not null default 1,
 topics jsonb not null,updated_by text,updated_at timestamptz not null default now());
create table if not exists mirpanel_community.support_threads(
 id uuid primary key,user_id text references mirpanel_community."user"(id),guest_hash text,
 status text not null default 'new' check(status in('new','waiting','in_progress','closed')),
 mode text not null default 'bot' check(mode in('bot','waiting','agent','closed')),
 assigned_to text references mirpanel_community."user"(id),used_topics text[] not null default '{}',
 customer_read_seq bigint not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((user_id is not null and guest_hash is null) or (user_id is null and guest_hash ~ '^[a-f0-9]{64}$')));
create unique index if not exists support_open_user on mirpanel_community.support_threads(user_id) where status<>'closed' and user_id is not null;
create unique index if not exists support_open_guest on mirpanel_community.support_threads(guest_hash) where status<>'closed' and guest_hash is not null;
create table if not exists mirpanel_community.support_messages(
 seq bigserial primary key,id uuid not null unique,thread_id uuid not null references mirpanel_community.support_threads(id),
 client_id uuid not null,sender text not null check(sender in('customer','bot','staff','system')),
 actor_id text references mirpanel_community."user"(id),body text not null check(length(body) between 1 and 2000),
 request_hash text,created_at timestamptz not null default now(),unique(thread_id,client_id,sender));
create index if not exists support_message_thread on mirpanel_community.support_messages(thread_id,seq);
create index if not exists support_thread_queue on mirpanel_community.support_threads(status,updated_at desc);
create table if not exists mirpanel_community.support_staff_reads(
 thread_id uuid not null references mirpanel_community.support_threads(id),actor_id text not null references mirpanel_community."user"(id),
 last_seq bigint not null default 0,primary key(thread_id,actor_id));
create table if not exists mirpanel_community.support_actions(
 id uuid primary key,thread_id uuid not null references mirpanel_community.support_threads(id),actor_id text not null references mirpanel_community."user"(id),
 kind text not null,target_id text,created_at timestamptz not null default now());
alter table mirpanel_community.support_bot_config enable row level security;
alter table mirpanel_community.support_threads enable row level security;
alter table mirpanel_community.support_messages enable row level security;
alter table mirpanel_community.support_staff_reads enable row level security;
alter table mirpanel_community.support_actions enable row level security;
revoke all on mirpanel_community.support_bot_config,mirpanel_community.support_threads,mirpanel_community.support_messages,mirpanel_community.support_staff_reads,mirpanel_community.support_actions from public,anon,authenticated;
revoke all on sequence mirpanel_community.support_messages_seq_seq from public,anon,authenticated;
commit;
