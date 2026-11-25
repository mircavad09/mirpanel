-- No historical dates are invented. Existing rows remain NULL; only new
-- events and newly accepted submissions receive their actual timestamps.
alter table if exists mirpanel_community.customer_order_mail add column if not exists created_at timestamptz;
alter table if exists mirpanel_community.customer_order_mail alter column created_at set default now();
alter table if exists mirpanel_community.customer_order_mail add column if not exists accepted_at timestamptz;
alter table if exists mirpanel_community.seller_mail add column if not exists created_at timestamptz;
alter table if exists mirpanel_community.seller_mail alter column created_at set default now();
alter table if exists mirpanel_community.seller_mail add column if not exists accepted_at timestamptz;
