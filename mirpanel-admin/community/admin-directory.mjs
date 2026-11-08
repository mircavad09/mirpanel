// Explicit projections only: never expose credentials, sessions or OAuth tokens.
import {tierFor} from './repository.mjs';
import {SITE_PRESENCE_ID} from './public-service.mjs';
export async function adminDirectory(pool,repo,{q='',page='1',id,filter='all'}={}){
 if(!['all','online','banned'].includes(filter))throw Object.assign(Error('Filtr düzgün deyil.'),{status:400});
 if(typeof q!=='string'||q.length>100||!/^\d{1,5}$/.test(String(page))||Number(page)<1)throw Object.assign(Error('Axtarış düzgün deyil.'),{status:400});
 if(id&&(typeof id!=='string'||id.length>128))throw Object.assign(Error('ID düzgün deyil.'),{status:400});
 const where=`u.id<>'mirpanel-system-bot-v1' and ($1::text is null or u.id=$1) and
 ($2='' or position(lower($2) in lower(concat_ws(' ',u.id,n.member_number::text,u.email,u.name,p.first_name,p.last_name)))>0)
 and ($3='all' or ($3='banned' and p.blocked and (p.ban_until is null or p.ban_until>clock_timestamp())) or ($3='online' and exists(select 1 from community_presence v join session s on s.id=v.session_id and s."userId"=u.id where v.user_id=u.id and v.tab_id<>'${SITE_PRESENCE_ID}' and v.last_seen>clock_timestamp()-interval '45 seconds' and s."expiresAt">clock_timestamp())))`;
 const params=[id||null,q.trim(),filter];
 const total=Number((await pool.query(`select count(*)::int n from "user" u left join community_profiles p on p.user_id=u.id left join community_member_numbers n on n.user_id=u.id where ${where}`,params)).rows[0].n);
 const rows=(await pool.query(`select u.id,u.name,u.email,u."emailVerified",u."createdAt" as "createdAt",n.member_number::text as "memberNumber",
 p.first_name as "firstName",p.last_name as "lastName",p.avatar,p.avatar_path as "avatarPath",p.blocked,p.ban_until as "banUntil",p.muted_permanent as "mutedPermanent",p.muted_until as "mutedUntil",
 coalesce((select w.cents::text from wallet_accounts w where w.user_id=u.id),'0') as "balanceCents",
 (select coalesce(sum(greatest(0,round(o.amount*100)::bigint-coalesce(f.cents,0))),0)::text from community_order_owners l join public.payment_orders o on o.id=l.order_id left join community_refunds f on f.order_id=o.id where l.user_id=u.id and o.status in ('approved','completed') and o.currency='AZN') as "spentCents",
 (select count(*)::int from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=u.id and o.status in ('approved','completed')) as "orderCount",
 (select max(v.last_seen) from community_presence v where v.user_id=u.id and v.tab_id<>'${SITE_PRESENCE_ID}') as "lastSeen",
 exists(select 1 from community_presence v join session s on s.id=v.session_id and s."userId"=u.id where v.user_id=u.id and v.tab_id<>'${SITE_PRESENCE_ID}' and v.last_seen>clock_timestamp()-interval '45 seconds' and s."expiresAt">clock_timestamp()) as online
 from "user" u left join community_profiles p on p.user_id=u.id left join community_member_numbers n on n.user_id=u.id
 where ${where} order by u."createdAt" desc,u.id limit 20 offset $4`,[...params,(Number(page)-1)*20])).rows;
 if(!id)return{users:rows,total,page:Number(page),hasMore:Number(page)*20<total};
 if(!rows[0])throw Object.assign(Error('İstifadəçi tapılmadı.'),{status:404});
 const profile=(await pool.query(`select display_name,avatar,avatar_path,first_name,last_name,phone,whatsapp,social_links from community_profiles where user_id=$1`,[id])).rows[0]||null;
 const orders=(await pool.query(`select o.id,o.order_code,o.product_title,o.plan_name,o.amount,o.currency,o.status,o.created_at from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=$1 order by o.created_at desc limit 50`,[id])).rows;
 const totalCents=await repo.total(id),cfg=await repo.config();
 return{user:rows[0],profile,orders,totalCents,tier:tierFor(totalCents,cfg.tiers),ordersLimited:orders.length===50};
}
