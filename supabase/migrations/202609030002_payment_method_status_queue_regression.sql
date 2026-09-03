begin;

-- Keep four durable queue slots, but never promote a standby card which is
-- carrying a live reservation/review. Saturated cards are replaced under the
-- same advisory lock used by reserve/approve/admin writers.
create or replace function public.refresh_payment_method_automation()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_day date := public.payment_baku_date();
  v_seeded boolean := false;
  v_source public.payment_methods%rowtype;
  v_next public.payment_methods%rowtype;
  v_source_provider text;
  v_is_m10 boolean;
  v_confirmed integer;
  v_active_count integer;
  v_promotions integer := 0;
  v_selected uuid[] := '{}'::uuid[];
begin
  perform pg_advisory_xact_lock(714025001);
  perform public.expire_payment_reservations();
  perform id from public.payment_methods order by id for update;
  insert into public.payment_method_activation_days(usage_day)
    values(v_day) on conflict do nothing returning true into v_seeded;

  if coalesce(v_seeded,false) then
    update public.payment_methods
       set active=false,
           deactivated_at=case when manual_disabled then coalesce(deactivated_at,now()) else now() end,
           updated_at=now()
     where archived=false and deleted_at is null;

    foreach v_source_provider in array array['m10','abb','leo','kapital'] loop
      select m.* into v_next
        from public.payment_methods m
       where m.archived=false and m.deleted_at is null and not m.manual_disabled
         and m.encrypted_number is not null and m.id<>all(v_selected)
         and (case
           when lower(coalesce(m.provider_name,'')||' '||coalesce(m.display_name,'')) like '%m10%' then 'm10'
           when lower(coalesce(m.provider_name,'')||' '||coalesce(m.display_name,'')) like '%leo%' then 'leo'
           when lower(coalesce(m.provider_name,'')||' '||coalesce(m.display_name,'')) like '%abb%' then 'abb'
           when lower(coalesce(m.provider_name,'')||' '||coalesce(m.display_name,'')) like '%kapital%' then 'kapital'
           else 'other' end)=v_source_provider
         and (m.limit_mode='unlimited' or coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id=m.id and c.counter_date=v_day),0)<m.daily_limit)
       order by m.sort_order,m.created_at,m.id limit 1;
      if found then
        update public.payment_methods set active=true,deactivated_at=null,updated_at=now() where id=v_next.id;
        v_selected:=array_append(v_selected,v_next.id);
        insert into public.payment_method_daily_activations(usage_day,method_id) values(v_day,v_next.id) on conflict do nothing;
      end if;
    end loop;

    while coalesce(cardinality(v_selected),0)<4 loop
      select m.* into v_next
        from public.payment_methods m
       where m.archived=false and m.deleted_at is null and not m.manual_disabled
         and m.encrypted_number is not null and m.id<>all(v_selected)
         and (m.limit_mode='unlimited' or coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id=m.id and c.counter_date=v_day),0)<m.daily_limit)
       order by m.sort_order,m.created_at,m.id limit 1;
      exit when not found;
      update public.payment_methods set active=true,deactivated_at=null,updated_at=now() where id=v_next.id;
      v_selected:=array_append(v_selected,v_next.id);
      insert into public.payment_method_daily_activations(usage_day,method_id) values(v_day,v_next.id) on conflict do nothing;
    end loop;
  else
    for v_source in
      select * from public.payment_methods
       where active=true and archived=false and deleted_at is null and not manual_disabled
         and encrypted_number is not null and limit_mode='limited'
       order by sort_order,created_at,id
    loop
      select coalesce((select c.confirmed_count from public.payment_method_daily_counters c
        where c.method_id=v_source.id and c.counter_date=v_day),0) into v_confirmed;
      if v_confirmed<v_source.daily_limit then continue; end if;

      v_source_provider:=lower(regexp_replace(trim(coalesce(v_source.provider_name,v_source.display_name,'')),'\s+',' ','g'));
      v_is_m10:=lower(coalesce(v_source.provider_name,'')||' '||coalesce(v_source.display_name,'')) like '%m10%';
      update public.payment_methods set active=false,deactivated_at=now(),updated_at=now() where id=v_source.id;

      -- Same normalized provider first. M10 has no same-bank standby rule and
      -- therefore selects randomly among otherwise eligible standby methods.
      select m.* into v_next
        from public.payment_methods m
       where m.archived=false and m.deleted_at is null and not m.manual_disabled
         and m.active=false and m.encrypted_number is not null and m.id<>v_source.id
         and (m.limit_mode='unlimited' or coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id=m.id and c.counter_date=v_day),0)<m.daily_limit)
         and not exists (
           select 1 from public.payment_reservations r
            where r.method_id=m.id and r.usage_day=v_day
              and (r.status='reviewing' or (r.status='reserved' and r.expires_at>now()))
         )
       order by
         case when not v_is_m10 and lower(regexp_replace(trim(coalesce(m.provider_name,m.display_name,'')),'\s+',' ','g'))=v_source_provider then 0 else 1 end,
         case when v_is_m10 then random() else 0 end,
         m.sort_order,m.created_at,m.id
       limit 1;
      if found then
        update public.payment_methods set active=true,deactivated_at=null,updated_at=now() where id=v_next.id;
        insert into public.payment_method_daily_activations(usage_day,method_id) values(v_day,v_next.id) on conflict do nothing;
        v_promotions:=v_promotions+1;
      end if;
    end loop;

    update public.payment_methods m set active=false,deactivated_at=now(),updated_at=now()
     where m.active and m.id not in (
       select id from public.payment_methods
        where active and archived=false and deleted_at is null and not manual_disabled
        order by sort_order,created_at,id limit 4
     );

    select count(*) into v_active_count from public.payment_methods
      where active and archived=false and deleted_at is null and not manual_disabled;
    while v_active_count<4 loop
      select m.* into v_next
        from public.payment_methods m
       where m.archived=false and m.deleted_at is null and not m.manual_disabled
         and m.active=false and m.encrypted_number is not null
         and (m.limit_mode='unlimited' or coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id=m.id and c.counter_date=v_day),0)<m.daily_limit)
         and not exists (
           select 1 from public.payment_reservations r
            where r.method_id=m.id and r.usage_day=v_day
              and (r.status='reviewing' or (r.status='reserved' and r.expires_at>now()))
         )
       order by m.sort_order,m.created_at,m.id limit 1;
      exit when not found;
      update public.payment_methods set active=true,deactivated_at=null,updated_at=now() where id=v_next.id;
      insert into public.payment_method_daily_activations(usage_day,method_id) values(v_day,v_next.id) on conflict do nothing;
      v_active_count:=v_active_count+1;
      v_promotions:=v_promotions+1;
    end loop;
  end if;

  select count(*) into v_active_count from public.payment_methods where active and archived=false and deleted_at is null;
  return jsonb_build_object('usageDay',v_day,'seeded',coalesce(v_seeded,false),'activeCount',v_active_count,'promotions',v_promotions);
end;
$$;

-- The snapshot itself is authoritative for checkout order: selectable active,
-- temporarily busy, saturated, then non-operational/admin rows.
create or replace function public.payment_method_queue_snapshot(
  p_include_archived boolean default false,p_include_deleted boolean default false
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_day date:=public.payment_baku_date();v_result jsonb;
begin
  perform public.refresh_payment_method_automation();
  with queue_rows as (
    select m.*,a.activated_at,coalesce(c.confirmed_count,0) as confirmed_count,
      (select count(*) from public.payment_reservations r where r.method_id=m.id and r.usage_day=v_day and r.status='reserved' and r.expires_at>now()) as active_reservations,
      (select count(*) from public.payment_reservations r where r.method_id=m.id and r.usage_day=v_day and r.status='reviewing') as reviewing_receipts
    from public.payment_methods m
    left join public.payment_method_daily_counters c on c.method_id=m.id and c.counter_date=v_day
    left join public.payment_method_daily_activations a on a.method_id=m.id and a.usage_day=v_day
    where (p_include_archived or not m.archived) and (p_include_deleted or m.deleted_at is null)
  )
  select coalesce(jsonb_agg(to_jsonb(q)-'activated_at'-'confirmed_count'-'active_reservations'-'reviewing_receipts'||jsonb_build_object(
    'activated_today',q.activated_at is not null,
    'queue_activated_at',q.activated_at,
    'queue_stats',jsonb_build_object(
      'confirmed',q.confirmed_count,
      'activeReservations',q.active_reservations,
      'reviewingReceipts',q.reviewing_receipts,
      'lastResetAt',v_day::timestamp at time zone 'Asia/Baku',
      'nextResetAt',(v_day+1)::timestamp at time zone 'Asia/Baku'
    )) order by
      case
        when q.active and (q.limit_mode='unlimited' or q.confirmed_count+q.active_reservations+q.reviewing_receipts<q.daily_limit) then 0
        when q.active and (q.limit_mode='unlimited' or q.confirmed_count<q.daily_limit) then 1
        when q.activated_at is not null and q.limit_mode='limited' and q.confirmed_count>=q.daily_limit then 2
        else 3
      end,
      q.activated_at nulls last,q.sort_order,q.created_at,q.id
  ),'[]'::jsonb) into v_result from queue_rows q;
  return v_result;
end;
$$;

revoke execute on function public.refresh_payment_method_automation(),public.payment_method_queue_snapshot(boolean,boolean) from public,anon,authenticated;
grant execute on function public.refresh_payment_method_automation(),public.payment_method_queue_snapshot(boolean,boolean) to service_role;

commit;
