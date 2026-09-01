begin;

-- Soft-deleted cards remain preserved for audits and historical orders, but
-- are deliberately not restorable by the application or its service role.
revoke execute on function public.restore_payment_method_safely(uuid, text)
  from service_role, anon, authenticated, public;

commit;
