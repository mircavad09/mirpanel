// One shared provider gate across processes. No recipients, bodies or secrets stored here.
const marker='mirpanel-resend-sending-gate';
const retry=(reason,ms)=>Object.assign(Error(reason),{deliveryDisposition:'retry',deliveryCode:reason,retryAfterMs:Math.max(250,ms)});
export function scheduleResendMail(pool,send,{intervalMs=300}={}){
 return async(kind,message)=>{
  const client=await pool.connect();let locked=false;
  try{
   await client.query('select pg_advisory_lock(715321,202611)');locked=true;
   const {rows}=await client.query('select value from mirpanel_community.verification where id=$1',[marker]);
   const gate=rows[0]?JSON.parse(rows[0].value):{},at=Date.now();
   if(gate.nextAt>at)throw retry(gate.reason||'SEND_RATE_LIMITED',gate.nextAt-at);
   const save=(nextAt,reason)=>client.query(`insert into mirpanel_community.verification(id,identifier,value,"expiresAt") values($1,$1,$2,'9999-12-31') on conflict(id) do update set value=excluded.value,"updatedAt"=now()`,[marker,JSON.stringify({nextAt,reason})]);
   // Reserve before the outbound request; restart cannot erase the last slot.
   await save(at+intervalMs,'SEND_RATE_LIMITED');
   try{return await send(kind,message);}
   catch(e){
    if(e.deliveryDisposition==='retry'&&['SEND_RATE_LIMITED','SEND_DAILY_QUOTA','SEND_MONTHLY_QUOTA'].includes(e.deliveryCode))await save(Date.now()+Math.max(intervalMs,Number(e.retryAfterMs)||2000),e.deliveryCode);
    throw e;
   }
  }finally{let broken=false;if(locked)try{await client.query('select pg_advisory_unlock(715321,202611)');}catch{broken=true;}client.release(broken);}
 };
}
