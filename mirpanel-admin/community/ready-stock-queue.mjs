import {freeManagementClause} from './ready-stock-management.mjs';
import {drainReadyStock} from './ready-stock.mjs';

// The paid, still-undelivered orders are the durable queue. A restart therefore
// needs no in-memory job or new schema, and a failed transaction remains queued.
export function createReadyStockQueue(pool,securityFactory,{onDelivered=()=>{},pollMs=15000}={}){
 let timer,running,stopped=false,last=null,rerun=false;
 async function run(){
  const c=await pool.connect();
  try{
   await c.query('begin');
   // Share checkout's lock across processes without filling the pool with waits.
   const locked=(await c.query('select pg_try_advisory_xact_lock(714025001) acquired')).rows[0].acquired;
   if(!locked){await c.query('rollback');return {pending:true};}
   const result=await drainReadyStock(c,securityFactory);
   const free=await freeManagementClause(c);
   const remaining=(await c.query(`select count(*)::int n from mirpanel_community.ready_stock_units u where delivery_id is null${free}`)).rows[0].n;
   await c.query('commit');
   last={...result,remaining,checkedAt:new Date().toISOString(),pending:result.errors>0};
   console.info('READY_STOCK_QUEUE_RESULT',JSON.stringify(last));
   if(result.units)void Promise.resolve(onDelivered()).catch(()=>console.warn('READY_STOCK_QUEUE_NOTICE_RETRY'));
   return last;
  }catch{
   await c.query('rollback');
   last={pending:true,error:'READY_STOCK_QUEUE_RETRY',checkedAt:new Date().toISOString()};
   console.warn('READY_STOCK_QUEUE_RETRY');return last;
  }finally{c.release();}
 }
 function wake(){
  if(stopped)return Promise.resolve({pending:true});
  if(running){rerun=true;return running;}
  const request=(async()=>{
   let result;const total={orders:0,units:0,completed:0,errors:0};
   do{rerun=false;result=await run();for(const key of Object.keys(total))total[key]+=result[key]||0;}while(rerun&&!stopped);
   return {...result,...total};
  })()
   .catch(()=>({pending:true,error:'READY_STOCK_QUEUE_RETRY'})).finally(()=>{if(running===request)running=null;});
  return running=request;
 }
 return {wake,status:()=>last,start(){if(timer||stopped)return;void wake();timer=setInterval(()=>void wake(),pollMs);timer.unref?.();},
  async stop(){stopped=true;clearInterval(timer);timer=null;await running;}};
}
