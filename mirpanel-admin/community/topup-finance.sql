-- Reporting metadata only. Never credits/debits wallets or rewrites provider results.
create table if not exists mirpanel_community.topup_fee_tariffs (
 id text primary key, method text not null, basis_points integer not null check(basis_points between 0 and 10000),
 effective_at timestamptz not null, source text not null, recorded_at timestamptz not null default clock_timestamp(),
 unique(method,effective_at)
);
insert into mirpanel_community.topup_fee_tariffs(id,method,basis_points,effective_at,source)
 values('owner-apple-pay-20261123','apple-pay',300,'2026-11-23T00:00:00+04:00','Sahibin 23.11.2026 tapşırığı: Apple Pay üçün 3%; provayderin faktiki tutulması deyil') on conflict do nothing;
insert into mirpanel_community.topup_fee_tariffs(id,method,basis_points,effective_at,source) values
 ('owner-google-pay-20261123','google-pay',300,'2026-11-23T00:00:00+04:00','Sahibin bildirdiyi 3% tarif; provayderin faktiki xərc qeydi deyil'),
 ('owner-birbank-20261123','birbank',300,'2026-11-23T00:00:00+04:00','Sahibin bildirdiyi 3% tarif; provayderin faktiki xərc qeydi deyil') on conflict do nothing;
-- New m10 authorization only: no rewriting of older rates or payment facts.
insert into mirpanel_community.topup_fee_tariffs(id,method,basis_points,effective_at,source)
 values('owner-m10-20261127','m10',300,'2026-11-27T00:48:49.667+04:00','Sahibin 27.11.2026 təsdiqlədiyi m10 3% provayder xərci; müştəriyə əlavə haqq deyil; provayderin faktiki tutulması kimi təqdim edilmir') on conflict do nothing;
-- An optional, evidence-backed finance journal. Each provider event is unique;
-- refunds and fee reversals are separate facts, not inferred wallet debits.
create table if not exists mirpanel_community.topup_finance_facts (
 source text not null check(source in ('epoint','card-to-card')), operation_id uuid not null,
 event_id text not null, kind text not null check(kind in ('fee','refund','fee_refund')),
 cents bigint not null check(cents between 0 and 9007199254740991), currency text not null default 'AZN' check(currency='AZN'),
 occurred_at timestamptz not null, evidence text not null check(length(trim(evidence))>0),
 recorded_at timestamptz not null default clock_timestamp(), primary key(source,event_id)
);
create index if not exists topup_finance_operation on mirpanel_community.topup_finance_facts(source,operation_id);
create or replace function mirpanel_community.topup_finance_immutable() returns trigger language plpgsql as $$begin raise exception 'TOPUP_FINANCE_IMMUTABLE';end$$;
drop trigger if exists topup_fee_tariffs_immutable on mirpanel_community.topup_fee_tariffs;
create trigger topup_fee_tariffs_immutable before update or delete or truncate on mirpanel_community.topup_fee_tariffs for each statement execute function mirpanel_community.topup_finance_immutable();
drop trigger if exists topup_finance_facts_immutable on mirpanel_community.topup_finance_facts;
create trigger topup_finance_facts_immutable before update or delete or truncate on mirpanel_community.topup_finance_facts for each statement execute function mirpanel_community.topup_finance_immutable();
alter table mirpanel_community.topup_fee_tariffs enable row level security;
alter table mirpanel_community.topup_finance_facts enable row level security;
revoke all on mirpanel_community.topup_fee_tariffs,mirpanel_community.topup_finance_facts from public,anon,authenticated;
