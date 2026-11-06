-- Disable NEW v2 checkouts and deploy the last compatible application. Keep all
-- drafts, parent orders and inventory/capacity guards for in-flight purchases.
update mirpanel_community.cart_v2_release set enabled=false where id;
