import fs from 'node:fs';
import crypto from 'node:crypto';
import {requireOwner} from './group-control.mjs';
export const GROUP_CLOSED='Qrup söhbəti müvəqqəti bağlıdır';
const pending=new WeakMap();
export function ensurePublicGroup(pool){if(!pending.has(pool)){const p=(async()=>{const c=await pool.connect();try{await c.query(fs.readFileSync(new URL('./public-group.sql',import.meta.url),'utf8'));}catch(e){await c.query('rollback');throw e;}finally{c.release();}})().catch(e=>{pending.delete(pool);throw e;});pending.set(pool,p);}return pending.get(pool);}
export async function publicGroupOpen(pool){try{return (await pool.query("select coalesce((to_jsonb(g)->>'public_open')::boolean,false) opened from mirpanel_community.community_group_settings g where id=true")).rows[0]?.opened===true;}catch{return false;}}
export async function requirePublicGroup(pool){if(!await publicGroupOpen(pool))throw Object.assign(Error(GROUP_CLOSED),{status:403,code:'GROUP_TEMPORARILY_CLOSED'});}
export async function setPublicGroup(repo,owner,{open,requestId}={}){
 await requireOwner(repo.pool,owner);if(typeof open!=='boolean'||!/^[a-f0-9-]{36}$/i.test(requestId||''))throw Object.assign(Error('Qrup vəziyyəti və əməliyyat açarı tələb olunur.'),{status:400});
 await ensurePublicGroup(repo.pool);
 return repo.tx(async c=>{await requireOwner(c,owner);await c.query('select id from mirpanel_community.community_group_settings where id=true for update');
  const hash=crypto.createHash('sha256').update('public-group:'+open).digest('hex');const old=(await c.query('select payload_hash,result from mirpanel_community.community_moderation_requests where actor_id=$1 and request_id=$2',[owner.id,requestId])).rows[0];if(old){if(old.payload_hash!==hash)throw Object.assign(Error('Təkrar sorğu uyğun deyil.'),{status:409});return old.result;}
  await c.query('update mirpanel_community.community_group_settings set public_open=$1,version=version+1 where id=true',[open]);
  await c.query("insert into mirpanel_community.community_audit(actor_id,action,target_id,reason,details) values($1,'public-access','group',$2,$3)",[owner.id,open?'Sahib ictimai qrupu yenidən açdı':'Sahib ictimai qrupu müvəqqəti bağladı',{publicOpen:open,historyPreserved:true}]);
  const result={open,message:open?'Qrup söhbəti açıqdır':GROUP_CLOSED};await c.query('insert into mirpanel_community.community_moderation_requests(actor_id,request_id,payload_hash,result) values($1,$2,$3,$4)',[owner.id,requestId,hash,result]);return result;
 },{kind:'moderation',action:'public-access'});
}
