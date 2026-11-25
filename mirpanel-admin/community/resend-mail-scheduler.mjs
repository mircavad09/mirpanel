// One shared provider gate across processes. No recipients, bodies or secrets stored here.
const marker='mirpanel-resend-sending-gate';
const retry=(reason,ms)=>Object.assign(Error(reason),{deliveryDisposition:'retry',deliveryCode:reason,retryAfterMs:Math.max(250,ms)});
export function scheduleResendMail(pool,send,{intervalMs=300}={}){
 const scheduled=async(kind,message)=>{
  const client=await pool.connect();let locked=false;
  try{
   await client.query('select pg_advisory_lock(715321,202611)');locked=true;
   const {rows}=await client.query('select value from mirpanel_community.verification where id=$1',[marker]);
   const gate=rows[0]?JSON.parse(rows[0].value):{},at=Date.now();
   if(gate.nextAt>at)throw Object.assign(retry(gate.reason||'SEND_RATE_LIMITED',gate.nextAt-at),{providerNotCalled:true});
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
 // Pause whole queues before claiming jobs. A quota rejection must not turn
 // every polling tick into another attempt, nor switch the sending provider.
 scheduled.deferQueued=async(table)=>{
  if(!['customer_order_mail','seller_mail'].includes(table))throw Error('MAIL_QUEUE_DENIED');
  const {rows}=await pool.query('select value from mirpanel_community.verification where id=$1',[marker]);
  const gate=rows[0]?JSON.parse(rows[0].value):{};
  if(!(gate.nextAt>Date.now()))return false;
  await pool.query(`update mirpanel_community.${table} set next_at=to_timestamp($1/1000.0),reason=$2
   where state='queued' and next_at<to_timestamp($1/1000.0)`,[gate.nextAt,gate.reason||'SEND_RATE_LIMITED']);
  return true;
 };
 return scheduled;
}
