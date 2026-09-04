begin;
do $$declare r record;begin
  for r in select function_def from mirpanel_reservation_slot_backup_20260905.function_defs order by identity_args loop execute r.function_def;end loop;
end$$;
drop function if exists public.expire_payment_reservations_raw();
drop function if exists public.reject_payment_order_before_reservation_slot_rebalance(uuid,text,text);
drop function if exists public.cancel_payment_reservation_before_reservation_slot_rebalance(uuid,text);
commit;
