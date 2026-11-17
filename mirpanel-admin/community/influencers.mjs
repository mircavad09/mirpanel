import {BOT_ID} from './bot-policy.mjs';
import {requireOwner,requireAllowed} from './group-control.mjs';
import {avatarSource} from './public/avatar-stickers.js';
import {inventoryAvailability} from '../../inventory-availability.mjs';
import {parseMoneyCents} from '../payment-profit.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const initialized=new WeakMap();
export function ensureInfluencers(pool){
 if(initialized.has(pool))return initialized.get(pool);
 const pending=(async()=>{const c=await pool.connect();try{await c.query('begin');await c.query("set local lock_timeout='5s'");await c.query('select pg_advisory_xact_lock(714025131)');
 await c.query(`create table if not exists mirpanel_community.chat_influencers(
 user_id text primary key references mirpanel_community."user"(id),enabled boolean not null default false,
 updated_by text not null references mirpanel_community."user"(id),updated_at timestamptz not null default clock_timestamp());
 create table if not exists mirpanel_community.chat_message_actors(
 message_id bigint primary key references mirpanel_community.community_messages(id),
 actor_id text not null references mirpanel_community."user"(id),represented_id text not null references mirpanel_community."user"(id),
 created_at timestamptz not null default clock_timestamp());
 create table if not exists mirpanel_community.influencer_gifts(
 order_id uuid primary key references public.payment_orders(id),donor_id text not null references mirpanel_community."user"(id),
 recipient_id text not null references mirpanel_community."user"(id),created_at timestamptz not null default clock_timestamp(),
 presented_at timestamptz,presented_by text references mirpanel_community."user"(id));
 create index if not exists influencer_gifts_queue on mirpanel_community.influencer_gifts(created_at,order_id);
 alter table mirpanel_community.chat_influencers enable row level security;
 alter table mirpanel_community.chat_message_actors enable row level security;
 alter table mirpanel_community.influencer_gifts enable row level security;
 revoke all on mirpanel_community.chat_influencers,mirpanel_community.chat_message_actors,mirpanel_community.influencer_gifts from public,anon,authenticated;`);
 await c.query('commit');}catch(e){await c.query('rollback');throw e;}finally{c.release();}})();
 initialized.set(pool,pending);pending.catch(()=>initialized.delete(pool));return pending;
}
export async function influencerRecipient(db,id,{lock=false,donor=null}={}){
 if(typeof id!=='string'||!id||id.length>200)throw fail(400,'Hədiyyə alanı seçin.');
 const row=(await db.query(`select u.id,coalesce(p.display_name,u.name) as name,p.avatar,p.avatar_path from mirpanel_community.chat_influencers i
 join mirpanel_community."user" u on u.id=i.user_id left join mirpanel_community.community_profiles p on p.user_id=u.id
 where i.user_id=$1 and i.enabled${lock?' for share of i':''}`,[id])).rows[0];
 if(!row)throw fail(409,'Bu hesabın influencer statusu aktiv deyil.');
 if(donor===id)throw fail(400,'Özünüzə hədiyyə göndərmək olmaz.');
 await requireAllowed(db,id);return {id:row.id,name:row.name,avatarUrl:avatarSource(row)};
}
export async function setInfluencer(repo,actor,b){
 await requireOwner(repo.pool,actor);if(b.userId===BOT_ID)throw fail(400,'Sistem hesabı influencer ola bilməz.');if(typeof b.enabled!=='boolean')throw fail(400,'Status düzgün deyil.');
 return repo.tx(async c=>{const user=(await c.query('select id from mirpanel_community."user" where id=$1 for update',[b.userId])).rows[0];if(!user)throw fail(404,'İstifadəçi tapılmadı.');
 const before=(await c.query('select enabled from mirpanel_community.chat_influencers where user_id=$1',[b.userId])).rows[0]?.enabled||false;
 await c.query('insert into mirpanel_community.chat_influencers(user_id,enabled,updated_by) values($1,$2,$3) on conflict(user_id) do update set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=clock_timestamp()',[b.userId,b.enabled,actor.id]);
 if(before!==b.enabled)await c.query('insert into community_audit(actor_id,action,target_id,reason,details) values($1,$2,$3,$4,$5)',[actor.id,'influencer-status',b.userId,'Söhbət influencer statusu dəyişdirildi',{before,enabled:b.enabled}]);
 return {enabled:b.enabled};},{kind:'influencer'});
}
export async function influencerCatalog(pool,id,catalog,stock){
 const recipient=await influencerRecipient(pool,id);
 const products=catalog.products.filter(p=>p.active!==false).map(p=>{const available=inventoryAvailability(p,stock.find(s=>s.productId===p.id));
 const plans=(p.plans||[]).flatMap((plan,index)=>{let cents;try{cents=parseMoneyCents(plan.price,{allowEmpty:false});}catch{return [];}const s=available.plans.find(x=>x.planKey===String(index));return cents>0&&s?.active?[{index,label:plan.label||plan.name||'Paket',cents,available:available.salesDisabled?0:s.available??null}]:[];});
 return {id:p.id,title:p.title,image:p.image||'',plans};}).filter(p=>p.plans.length);
 return {recipient,products};
}
export async function giftAdmin(repo,actor,b={}){
 await requireOwner(repo.pool,actor);
 if(b.action==='present'&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(b.orderId||''))throw fail(400,'Hədiyyə identifikatoru düzgün deyil.');
 if(b.action==='present')return repo.tx(async c=>{await c.query('select pg_advisory_xact_lock(714025001)');
 const row=(await c.query(`select g.*,o.status,o.payment_confirmed from mirpanel_community.influencer_gifts g join public.payment_orders o on o.id=g.order_id where g.order_id=$1 for update of g,o`,[b.orderId])).rows[0];
 if(!row)throw fail(404,'Hədiyyə tapılmadı.');if(['cancelled','rejected','expired','refunded'].includes(row.status)||!row.payment_confirmed)throw fail(409,'Yalnız ödənilmiş, ləğv edilməmiş hədiyyə təqdim edilə bilər.');
 if(row.presented_at)return {ok:true,idempotent:true};
 await c.query('update mirpanel_community.influencer_gifts set presented_at=clock_timestamp(),presented_by=$2 where order_id=$1',[b.orderId,actor.id]);
 if((await c.query("select to_regclass('mirpanel_community.netflix_room_units') present")).rows[0].present)await c.query(`update mirpanel_community.netflix_room_units set availability='review',sale_reservation_id=null where sale_reservation_id in(select reservation_id from mirpanel_community.shop_lines where order_id=$1)`,[b.orderId]);
await c.query('insert into community_audit(actor_id,action,target_id,reason,details) values($1,$2,$3,$4,$5)',[actor.id,'influencer-gift-presented',b.orderId,'Hədiyyə admin tərəfindən təqdim edildi',{recipientId:row.recipient_id}]);
 return {ok:true};
 });
 const page=Math.max(1,Math.min(100000,Math.floor(Number(b.page))||1));
 const items=(await repo.pool.query(`select g.order_id,g.presented_at,g.created_at,o.order_code,o.status,o.payment_confirmed,o.amount,o.checkout_snapshot,
 coalesce(p.display_name,u.name) as recipient_name,coalesce(d.display_name,du.name) as donor_name
 from mirpanel_community.influencer_gifts g join public.payment_orders o on o.id=g.order_id
 join mirpanel_community."user" u on u.id=g.recipient_id left join mirpanel_community.community_profiles p on p.user_id=u.id
 join mirpanel_community."user" du on du.id=g.donor_id left join mirpanel_community.community_profiles d on d.user_id=du.id
 order by g.created_at desc,g.order_id desc limit 31 offset $1`,[(page-1)*30])).rows;
 return {items:items.slice(0,30).map(({checkout_snapshot,...r})=>({...r,items:(checkout_snapshot?.items||[]).map(x=>({title:x.title,planName:x.planName}))})),page,more:items.length>30};
}
