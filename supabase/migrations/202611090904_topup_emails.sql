create table mirpanel_community.topup_mail_release(id boolean primary key check(id),enabled boolean not null default false);
insert into mirpanel_community.topup_mail_release values(true,false);
revoke all on mirpanel_community.topup_mail_release from public,anon,authenticated;
alter table mirpanel_community.customer_order_mail alter column order_id drop not null;
alter table mirpanel_community.customer_order_mail
 add column topup_id uuid references mirpanel_community.wallet_topups(id),
 add column topup_snapshot jsonb;
alter table mirpanel_community.customer_order_mail add constraint customer_mail_subject_reference check(num_nonnulls(order_id,topup_id)=1);

create function mirpanel_community.enqueue_topup_mail() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare snapshot jsonb; balance_after bigint;
begin
 if not exists(select 1 from mirpanel_community.topup_mail_release where id and enabled) then return new; end if;
 if new.status=old.status then return new; end if;
 if new.status='reviewing' and old.status='draft' and new.receipt is not null then
  snapshot:=jsonb_build_object('number',new.history_number::text,'cents',new.requested_cents::text);
  insert into mirpanel_community.customer_order_mail(event_key,topup_id,topup_snapshot)
   values('topup-received:'||new.id,new.id,snapshot) on conflict do nothing;
 elsif new.status='approved' and old.status='reviewing' then
  insert into mirpanel_community.customer_order_mail(event_key,topup_id,topup_snapshot)
   values('topup-received:'||new.id,new.id,jsonb_build_object('number',new.history_number::text,'cents',new.requested_cents::text))
   on conflict do nothing;
  select after_cents into balance_after from mirpanel_community.wallet_ledger
   where request_id=new.id and user_id=new.user_id and kind='topup_credit';
  if balance_after is null then raise exception 'TOPUP_CREDIT_REQUIRED'; end if;
  snapshot:=jsonb_build_object('number',new.history_number::text,'cents',new.approved_cents::text,'balance',balance_after::text);
  insert into mirpanel_community.customer_order_mail(event_key,topup_id,topup_snapshot)
   values('topup-approved:'||new.id,new.id,snapshot) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function mirpanel_community.enqueue_topup_mail() from public,anon,authenticated;
create trigger enqueue_topup_mail after update of status on mirpanel_community.wallet_topups
 for each row execute function mirpanel_community.enqueue_topup_mail();
