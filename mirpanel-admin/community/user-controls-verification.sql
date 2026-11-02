select to_regclass('mirpanel_community.user_special_prices') is not null as prices_ready,
to_regclass('mirpanel_community.user_referral_settings') is not null as referrals_ready,
to_regclass('mirpanel_community.user_reservation_prices') is not null as snapshots_ready,
to_regprocedure('mirpanel_community.reserve_user_price_v1(text,uuid,text,text,text,text,numeric,uuid,uuid,uuid,integer,boolean)') is not null as reserve_ready;
select not exists(select 1 from mirpanel_community.user_reservation_prices where effective_cents<0 or standard_cents<0) as prices_valid;
