import {avatarSource} from './public/avatar-stickers.js';
const table='mirpanel_community.influencer_preview_messages';
const fail=(status,message)=>Object.assign(Error(message),{status});
const uuid=value=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value||'');

const initialized=new WeakMap();
async function ensurePreviewStorage(pool){
 if(initialized.has(pool))return initialized.get(pool);
 const pending=(async()=>{
  const client=await pool.connect();
  try{
   await client.query('begin');
   await client.query('select pg_advisory_xact_lock(714025121)');
   await client.query(`create table if not exists ${table}(
  id uuid primary key default gen_random_uuid(),actor_id text not null references mirpanel_community."user"(id),
  target_id text not null references mirpanel_community."user"(id),client_id uuid not null,
  body text not null check(char_length(body) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp(),unique(actor_id,client_id));
  alter table ${table} enable row level security;
  revoke all on ${table} from public,anon,authenticated;`);
   await client.query('commit');
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
 })();
 initialized.set(pool,pending);
 try{await pending;}catch(error){initialized.delete(pool);throw error;}
}

export async function influencerPreview(db,actor,input){
 const {rows:accounts}=await db.query(`select u.id,p.avatar,p.avatar_path from mirpanel_community.community_member_numbers n
  join mirpanel_community."user" u on u.id=n.user_id
  left join mirpanel_community.community_profiles p on p.user_id=u.id
  where n.member_number=1554 and lower(u.email)=lower($1)`,['aysdrrek@gmail.com']);
 if(accounts.length!==1)throw fail(409,'1554 nömrəli hesabın uyğunluğu təsdiqlənmədi.');
 const account=accounts[0];
 await ensurePreviewStorage(db);
 if(input?.action==='send'){
  if(typeof input.body!=='string'||!input.body.trim()||input.body.length>2000||/[\u0000-\u0008]/.test(input.body))throw fail(400,'Sınaq mesajı 1–2000 simvol olmalıdır.');
  if(!uuid(input.clientId))throw fail(400,'Göndəriş identifikatoru düzgün deyil.');
  const {rows}=await db.query(`insert into ${table}(actor_id,target_id,client_id,body) values($1,$2,$3,$4)
   on conflict(actor_id,client_id) do update set body=${table}.body returning body,target_id`,[actor,account.id,input.clientId,input.body.trim()]);
  if(rows[0].body!==input.body.trim()||rows[0].target_id!==account.id)throw fail(409,'Təkrar sorğunun məlumatı fərqlidir.');
 }else if(input?.action==='delete'){
  if(!uuid(input.id))throw fail(400,'Sınaq mesajını seçin.');
  await db.query('delete from '+table+' where id=$1 and actor_id=$2 and target_id=$3',[input.id,actor,account.id]);
 }else if(input)throw fail(400,'Sınaq əməliyyatı düzgün deyil.');
 const {rows}=await db.query(`select id,body,created_at as "createdAt",true as test from (
  select id,body,created_at from ${table} where actor_id=$1 and target_id=$2
  order by created_at desc,id desc limit 100) recent order by created_at,id`,[actor,account.id]);
 return {name:'Çiçək Məmmədova',avatarUrl:avatarSource(account),test:true,items:rows};
}
