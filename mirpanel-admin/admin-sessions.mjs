import crypto from 'node:crypto';
export const ADMIN_IDLE_MS=60*60*1000;
// Only hashed bearer IDs are stored. Password changes invalidate existing sessions.
export function createAdminSessions({client,username,password,secret,now=Date.now}){
 const memory=new Map();
 const hash=id=>crypto.createHash('sha256').update(id).digest('hex');
 const binding=crypto.createHmac('sha256',secret||password).update(JSON.stringify([username,password])).digest('hex');
 const csrf=id=>crypto.createHmac('sha256',secret||password).update('admin-csrf:'+id).digest('hex');
 async function action(kind,id){
  if(!/^[a-f0-9]{64}$/.test(id||''))return null;
  if(client){const {data,error}=await client.rpc('admin_session_action',{p_action:kind,p_hash:hash(id),p_binding:binding});
   if(error)throw Object.assign(Error('Admin sessiya xidməti cavab vermir. Yenidən cəhd edin.'),{status:503,code:'ADMIN_SESSION_STORE_UNAVAILABLE'});
   return data?.expiresAt?{role:'admin',expiresAt:Date.parse(data.expiresAt),csrfToken:csrf(id)}:null;}
  // Isolated installations without a configured database only. Production uses RPC.
  const key=hash(id);let row=memory.get(key);
  if(kind==='revoke'){memory.delete(key);return null;}
  if(kind==='create')row={expiresAt:now()+ADMIN_IDLE_MS};
  else if(!row||row.expiresAt<=now()){memory.delete(key);return null;}
  else if(kind==='touch')row.expiresAt=now()+ADMIN_IDLE_MS;
  memory.set(key,row);return {...row,role:'admin',csrfToken:csrf(id)};
 }
 return {create:async()=>{const id=crypto.randomBytes(32).toString('hex');return{id,session:await action('create',id)};},read:id=>action('read',id),touch:id=>action('touch',id),revoke:id=>action('revoke',id)};
}
