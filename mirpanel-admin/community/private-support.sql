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
-- An authenticated account may adopt its own guest conversation while retaining
-- another existing conversation. Start remains serialized by identity lock.
drop index if exists mirpanel_community.support_open_user;
create index if not exists support_user_history on mirpanel_community.support_threads(user_id,updated_at desc);
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
alter table mirpanel_community.support_messages add column if not exists reply_to uuid references mirpanel_community.support_messages(id);
create table if not exists mirpanel_community.support_files(
 id uuid primary key,thread_id uuid not null references mirpanel_community.support_threads(id),client_id uuid not null,
 uploader text not null,mime text not null,name text not null,sha text not null,bytes bytea not null,
 created_at timestamptz not null default now(),unique(thread_id,uploader,client_id),check(octet_length(bytes)<=5242880));
alter table mirpanel_community.support_messages add column if not exists attachment_id uuid references mirpanel_community.support_files(id);
alter table mirpanel_community.support_files enable row level security;
revoke all on mirpanel_community.support_files from public,anon,authenticated;
create table if not exists mirpanel_community.support_guest_usage(guest_hash text primary key,first_message uuid,user_id text references mirpanel_community."user"(id),created_at timestamptz not null default now());
alter table mirpanel_community.support_guest_usage enable row level security;
revoke all on mirpanel_community.support_guest_usage from public,anon,authenticated;
insert into mirpanel_community.support_guest_usage(guest_hash,first_message)
select distinct on(t.guest_hash) t.guest_hash,m.id from mirpanel_community.support_threads t join mirpanel_community.support_messages m on m.thread_id=t.id where t.guest_hash is not null and m.sender='customer' and m.body not in('Ödəniş problemi','Sifarişim və təhvil','Qeydiyyat kodu gəlmir','Hesabda problem / əvəzləmə','Digər sual','Canlı əməkdaşa qoşulmaq istəyirəm.') order by t.guest_hash,m.seq on conflict do nothing;
commit;
