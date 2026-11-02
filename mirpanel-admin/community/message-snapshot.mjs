// One read-only database round trip. Only public author fields leave this module.
export async function messageSnapshot(pool,{before,after,ids}){
 const r=(await pool.query(`with page as (
 select id,user_id,body,created_at from community_messages
 where hidden=false and ($1::bigint is null or id<$1) and ($2::bigint is null or id>$2)
 order by case when $2::bigint is not null then id end asc,
 case when $2::bigint is null then id end desc limit 31
 ), authors as (
 select p.user_id,p.display_name,p.avatar,p.avatar_path,g.role,
 (select coalesce(sum(greatest(0,round(o.amount*100)::bigint-coalesce(f.cents,0))),0)::text
 from community_order_owners l join payment_orders o on o.id=l.order_id
 left join community_refunds f on f.order_id=o.id where l.user_id=p.user_id
 and o.status in ('approved','completed') and o.currency='AZN') as total_cents
 from community_profiles p left join community_group_roles g on g.user_id=p.user_id
 where p.user_id in (select user_id from page)
 ) select (select row_to_json(c) from community_config c where id=true) as config,
 coalesce((select json_agg(x) from (select m.id::text,m.user_id,m.body,m.created_at,
 row_to_json(a) as author,t.recipient_id,t.display_name as tag_name
 from page m left join authors a on a.user_id=m.user_id
 left join community_bot_tags t on t.message_id=m.id
 order by case when $2::bigint is not null then m.id end asc,
 case when $2::bigint is null then m.id end desc) x),'[]'::json) as items,
 coalesce((select json_agg(id::text) from community_messages where id=any($3::bigint[]) and hidden=true),'[]'::json) as removed`,[before,after,ids])).rows[0];
 return r;
}
