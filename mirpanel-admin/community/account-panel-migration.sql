begin;
set local lock_timeout='5s';
set local search_path=mirpanel_community,public;
create table if not exists account_wishlist(user_id text not null references "user"(id),product_id text not null check(length(product_id) between 1 and 160),created_at timestamptz not null default clock_timestamp(),primary key(user_id,product_id));
alter table account_wishlist enable row level security;
revoke all on account_wishlist from public,anon,authenticated;
commit;
