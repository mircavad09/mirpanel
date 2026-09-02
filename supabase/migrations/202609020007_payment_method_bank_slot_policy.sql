begin;

-- Bank-slot policy: four preferred providers at day start, then provider-aware
-- replacement for saturated cards. Existing orders, reservations, counters and
-- encrypted card numbers are never deleted or rewritten by this migration.
create or replace function public.refresh_payment_method_automation()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_day date := public.payment_baku_date();
  v_seeded boolean := false;
  v_source public.payment_methods%rowtype;
  v_next public.payment_methods%rowtype;
  v_group text;
  v_target text;
  v_confirmed integer;
  v_active_count integer;
  v_promotions integer := 0;
  v_selected uuid[] := '{}'::uuid[];
begin
  perform pg_advisory_xact_lock(714025001);
  perform public.expire_payment_reservations();
  perform id from public.payment_methods order by id for update;
  insert into public.payment_method_activation_days(usage_day)
    values (v_day) on conflict do nothing returning true into v_seeded;

  if coalesce(v_seeded, false) then
    -- At a new Baku day rebuild only the visible queue. Reservation identity
    -- remains tied to its original card and usage_day.
    update public.payment_methods
       set active = false,
           deactivated_at = case when manual_disabled then coalesce(deactivated_at, now()) else now() end,
           updated_at = now()
     where archived = false and deleted_at is null;

    foreach v_target in array array['m10','abb','leo','kapital'] loop
      select m.* into v_next
        from public.payment_methods m
       where m.archived = false and m.deleted_at is null and not m.manual_disabled
         and m.encrypted_number is not null and m.id <> all(v_selected)
         and (case
           when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%m10%' then 'm10'
           when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%leo%' then 'leo'
           when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%abb%' then 'abb'
           when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%kapital%' then 'kapital'
           else 'other' end) = v_target
         and (m.limit_mode = 'unlimited' or coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id=m.id and c.counter_date=v_day),0) < m.daily_limit)
       order by m.sort_order, m.created_at, m.id limit 1;
      if found then
        update public.payment_methods set active=true, deactivated_at=null, updated_at=now() where id=v_next.id;
        v_selected := array_append(v_selected, v_next.id);
        insert into public.payment_method_daily_activations(usage_day,method_id)
          values(v_day,v_next.id) on conflict do nothing;
      end if;
    end loop;

    -- If a preferred provider has no eligible card, fill that slot from the
    -- remaining admin queue without hard-coding a bank or card count.
    while coalesce(cardinality(v_selected),0) < 4 loop
      select m.* into v_next
        from public.payment_methods m
       where m.archived=false and m.deleted_at is null and not m.manual_disabled
         and m.encrypted_number is not null and m.id <> all(v_selected)
         and (m.limit_mode='unlimited' or coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id=m.id and c.counter_date=v_day),0) < m.daily_limit)
       order by m.sort_order,m.created_at,m.id limit 1;
      exit when not found;
      update public.payment_methods set active=true,deactivated_at=null,updated_at=now() where id=v_next.id;
      v_selected := array_append(v_selected,v_next.id);
      insert into public.payment_method_daily_activations(usage_day,method_id)
        values(v_day,v_next.id) on conflict do nothing;
    end loop;
    insert into public.payment_method_daily_activations(usage_day,method_id)
      select v_day,unnest(v_selected) on conflict do nothing;
  else
    -- During the day retain the current queue and replace only cards whose
    -- confirmed daily limit is full. Reservations alone never trigger a swap.
    for v_source in
      select * from public.payment_methods
       where active=true and archived=false and deleted_at is null and not manual_disabled
         and encrypted_number is not null and limit_mode='limited'
       order by sort_order,created_at,id
    loop
      select coalesce(c.confirmed_count,0) into v_confirmed
        from public.payment_method_daily_counters c
       where c.method_id=v_source.id and c.counter_date=v_day;
      if coalesce(v_confirmed,0) < v_source.daily_limit then continue; end if;

      v_group := case
        when lower(coalesce(v_source.provider_name,'') || ' ' || coalesce(v_source.display_name,'')) like '%m10%' then 'm10'
        when lower(coalesce(v_source.provider_name,'') || ' ' || coalesce(v_source.display_name,'')) like '%leo%' then 'leo'
        when lower(coalesce(v_source.provider_name,'') || ' ' || coalesce(v_source.display_name,'')) like '%abb%' then 'abb'
        when lower(coalesce(v_source.provider_name,'') || ' ' || coalesce(v_source.display_name,'')) like '%kapital%' then 'kapital'
        else 'other' end;
      update public.payment_methods set active=false,deactivated_at=now(),updated_at=now() where id=v_source.id;

      -- Same-bank first for ABB/Leo/Kapital. M10 deliberately draws a
      -- random eligible standby from another card/provider. If no same-bank
      -- standby exists, a deterministic fallback preserves the four-slot goal.
      if v_group <> 'm10' and v_group <> 'other' then
        select m.* into v_next from public.payment_methods m
         where m.archived=false and m.deleted_at is null and not m.manual_disabled
           and m.active=false and m.encrypted_number is not null and m.id<>v_source.id
           and (case when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%m10%' then 'm10'
                     when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%leo%' then 'leo'
                     when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%abb%' then 'abb'
                     when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%kapital%' then 'kapital' else 'other' end)=v_group
           and (m.limit_mode='unlimited' or coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id=m.id and c.counter_date=v_day),0)<m.daily_limit)
         order by m.sort_order,m.created_at,m.id limit 1;
        if not found then
          select m.* into v_next from public.payment_methods m
           where m.archived=false and m.deleted_at is null and not m.manual_disabled
             and m.active=false and m.encrypted_number is not null and m.id<>v_source.id
             and (m.limit_mode='unlimited' or coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id=m.id and c.counter_date=v_day),0)<m.daily_limit)
           order by m.sort_order,m.created_at,m.id limit 1;
        end if;
      elsif v_group = 'm10' then
        select m.* into v_next from public.payment_methods m
         where m.archived=false and m.deleted_at is null and not m.manual_disabled
           and m.active=false and m.encrypted_number is not null and m.id<>v_source.id
           and (case when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%m10%' then 'm10'
                     when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%leo%' then 'leo'
                     when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%abb%' then 'abb'
                     when lower(coalesce(m.provider_name,'') || ' ' || coalesce(m.display_name,'')) like '%kapital%' then 'kapital' else 'other' end) <> v_group
           and (m.limit_mode='unlimited' or coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id=m.id and c.counter_date=v_day),0)<m.daily_limit)
         order by random() limit 1;
      else
        select m.* into v_next from public.payment_methods m
         where m.archived=false and m.deleted_at is null and not m.manual_disabled
           and m.active=false and m.encrypted_number is not null and m.id<>v_source.id
           and (m.limit_mode='unlimited' or coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id=m.id and c.counter_date=v_day),0)<m.daily_limit)
         order by m.sort_order,m.created_at,m.id limit 1;
      end if;
      if found then
        update public.payment_methods set active=true,deactivated_at=null,updated_at=now() where id=v_next.id;
        insert into public.payment_method_daily_activations(usage_day,method_id)
          values(v_day,v_next.id) on conflict do nothing;
        v_promotions := v_promotions + 1;
      end if;
    end loop;

    -- A direct admin activation cannot expand the checkout beyond four slots.
    update public.payment_methods m set active=false,deactivated_at=now(),updated_at=now()
     where m.active and m.id not in (
       select id from public.payment_methods
        where active and archived=false and deleted_at is null and not manual_disabled
        order by sort_order,created_at,id limit 4
     );

    -- Admin disable/delete or missing providers may leave a free slot. Fill
    -- only the missing number of slots from eligible standby methods.
    select count(*) into v_active_count from public.payment_methods
      where active and archived=false and deleted_at is null and not manual_disabled;
    while v_active_count < 4 loop
      select m.* into v_next from public.payment_methods m
       where m.archived=false and m.deleted_at is null and not m.manual_disabled
         and m.active=false and m.encrypted_number is not null
         and (m.limit_mode='unlimited' or coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id=m.id and c.counter_date=v_day),0)<m.daily_limit)
       order by m.sort_order,m.created_at,m.id limit 1;
      exit when not found;
      update public.payment_methods set active=true,deactivated_at=null,updated_at=now() where id=v_next.id;
      insert into public.payment_method_daily_activations(usage_day,method_id)
        values(v_day,v_next.id) on conflict do nothing;
      v_active_count := v_active_count + 1;
      v_promotions := v_promotions + 1;
    end loop;
  end if;

  select count(*) into v_active_count from public.payment_methods where active and archived=false and deleted_at is null;
  return jsonb_build_object('usageDay',v_day,'seeded',coalesce(v_seeded,false),'activeCount',v_active_count,'promotions',v_promotions);
end;
$$;

-- Return active methods first in activation order; retain saturated methods
-- beneath them for a transparent, disabled "Bu gün limit dolub" row.
create or replace function public.payment_method_queue_snapshot(
  p_include_archived boolean default false, p_include_deleted boolean default false
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_day date := public.payment_baku_date(); v_result jsonb;
begin
  perform public.refresh_payment_method_automation();
  select coalesce(jsonb_agg(to_jsonb(m) || jsonb_build_object(
    'activated_today', a.activated_at is not null,
    'queue_activated_at', a.activated_at,
    'queue_stats', jsonb_build_object(
      'confirmed',coalesce(c.confirmed_count,0),
      'activeReservations',(select count(*) from public.payment_reservations r where r.method_id=m.id and r.usage_day=v_day and r.status='reserved' and r.expires_at>now()),
      'reviewingReceipts',(select count(*) from public.payment_reservations r where r.method_id=m.id and r.usage_day=v_day and r.status='reviewing'),
      'lastResetAt',v_day::timestamp at time zone 'Asia/Baku',
      'nextResetAt',(v_day+1)::timestamp at time zone 'Asia/Baku'
    )) order by
      case when m.active then 0
           when a.activated_at is not null and m.limit_mode='limited' and coalesce(c.confirmed_count,0)>=m.daily_limit then 1
           else 2 end,
      a.activated_at nulls last,m.sort_order,m.created_at,m.id),'[]'::jsonb) into v_result
  from public.payment_methods m
  left join public.payment_method_daily_counters c on c.method_id=m.id and c.counter_date=v_day
  left join public.payment_method_daily_activations a on a.method_id=m.id and a.usage_day=v_day
  where (p_include_archived or not m.archived) and (p_include_deleted or m.deleted_at is null);
  return v_result;
end;
$$;

revoke execute on function public.refresh_payment_method_automation(),public.payment_method_queue_snapshot(boolean,boolean) from public,anon,authenticated;
grant execute on function public.refresh_payment_method_automation(),public.payment_method_queue_snapshot(boolean,boolean) to service_role;
commit;
