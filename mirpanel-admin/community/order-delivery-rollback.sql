-- Roll back code before applying. Keep all committed delivery/audit and mail records.
begin;
drop trigger if exists enqueue_customer_payment_mail on public.payment_orders;
drop trigger if exists snapshot_customer_order_contact on mirpanel_community.community_order_owners;
commit;
