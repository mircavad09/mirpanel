begin;
-- Roll the application back to a release that calls v6 before running this.
drop function if exists public.approve_payment_order_v7(uuid,integer,text);
commit;
