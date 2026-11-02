const fail=()=>Object.assign(Error('Tarix aralığı düzgün deyil.'),{status:400});
export function statisticsRange({from,to,period='day'}={}){
 const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!valid(from)||!valid(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000||!['day','month'].includes(period))throw fail();
 return{from,to,period};
}
// Only immutable order snapshots and recorded refunds; never catalog prices/costs.
export async function userStatistics(pool,id,options){const {from,to,period}=statisticsRange(options);
 const rows=(await pool.query(`with source as (
 select o.id,o.status,o.currency,round(o.amount*100)::bigint as amount_cents,
 case when nullif(to_jsonb(o)->>'cost_price_snapshot','') is not null and nullif(to_jsonb(o)->>'profit_snapshot','') is not null then round((to_jsonb(o)->>'profit_snapshot')::numeric*100)::bigint end as profit_cents,
 coalesce((select r.cents from community_refunds r where r.order_id=o.id),0)::bigint as refund_cents,
 coalesce(nullif(to_jsonb(o)->>'completed_at','')::timestamptz,nullif(to_jsonb(o)->>'approved_at','')::timestamptz,o.created_at) as happened_at
 from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=$1
 ), scoped as(select * from source where happened_at>=($2::date::timestamp at time zone 'Asia/Baku') and happened_at<(($3::date+1)::timestamp at time zone 'Asia/Baku'))
 select to_char(date_trunc($4,happened_at at time zone 'Asia/Baku'),'YYYY-MM-DD') as bucket,
 count(*)::int as orders,
 count(*) filter(where status in ('approved','completed'))::int as sales,
 coalesce(sum(greatest(0,amount_cents-refund_cents)) filter(where currency='AZN' and status in ('approved','completed')),0)::text as revenue_cents,
 case when count(*) filter(where currency='AZN' and status in ('approved','completed') and profit_cents is null)>0 then null else coalesce(sum(profit_cents-refund_cents) filter(where currency='AZN' and status in ('approved','completed')),0)::text end as profit_cents,
 count(*) filter(where status in ('cancelled','canceled','rejected'))::int as cancellations,
 coalesce(sum(amount_cents) filter(where currency='AZN' and status in ('cancelled','canceled','rejected')),0)::text as cancelled_amount_cents,
 count(*) filter(where currency<>'AZN')::int as excluded_non_azn
 from scoped group by 1 order by 1`,[id,from,to,period])).rows;
 return{from,to,period,timeZone:'Asia/Baku',items:rows,empty:rows.length===0,source:'linked orders and saved financial snapshots',balanceCreditsIncluded:false};
}
