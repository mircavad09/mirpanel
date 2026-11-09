begin;
set local lock_timeout='5s';
alter table public.payment_orders add column if not exists fulfillment_cancellation jsonb;
-- Retain every existing status accepted by this installation.
do $$declare rule text;begin
 select pg_get_expr(conbin,conrelid) into rule from pg_constraint
 where conrelid='public.payment_orders'::regclass and conname='payment_orders_status_check';
 if rule is not null and position('cancelled' in rule)=0 then
  alter table public.payment_orders drop constraint payment_orders_status_check;
  execute 'alter table public.payment_orders add constraint payment_orders_status_check check (('||rule||') or status=''cancelled'')';
 end if;
end$$;
notify pgrst,'reload schema';
commit;
