begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(926110201);
set local search_path=mirpanel_community,pg_catalog;
alter table wallet_ledger drop constraint if exists wallet_ledger_cents_check;
alter table wallet_ledger add constraint wallet_ledger_cents_check check(cents<>0);
alter table wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table wallet_ledger add constraint wallet_ledger_kind_check
  check(kind in ('admin_credit','admin_debit','topup_credit','purchase_debit','purchase_refund'));

create or replace function wallet_debit(p_actor text,p_user text,p_cents bigint,p_reason text,p_request uuid,p_expected bigint)
returns jsonb language plpgsql security definer set search_path=mirpanel_community,pg_catalog as $$
declare previous bigint; item wallet_ledger%rowtype;
begin
 if not exists(select 1 from wallet_release where id and enabled) then raise exception 'WALLET_DISABLED'; end if;
 if not exists(select 1 from owner_identity o join "user" u on u.id=o.user_id
    join account a on a."userId"=o.user_id and a."providerId"='google' and a."accountId"=o.google_subject
    join community_group_roles r on r.user_id=o.user_id and r.role='owner'
    where o.user_id=p_actor and u."emailVerified" and lower(u.email)='mircavad09@gmail.com')
 then raise exception 'WALLET_OWNER_REQUIRED'; end if;
 if p_cents is null or p_cents<=0 or p_cents>100000000 or p_expected is null or p_expected<0
    or p_request is null or p_user is null or p_reason is null or length(trim(p_reason)) not between 3 and 300
 then raise exception 'WALLET_INVALID_INPUT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor||p_request::text,0));
 select * into item from wallet_ledger where actor_id=p_actor and request_id=p_request;
 if found then
   if item.kind<>'admin_debit' or item.user_id<>p_user or item.cents<>-p_cents or item.reason<>trim(p_reason) or item.before_cents<>p_expected
   then raise exception 'WALLET_KEY_CONFLICT'; end if;
   return to_jsonb(item)||jsonb_build_object('idempotent',true);
 end if;
 select cents into previous from wallet_accounts where user_id=p_user for update;
 if coalesce(previous,0)<p_cents then raise exception 'WALLET_INSUFFICIENT'; end if;
 if previous<>p_expected then raise exception 'WALLET_BALANCE_CHANGED'; end if;
 update wallet_accounts set cents=previous-p_cents where user_id=p_user;
 insert into wallet_ledger(actor_id,user_id,request_id,cents,before_cents,after_cents,reason,kind)
 values(p_actor,p_user,p_request,-p_cents,previous,previous-p_cents,trim(p_reason),'admin_debit') returning * into item;
 return to_jsonb(item)||jsonb_build_object('idempotent',false);
end $$;
revoke all on function wallet_debit(text,text,bigint,text,uuid,bigint) from public;
commit;
