select
 exists(select 1 from pg_trigger where tgrelid='public.payment_orders'::regclass and tgname='enqueue_customer_payment_mail' and tgenabled='O') as payment_transition,
 exists(select 1 from pg_trigger where tgrelid='mirpanel_community.community_order_owners'::regclass and tgname='snapshot_customer_order_contact' and tgenabled='O') as contact_snapshot,
 (select count(*)=3 and bool_and(relrowsecurity)
  from pg_class where oid in ('mirpanel_community.customer_order_mail'::regclass,'mirpanel_community.customer_order_deliveries'::regclass,'mirpanel_community.customer_order_contacts'::regclass)) as rls,
 not has_table_privilege('anon','mirpanel_community.customer_order_deliveries','SELECT') and
 not has_table_privilege('authenticated','mirpanel_community.customer_order_deliveries','SELECT') and
 not has_table_privilege('authenticated','mirpanel_community.customer_order_mail','UPDATE') and
 not has_table_privilege('authenticated','mirpanel_community.customer_order_contacts','SELECT') as private_data,
 has_table_privilege(current_user,'mirpanel_community.customer_order_deliveries','INSERT') and
 has_table_privilege(current_user,'mirpanel_community.customer_order_mail','UPDATE') as application_access;
