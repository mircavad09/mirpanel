import {ensureStaffSupport} from './staff-support.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const pending=new WeakMap();
export function ensureStaffReaders(pool){
 if(!pending.has(pool)){
  const p=pool.query(`create table if not exists mirpanel_community.customer_read_staff (
   user_id text primary key references mirpanel_community."user"(id),
   active boolean not null default false, updated_by text not null, updated_at timestamptz not null default now());
   alter table mirpanel_community.customer_read_staff enable row level security;
   revoke all on mirpanel_community.customer_read_staff from public,anon,authenticated;`).then(()=>ensureStaffSupport(pool));
  pending.set(pool,p);p.catch(()=>pending.delete(pool));
 }return pending.get(pool);
}
export async function staffRole(pool,user){
 await ensureStaffReaders(pool);
 return !!(await pool.query('select 1 from mirpanel_community.customer_read_staff where user_id=$1 and active',[user])).rowCount;
}
export async function staffPermissions(pool,user){
 await ensureStaffReaders(pool);
 const r=(await pool.query('select active,support,replacement,credentials from mirpanel_community.customer_read_staff where user_id=$1',[user])).rows[0];
 return {enabled:!!r?.active,support:!!r?.active&&r.support,replacement:!!r?.active&&r.support&&r.replacement,credentials:!!r?.active&&r.support&&r.credentials};
}
export async function setStaffRole(pool,owner,input){
 if(!(await pool.query("select 1 from mirpanel_community.owner_identity o join mirpanel_community.community_group_roles r on r.user_id=o.user_id and r.role='owner' where o.id=true and o.user_id=$1",[owner])).rowCount)throw fail(403,'Yalnız sahib işçi rolunu dəyişə bilər.');
 if(typeof input?.userId!=='string'||input.userId.length>128||typeof input.enabled!=='boolean')throw fail(400,'İşçi seçimi düzgün deyil.');
 if(input.userId===owner)throw fail(400,'Sahib hesabını işçi roluna çevirmək olmaz.');
 await ensureStaffReaders(pool);
 const target=(await pool.query('select id,"emailVerified" from mirpanel_community."user" where id=$1',[input.userId])).rows[0];
 if(!target)throw fail(404,'İstifadəçi tapılmadı.');
 if(input.enabled&&!target.emailVerified)throw fail(400,'Əvvəl işçinin e-poçtu təsdiqlənməlidir.');
 const c=await pool.connect();
 try{
  await c.query('begin');
  for(const key of ['support','replacement','credentials'])if(input[key]!==undefined&&typeof input[key]!=='boolean')throw fail(400,'İcazə seçimi düzgün deyil.');
  const permissions={support:input.support===true,replacement:input.support===true&&input.replacement===true,credentials:input.support===true&&input.credentials===true};
  await c.query('insert into mirpanel_community.customer_read_staff(user_id,active,updated_by,support,replacement,credentials) values($1,$2,$3,$4,$5,$6) on conflict(user_id) do update set active=excluded.active,updated_by=excluded.updated_by,support=excluded.support,replacement=excluded.replacement,credentials=excluded.credentials,updated_at=clock_timestamp()',[input.userId,input.enabled,owner,permissions.support,permissions.replacement,permissions.credentials]);
  await c.query('insert into mirpanel_community.community_audit(actor_id,action,target_id,reason,details) values($1,$2,$3,$4,$5)',[owner,'staff-read-role',input.userId,input.enabled?'İşçi icazələri yeniləndi.':'İşçi baxışı ləğv edildi.',{enabled:input.enabled,...permissions}]);
  await c.query('commit');return {enabled:input.enabled,...permissions};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
export async function staffRead(pool,actor,path,query=new URLSearchParams()){
 if(!actor)throw fail(401,'İşçi hesabınızla daxil olun.');
 if(!await staffRole(pool,actor))throw fail(403,'İşçi icazəniz yoxdur və ya ləğv edilib.');
 if(path==='/session')return {role:'customer-reader',permissions:await staffPermissions(pool,actor)};
 const page=Number(query.get('page')||1),q=(query.get('q')||'').trim();
 if(!Number.isSafeInteger(page)||page<1||page>10000||q.length>100)throw fail(400,'Axtarış düzgün deyil.');
 const c=await pool.connect();
 try{
  await c.query('begin isolation level repeatable read read only');
  await c.query("set local statement_timeout='8s'");
  // Explicit allowlist: no checkout snapshots, submitted fields, passwords,
  // receipts, card details, delivery secrets, sessions or OAuth tokens.
  const projection=`u.id,coalesce(nullif(p.display_name,''),u.name) as name,u.email,n.member_number::text as "memberNumber",coalesce(w.cents,0)::text as "balanceCents"`;
  const base=` from mirpanel_community."user" u left join mirpanel_community.community_profiles p on p.user_id=u.id left join mirpanel_community.community_member_numbers n on n.user_id=u.id left join mirpanel_community.wallet_accounts w on w.user_id=u.id`;
  let result;
  if(path==='/users'){
   const where=` where u.id<>'mirpanel-system-bot-v1' and ($1='' or position(lower($1) in lower(concat_ws(' ',u.name,p.display_name,u.email,n.member_number::text)))>0)`;
   const rows=(await c.query('select '+projection+base+where+' order by u."createdAt" desc,u.id limit 21 offset $2',[q,(page-1)*20])).rows;
   result={users:rows.slice(0,20),more:rows.length>20,page};
  }else if(path==='/customer'){
   const id=query.get('id');if(!id||id.length>128)throw fail(400,'Müştəri seçin.');
   const user=(await c.query('select '+projection+base+' where u.id=$1',[id])).rows[0];if(!user)throw fail(404,'Müştəri tapılmadı.');
   const rows=(await c.query(`select o.order_code::text as number,o.product_title as product,o.plan_name as package,o.created_at as date,o.amount::text,o.currency,o.status,
    coalesce((select jsonb_agg(jsonb_build_object('product',i->>'title','package',i->>'planName','quantity',i->>'quantity'))
     from jsonb_array_elements(case when o.checkout_snapshot->>'cartVersion'='2' and jsonb_typeof(o.checkout_snapshot->'items')='array' then o.checkout_snapshot->'items' else '[]'::jsonb end) i),'[]'::jsonb) as lines
    from mirpanel_community.community_order_owners l join public.payment_orders o on o.id=l.order_id
    where l.user_id=$1 order by o.created_at desc,o.id desc limit 21 offset $2`,[id,(page-1)*20])).rows;
   result={user,orders:rows.slice(0,20),more:rows.length>20,page,readOnly:true};
  }else throw fail(404,'Bu bölməyə icazə yoxdur.');
  await c.query('commit');return result;
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
export async function staffRequest(context,request,url){
 const path=url.pathname.slice('/api/community/staff'.length);
 if(request.method==='POST'&&['/replace','/note','/credentials'].includes(path)){
  const origin=request.headers?.origin;
  if(!origin||!['https://mirpanel.com','http://127.0.0.1:55464'].includes(origin))throw fail(403,'Sorğunun mənbəyi uyğun deyil.');
  return context.staffWrite(request,path);
 }
 if(request.method!=='GET')throw fail(403,'Bu əməliyyata icazə yoxdur.');
 if(!['/session','/users','/customer'].includes(path))throw fail(403,'Bu bölməyə icazə yoxdur.');
 return context.staffRead(request,path,url.searchParams);
}
export const staffHTML=`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>İşçi · Müştəri dəstəyi | MirPanel</title><link rel="stylesheet" href="/community-assets/staff-reader.css"><main id="communityApp"><header><h1>İstifadəçilər</h1><span>İşçi paneli</span><a href="/hesab?next=%2Fprofil%3Ftab%3Disci">Öz hesabımla daxil ol</a><button type="button" id="staffLogout">Çıxış</button></header><p id="staffError" role="alert"></p><section id="staffContent" aria-live="polite">İcazə yoxlanılır…</section></main><script type="module" src="/community-assets/staff-reader.js?v=support-1"></script></html>`;
