begin;
set local lock_timeout='5s';
alter table mirpanel_community.wallet_topups add column if not exists rejection_reason text;

create or replace function mirpanel_community.enqueue_topup_rejection_mail() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if old.status='reviewing' and new.status='rejected' and new.rejection_reason is not null
    and exists(select 1 from mirpanel_community.topup_mail_release where id and enabled) then
  insert into mirpanel_community.customer_order_mail(event_key,topup_id,topup_snapshot)
  values('topup-rejected:'||new.id,new.id,jsonb_build_object(
    'number',new.history_number::text,'cents',new.requested_cents::text,
    'submittedDate',to_char(new.submitted_at at time zone 'Asia/Baku','DD.MM.YYYY'),'reason',new.rejection_reason))
  on conflict(event_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function mirpanel_community.enqueue_topup_rejection_mail() from public,anon,authenticated;
drop trigger if exists enqueue_topup_rejection_mail on mirpanel_community.wallet_topups;
create trigger enqueue_topup_rejection_mail after update of status on mirpanel_community.wallet_topups
 for each row execute function mirpanel_community.enqueue_topup_rejection_mail();
commit;
