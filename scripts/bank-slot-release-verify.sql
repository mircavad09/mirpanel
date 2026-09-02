select
  (select count(*) from public.payment_orders) as orders,
  (select count(*) from public.payment_reservations) as reservations,
  (select count(*) from public.payment_methods) as methods,
  (select count(*) from public.payment_methods where active and not archived and deleted_at is null) as active_methods,
  has_function_privilege('service_role','public.refresh_payment_method_automation()','execute') as server_refresh_allowed,
  has_function_privilege('anon','public.refresh_payment_method_automation()','execute') as anon_refresh_allowed,
  has_function_privilege('authenticated','public.refresh_payment_method_automation()','execute') as authenticated_refresh_allowed;
