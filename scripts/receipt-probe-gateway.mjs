// Ephemeral, localhost-only gateway. It cannot connect to a production database.
import fs from'node:fs';import http from'node:http';import crypto from'node:crypto';
import{localEmployeeDatabase,legacyEmployeeBootstrap}from'./employee-local-postgres.mjs';
const db=await localEmployeeDatabase(),{sql}=db,run=crypto.randomUUID(),method=crypto.randomUUID(),key=crypto.randomBytes(32).toString('base64url');
await legacyEmployeeBootstrap(db);await db.exec(db.read('supabase/migrations/202610250002_browser_orders.sql'));
await sql.unsafe("insert into payment_methods(id,stable_code,display_name,provider_name,method_type,last4,encrypted_number,sort_order,daily_limit,limit_mode,active) values($1,'receipt-probe','Synthetic ABB','ABB','bank_card','0000','synthetic',1,10000,'unlimited',true)",[method]);
const rpc=async(n,a)=>(await sql.unsafe(`select ${n}(${a.map((_,i)=>'$'+(i+1)).join(',')}) as v`,a))[0].v;
const handlers={
 meta:async()=>({run}),publicMethods:async()=>[{id:method,providerName:'ABB',displayName:'Synthetic ABB',type:'bank_card',last4:'0000',available:true,status:'active',resolvedTheme:'abb'}],
 rawMethod:async id=>{if(id!==method)throw Error('METHOD');return(await sql.unsafe('select * from payment_methods where id=$1',[method]))[0];},
 reserve:async a=>{if(a.methodId!==method||a.productId!=='receipt-live-synthetic'||a.planId!=='0'||a.amount!==5.99)throw Error('BOUNDARY');const r=await rpc('reserve_payment_method_v3',[method,a.productId,a.planId,5.99,'AZN',a.idempotencyKey,a.checkoutKey,a.previousReservationId||null,10]);return{id:r.id,expiresAt:r.expiresAt};},
 reservation:async(i,k)=>{const r=(await sql.unsafe('select * from payment_reservations where id=$1 and checkout_key=$2',[i,k]))[0];if(!r)throw Error('RESERVATION');return r;},
 orderByReservation:async i=>(await sql.unsafe('select * from payment_orders where reservation_id=$1',[i]))[0]||null,
 order:async i=>(await sql.unsafe('select * from payment_orders where id=$1',[i]))[0]||null,
 submit:async a=>{if(a.productId!=='receipt-live-synthetic'||a.planId!=='0')throw Error('BOUNDARY');return rpc('submit_payment_order_browser',[a.reservationId,a.checkoutKey,a.productId,a.planId,a.productTitle,a.planName,a.receiptBucket,a.receiptPath,a.receiptMime,a.receiptSize,a.receiptSha256,a.durationMonths||null,a.browserOwnerHash]);},
 ready:()=>rpc('browser_orders_ready',[]),page:(h,t,i)=>sql.unsafe('select * from browser_orders_page($1,$2,$3,21)',[h,t,i]),
 owned:async(h,i)=>(await sql.unsafe('select o.* from payment_orders o join browser_order_owners b on b.order_id=o.id where b.token_hash=$1 and o.id=$2',[h,i]))[0]||null,
};
const server=http.createServer(async(req,res)=>{const reply=(s,v)=>{res.writeHead(s,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(v));};try{const auth=req.headers.authorization||'',expected='Bearer '+key;if(auth.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(auth),Buffer.from(expected)))return reply(403,{});if(req.method!=='POST'||req.url!=='/rpc')return reply(404,{});const chunks=[];let n=0;for await(const b of req){n+=b.length;if(n>64000)return reply(413,{});chunks.push(b);}const{op,args}=JSON.parse(Buffer.concat(chunks));if(!Object.hasOwn(handlers,op)||!Array.isArray(args)||args.length>4)return reply(400,{});reply(200,{value:await handlers[op](...args)});}catch{reply(503,{code:'PROBE_DATABASE_OPERATION_FAILED'});}});
await new Promise(r=>server.listen(8768,'127.0.0.1',r));fs.mkdirSync('payment-test-artifacts/live-receipt-probe',{recursive:true});fs.writeFileSync('payment-test-artifacts/live-receipt-probe/private.json',JSON.stringify({key,run,port:8768,pid:process.pid,database:db.name}));console.log(JSON.stringify({ready:true,port:8768,localOnly:true,productionDatabase:false}));
async function stop(){await new Promise(r=>server.close(r));await db.close();process.exit(0);}process.on('SIGTERM',stop);process.on('SIGINT',stop);
