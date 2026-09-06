begin;

-- A reservation consumes one daily slot; it must not make the whole method
-- unavailable while another slot remains. All queue mutations share the
-- existing transaction lock so capacity checks and reservation inserts remain
-- atomic across concurrent application instances.
create or replace function public.refresh_payment_method_automation()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_day date:=public.payment_baku_date();
  v_seeded boolean:=false;
  v_target text;
  v_next public.payment_methods%rowtype;
  v_selected uuid[]:='{}'::uuid[];
  v_active_count integer:=0;
begin
  perform pg_advisory_xact_lock(714025001);
  perform public.expire_payment_reservations_raw();
  perform id from public.payment_methods order by id for update;
  insert into public.payment_method_activation_days(usage_day)
    values(v_day) on conflict do nothing returning true into v_seeded;

  foreach v_target in array array['m10','abb','leo','kapital'] loop
    select m.* into v_next
      from public.payment_methods m
     where m.archived=false and m.deleted_at is null and not m.manual_disabled
       and m.encrypted_number is not null and m.id<>all(v_selected)
       and (case
         when lower(coalesce(m.provider_name,'')||' '||coalesce(m.display_name,'')) like '%m10%' then 'm10'
         when lower(coalesce(m.provider_name,'')||' '||coalesce(m.display_name,'')) like '%leo%' then 'leo'
         when lower(coalesce(m.provider_name,'')||' '||coalesce(m.display_name,'')) like '%abb%' then 'abb'
         when lower(coalesce(m.provider_name,'')||' '||coalesce(m.display_name,'')) like '%kapital%' then 'kapital'
         else 'other' end)=v_target
       and (m.limit_mode='unlimited' or
         coalesce((select c.confirmed_count from public.payment_method_daily_counters c
                    where c.method_id=m.id and c.counter_date=v_day),0) +
         (select count(*) from public.payment_reservations r
           where r.method_id=m.id and r.usage_day=v_day
             and (r.status='reviewing' or (r.status='reserved' and r.expires_at>now()))) < m.daily_limit)
     order by m.sort_order,m.created_at,m.id limit 1;
    if found then v_selected:=array_append(v_selected,v_next.id); end if;
  end loop;

  while coalesce(cardinality(v_selected),0)<4 loop
    select m.* into v_next
      from public.payment_methods m
     where m.archived=false and m.deleted_at is null and not m.manual_disabled
       and m.encrypted_number is not null and m.id<>all(v_selected)
       and (m.limit_mode='unlimited' or
         coalesce((select c.confirmed_count from public.payment_method_daily_counters c
                    where c.method_id=m.id and c.counter_date=v_day),0) +
         (select count(*) from public.payment_reservations r
           where r.method_id=m.id and r.usage_day=v_day
             and (r.status='reviewing' or (r.status='reserved' and r.expires_at>now()))) < m.daily_limit)
     order by m.sort_order,m.created_at,m.id limit 1;
    exit when not found;
    v_selected:=array_append(v_selected,v_next.id);
  end loop;

  update public.payment_methods m
     set active=(m.id=any(v_selected)),
         deactivated_at=case when m.id=any(v_selected) then null else coalesce(m.deactivated_at,now()) end,
         updated_at=case when m.active is distinct from (m.id=any(v_selected)) then now() else m.updated_at end
   where m.archived=false and m.deleted_at is null and not m.manual_disabled
     and m.active is distinct from (m.id=any(v_selected));

  insert into public.payment_method_daily_activations(usage_day,method_id)
    select v_day,unnest(v_selected) on conflict do nothing;
  select count(*) into v_active_count from public.payment_methods
   where active and archived=false and deleted_at is null and not manual_disabled;
  return jsonb_build_object('usageDay',v_day,'seeded',coalesce(v_seeded,false),
    'activeCount',v_active_count,'promotions',greatest(0,v_active_count));
end;
$$;

create or replace function public.payment_method_queue_snapshot(
  p_include_archived boolean default false,p_include_deleted boolean default false
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_day date:=public.payment_baku_date();v_result jsonb;
begin
  perform public.refresh_payment_method_automation();
  with queue_rows as (
    select m.*,a.activated_at,coalesce(c.confirmed_count,0) as confirmed_count,
      (select count(*) from public.payment_reservations r
        where r.method_id=m.id and r.usage_day=v_day
          and r.status='reserved' and r.expires_at>now()) as active_reservations,
      (select count(*) from public.payment_reservations r
        where r.method_id=m.id and r.usage_day=v_day and r.status='reviewing') as reviewing_receipts
    from public.payment_methods m
    left join public.payment_method_daily_counters c on c.method_id=m.id and c.counter_date=v_day
    left join public.payment_method_daily_activations a on a.method_id=m.id and a.usage_day=v_day
    where (p_include_archived or not m.archived) and (p_include_deleted or m.deleted_at is null)
  )
  select coalesce(jsonb_agg(to_jsonb(q)-'activated_at'-'confirmed_count'-'active_reservations'-'reviewing_receipts'||jsonb_build_object(
    'activated_today',q.activated_at is not null,
    'queue_activated_at',q.activated_at,
    'queue_stats',jsonb_build_object('confirmed',q.confirmed_count,'activeReservations',q.active_reservations,
      'reviewingReceipts',q.reviewing_receipts,'lastResetAt',v_day::timestamp at time zone 'Asia/Baku',
      'nextResetAt',(v_day+1)::timestamp at time zone 'Asia/Baku')) order by
      case when q.active then 0
           when q.limit_mode='limited' and q.confirmed_count<q.daily_limit
             and q.confirmed_count+q.active_reservations+q.reviewing_receipts>=q.daily_limit then 1
           when q.limit_mode='limited' and q.confirmed_count>=q.daily_limit then 2
           else 3 end,
      q.sort_order,q.created_at,q.id),'[]'::jsonb) into v_result from queue_rows q;
  return v_result;
end;
$$;

create or replace function public.reserve_payment_method_v3(
  p_method_id uuid,p_product_id text,p_plan_id text,p_amount numeric,p_currency text,
  p_idempotency_key uuid,p_checkout_key uuid,p_previous_reservation_id uuid default null,p_minutes integer default 10
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;v_method public.payment_methods%rowtype;v_confirmed integer;v_pending integer;v_day date:=public.payment_baku_date();
begin
  perform pg_advisory_xact_lock(714025001);
  perform public.refresh_payment_method_automation();
  if not exists(select 1 from public.payment_reservations where idempotency_key=p_idempotency_key) then
    select * into v_method from public.payment_methods where id=p_method_id for update;
    if not found or not v_method.active or v_method.manual_disabled or v_method.archived or v_method.deleted_at is not null then raise exception 'PAYMENT_METHOD_UNAVAILABLE'; end if;
    select coalesce((select confirmed_count from public.payment_method_daily_counters
      where method_id=p_method_id and counter_date=v_day),0) into v_confirmed;
    select count(*) into v_pending from public.payment_reservations
     where method_id=p_method_id and usage_day=v_day
       and status in('reserved','reviewing') and (status='reviewing' or expires_at>now())
       and not(id is not distinct from p_previous_reservation_id and checkout_key is not distinct from p_checkout_key and status='reserved');
    if v_method.limit_mode='limited' and v_confirmed>=v_method.daily_limit then raise exception 'PAYMENT_METHOD_LIMIT_REACHED'; end if;
    if v_method.limit_mode='limited' and v_confirmed+v_pending>=v_method.daily_limit then raise exception 'PAYMENT_METHOD_TEMPORARILY_BUSY'; end if;
  end if;
  v_result:=public.reserve_payment_method_v2(p_method_id,p_product_id,p_plan_id,p_amount,p_currency,
    p_idempotency_key,p_checkout_key,p_previous_reservation_id,p_minutes);
  perform public.refresh_payment_method_automation();
  return v_result;
end;
$$;

revoke execute on function public.refresh_payment_method_automation(),public.payment_method_queue_snapshot(boolean,boolean),
  public.reserve_payment_method_v3(uuid,text,text,numeric,text,uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.refresh_payment_method_automation(),public.payment_method_queue_snapshot(boolean,boolean),
  public.reserve_payment_method_v3(uuid,text,text,numeric,text,uuid,uuid,uuid,integer) to service_role;

commit;
