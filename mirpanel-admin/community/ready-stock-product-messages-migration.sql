begin;
create table if not exists mirpanel_community.ready_stock_product_messages (
  product_id text primary key,
  message_cipher text not null
);
revoke all on mirpanel_community.ready_stock_product_messages from public, anon, authenticated;
alter table mirpanel_community.ready_stock_product_messages enable row level security;
commit;
