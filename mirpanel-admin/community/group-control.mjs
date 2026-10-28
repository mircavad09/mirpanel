import crypto from 'node:crypto';
const fail=(status,message)=>Object.assign(Error(message),{status});
export async function groupRole(pool,id){if(!id)return null;return (await pool.query('select role from community_group_roles where user_id=$1',[id])).rows[0]?.role||null;}
export async function requireAllowed(pool,id){if(!id)return;const p=(await pool.query('select blocked,ban_until from community_profiles where user_id=$1',[id])).rows[0];if(p?.blocked&&(!p.ban_until||new Date(p.ban_until)>new Date()))throw fail(403,'Hesabınıza giriş bağlanıb.');}
export async function requireOwner(pool,user){if(!user)throw fail(401,'Əvvəlcə daxil olun.');await requireAllowed(pool,user.id);if(await groupRole(pool,user.id)!=='owner')throw fail(403,'Yalnız sahib-admin üçün icazə verilir.');}
export class GroupControl{
 constructor(repo){this.repo=repo;this.pool=repo.pool;}
 async settings(){const s=(await this.pool.query('select muted,rules,slow_seconds,pinned_message_id::text,version from community_group_settings where id=true')).rows[0];if(s?.pinned_message_id){const m=(await this.pool.query('select id::text,user_id,body,created_at from community_messages where id=$1 and not hidden',[s.pinned_message_id])).rows[0];s.pinned=m?{id:m.id,body:m.body,createdAt:m.created_at}:null;}return s;}
 async act(actor,b){
  await requireOwner(this.pool,actor);
  const {action,targetId,reason,minutes=null,requestId}=b;
  if(!/^[a-f0-9-]{36}$/i.test(requestId||''))throw fail(400,'Əməliyyat identifikatoru tələb olunur.');
  if(typeof reason!=='string'||reason.trim().length<3||reason.length>300)throw fail(400,'Səbəb 3–300 simvol olmalıdır.');
  if(!['delete','hide','mute','unmute','ban','unban','pin','unpin','settings','resolve-report'].includes(action))throw fail(400,'Əməliyyat tanınmadı.');
  const hash=crypto.createHash('sha256').update(JSON.stringify({action,targetId:targetId??null,reason:reason.trim(),minutes,confirmed:b.confirmed===true,muted:b.muted,rules:b.rules,slowSeconds:b.slowSeconds})).digest('hex');
  return this.repo.tx(async c=>{
   const cfg=(await c.query('select * from community_group_settings where id=true for update')).rows[0];if(!cfg?.enabled)throw fail(503,'Qrup idarəsi bağlıdır.');await requireOwner(c,actor);
   const old=(await c.query('select * from community_moderation_requests where actor_id=$1 and request_id=$2',[actor.id,requestId])).rows[0];if(old){if(old.payload_hash!==hash)throw fail(409,'Bu əməliyyat açarı başqa sorğuda istifadə edilib.');return old.result;}
   const details={};let target=String(targetId||'group'),changed=false;
   if(['mute','unmute','ban','unban'].includes(action)){
    if(await groupRole(c,target)==='owner')throw fail(403,'Sahib-admin hesabını məhdudlaşdırmaq olmaz.');
    const p=(await c.query('select * from community_profiles where user_id=$1 for update',[target])).rows[0];if(!p)throw fail(404,'İstifadəçi tapılmadı.');
    if(['mute','ban'].includes(action)&&minutes!==null&&(!Number.isInteger(minutes)||minutes<1||minutes>525600))throw fail(400,'Müddət 1–525600 dəqiqə və ya daimi olmalıdır.');
    if(action==='ban'&&b.confirmed!==true)throw fail(400,'Ban əməliyyatını təsdiqləyin.');
    if(action==='mute')await c.query("update community_profiles set muted_permanent=$2,muted_until=case when $2 then null else clock_timestamp()+$3*interval '1 minute' end where user_id=$1",[target,minutes===null,minutes]);
    if(action==='unmute')await c.query('update community_profiles set muted_permanent=false,muted_until=null where user_id=$1',[target]);
    if(action==='ban')await c.query("update community_profiles set blocked=true,ban_until=case when $2::int is null then null else clock_timestamp()+$2*interval '1 minute' end where user_id=$1",[target,minutes]);
    if(action==='unban')await c.query('update community_profiles set blocked=false,ban_until=null where user_id=$1',[target]);
    details.minutes=minutes;details.permanent=minutes===null;changed=true;
   }else if(action==='delete'||action==='hide'){
    if(!/^\d+$/.test(target))throw fail(400,'Mesaj ID-si düzgün deyil.');const r=await c.query('update community_messages set hidden=true where id=$1 and hidden=false',[target]);
    if(!r.rowCount&&!(await c.query('select 1 from community_messages where id=$1',[target])).rowCount)throw fail(404,'Mesaj tapılmadı.');
    await c.query('update community_group_settings set pinned_message_id=null where pinned_message_id=$1',[target]);changed=!!r.rowCount;
   }else if(action==='pin'){
    if(!/^\d+$/.test(target)||!(await c.query('select 1 from community_messages where id=$1 and not hidden',[target])).rowCount)throw fail(404,'Mesaj tapılmadı.');changed=String(cfg.pinned_message_id)!==target;await c.query('update community_group_settings set pinned_message_id=$1 where id=true',[target]);
   }else if(action==='unpin'){changed=cfg.pinned_message_id!==null;await c.query('update community_group_settings set pinned_message_id=null where id=true');
   }else if(action==='settings'){
    if(typeof b.muted!=='boolean'||typeof b.rules!=='string'||b.rules.length>4000||!Number.isInteger(b.slowSeconds)||b.slowSeconds<0||b.slowSeconds>3600)throw fail(400,'Qrup ayarları düzgün deyil.');
    details.before={muted:cfg.muted,rules:cfg.rules,slowSeconds:cfg.slow_seconds};details.after={muted:b.muted,rules:b.rules.trim(),slowSeconds:b.slowSeconds};
    await c.query('update community_group_settings set muted=$1,rules=$2,slow_seconds=$3,version=version+1 where id=true',[b.muted,b.rules.trim(),b.slowSeconds]);changed=true;
   }else if(action==='resolve-report'){
    if(!/^\d+$/.test(target))throw fail(400,'Şikayət ID-si düzgün deyil.');const r=await c.query("update community_reports set status='resolved',resolved_by=$2,resolved_at=clock_timestamp() where id=$1 and status='open'",[target,actor.id]);changed=!!r.rowCount;
   }
   if(changed)await c.query('insert into community_audit(actor_id,action,target_id,reason,details) values($1,$2,$3,$4,$5)',[actor.id,action,target,reason.trim(),details]);
   const result={ok:true};await c.query('insert into community_moderation_requests(actor_id,request_id,payload_hash,result) values($1,$2,$3,$4)',[actor.id,requestId,hash,result]);return result;
  });
 }
 async report(user,{messageId,reason}){
  if(!user)throw fail(401,'Əvvəlcə daxil olun.');await requireAllowed(this.pool,user.id);if(!user.emailVerified)throw fail(403,'E-poçtu təsdiqləyin.');
  if(!/^\d+$/.test(String(messageId))||typeof reason!=='string'||reason.trim().length<3||reason.length>300)throw fail(400,'Şikayət səbəbini yazın.');
  return this.repo.tx(async c=>{await c.query('select id from "user" where id=$1 for update',[user.id]);if(!(await c.query('select 1 from community_messages where id=$1',[messageId])).rowCount)throw fail(404,'Mesaj tapılmadı.');const old=await c.query('select id from community_reports where message_id=$1 and reporter_id=$2',[messageId,user.id]);if(old.rowCount)return{ok:true};if((await c.query("select count(*)::int n from community_reports where reporter_id=$1 and created_at>clock_timestamp()-interval '1 hour'",[user.id])).rows[0].n>=10)throw fail(429,'Şikayət limitinə çatdınız.');await c.query('insert into community_reports(message_id,reporter_id,reason) values($1,$2,$3)',[messageId,user.id,reason.trim()]);return{ok:true};});
 }
 async review(actor,{kind='audit',page=1}={}){await requireOwner(this.pool,actor);page=Number(page);if(!Number.isInteger(page)||page<1||page>10000)throw fail(400,'Səhifə düzgün deyil.');const offset=(page-1)*30;
  const sql=kind==='reports'?`select r.id::text,r.message_id::text,r.reporter_id,r.reason,r.status,r.created_at,r.resolved_by,m.body,m.hidden from community_reports r join community_messages m on m.id=r.message_id order by r.id desc limit 31 offset $1`:kind==='users'?`select p.user_id,p.display_name,p.blocked,p.ban_until,p.muted_until,p.muted_permanent from community_profiles p order by p.user_id limit 31 offset $1`:`select a.id::text,a.actor_id,p.display_name actor_name,a.action,a.target_id,a.reason,a.details,a.created_at from community_audit a left join community_profiles p on p.user_id=a.actor_id order by a.id desc limit 31 offset $1`;
  const rows=(await this.pool.query(sql,[offset])).rows;if(kind==='users')for(const row of rows){const reasons=(await this.pool.query("select distinct on (action) action,reason from community_audit where target_id=$1 and action in ('ban','mute') order by action,id desc",[row.user_id])).rows;row.ban_reason=reasons.find(r=>r.action==='ban')?.reason||null;row.mute_reason=reasons.find(r=>r.action==='mute')?.reason||null;}return{items:rows.slice(0,30),more:rows.length>30,page};
 }
}
