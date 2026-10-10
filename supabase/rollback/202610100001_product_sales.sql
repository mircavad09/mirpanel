-- Run ONLY after the related backup in docs/product-sales-release.md.
-- Prefer rolling back the app while retaining statistics and audit. This SQL removes
-- the new subsystem only; it does not touch payment orders, catalog, stories or storage.
begin;
drop trigger if exists product_sales_baseline_total_guard on public.product_sales_baselines;
drop trigger if exists product_sales_settings_total_guard on public.product_sales_settings;
drop function if exists public.product_sales_snapshot();
drop function if exists public.product_sales_initialize(jsonb,text);
drop function if exists public.product_sales_save(jsonb,text,integer);
drop function if exists public.product_sales_validate(jsonb);
drop function if exists public.product_sales_check_total();
drop index if exists public.payment_orders_product_completed_sales_idx;
drop table if exists public.product_sales_audit;
drop table if exists public.product_sales_baselines;
drop table if exists public.product_sales_settings;
commit;
