-- Preserve every setting and reserved price; disable only new special prices.
-- Nonnegative constraints remain so legitimate zero-price history survives.
-- Guest APIs still enforce their existing positive standard catalog price.
begin;
select pg_advisory_xact_lock(926110202);
update mirpanel_community.user_controls_release set enabled=false where id;
commit;
