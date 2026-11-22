import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
import {createPaymentStore} from '../mirpanel-admin/payment-store.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {imageReceipt,pdfReceipt} from './receipt-synthetic-fixtures.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,rpc,id,method}=f;
await f.db.exec(f.db.read('mirpanel-admin/community/payment-history-number-migration.sql'));
const output=path.resolve('../../outputs/topup-receipt-recovery');
await fs.mkdir(output,{recursive:true});
const config={supabaseUrl:'http://127.0.0.1:1',supabaseSecretKey:'synthetic-key',receiptsBucket:'synthetic-private',
 encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64'),
 allowedOrigins:[],maxReceiptBytes:5242880,productCardPaymentsPaused:true,browserOrdersEnabled:true};
const security=createPaymentSecurity(config);
await pool.query("update payment_methods set holder_name='Nümunə',encrypted_number=$2 where id=$1",[method,security.encryptNumber('4000000000000001')]);
const stored=new Map();
let writes=0,safety=0,active=0,maxActive=0,delay=0,loseAfterStorage=false,loseResponse=false,loseSubmit=false;
const store={...f.store,inventorySnapshot:()=>rpc('inventory_snapshot'),
 rawMethod:async()=>({id:method,active:true,display_name:'Sınaq bankı',provider_name:'ABB',holder_name:'Nümunə',method_type:'bank_card',last4:'0001',encrypted_number:security.encryptNumber('4000000000000001')}),
 publicMethods:async()=>[{id:method,available:true,displayName:'Sınaq bankı',providerName:'ABB',last4:'0001'}],
 async uploadReceipt(key,receipt){
  writes++;active++;maxActive=Math.max(maxActive,active);
  try{
   if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
   stored.set(key,{size:receipt.buffer.length,bytes:receipt.buffer});
   if(loseAfterStorage){loseAfterStorage=false;throw Object.assign(Error('Sınaq saxlanma cavabı kəsildi'),{status:504});}
  }finally{active--;}
 },
 async verifyUploadedReceipt(key,size){
  if(stored.get(key)?.size!==size)throw Object.assign(Error('Çek tapılmadı'),{status:409,code:'RECEIPT_CONFIRMATION_INVALID'});
 },
 async hasUploadedReceipt(key,size){return stored.get(key)?.size===size;}
};
const raw=async(req,max)=>{let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Object.assign(Error('Fayl maksimum 5 MB ola bilər.'),{status:413});parts.push(chunk);}return Buffer.concat(parts);};
let system,origin,productionRate;
const json=(res,status,data,headers={})=>{
 const p=new URL(res.req.url,origin).pathname;
 if(loseResponse&&p==='/api/payments/shop/receipt'&&status===200){loseResponse=false;res.destroy();return;}
 if(loseSubmit&&p==='/api/payments/shop/topup/submit'&&status===200){loseSubmit=false;res.destroy();return;}
 res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(data));
};
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,origin||'http://local'),p=u.pathname;
  if(p==='/rest/v1/rpc/consume_payment_rate_limit'){
   const b=JSON.parse((await raw(req,4096)).toString());
   const value=(await pool.query('select consume_payment_rate_limit($1,$2,$3) v',[b.p_rate_key,b.p_window_seconds,b.p_max_hits])).rows[0].v;
   return json(res,200,value);
  }
  req.headers['cf-connecting-ip']='192.0.2.20';
  if(p.startsWith('/api/payments/'))return await system.handle(req,res);
  if(p==='/api/community/state')return json(res,200,{profile:{user_id:'a',emailVerified:true,balanceCents:0}});
  if(p.startsWith('/api/'))return json(res,200,{});
  if(p==='/balans')return res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/community-assets/shop.css"><body class="community-page"><main id="shopApp" class="shop-page"></main><script type="module" src="/community-assets/shop-ui.js"></script>');
  const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
  if(file.includes('..'))return res.writeHead(404).end();
  const body=await fs.readFile(file).catch(()=>null);
  if(!body)return res.writeHead(404).end();
  res.writeHead(200,{'Content-Type':p.endsWith('.js')||p.endsWith('.mjs')?'text/javascript':p.endsWith('.css')?'text/css':'image/png'}).end(body);
 }catch(error){if(!res.destroyed)json(res,error.status||500,{error:error.message,code:error.code});}
});
const userFor=req=>req.headers.cookie?.includes('qa_user=b')?'b':req.headers.cookie?.includes('qa_user=a')?'a':null;
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const request=async(endpoint,{user='a',body,bytes,mime='application/json'}={})=>{
 const response=await fetch(origin+'/api/payments/shop/'+endpoint,{method:body||bytes?'POST':'GET',
  headers:{cookie:'qa_user='+user,Origin:origin,'Content-Type':bytes?mime:'application/json'},body:bytes|| (body?JSON.stringify(body):undefined)});
 return {status:response.status,headers:response.headers,data:await response.json()};
};
const draft=async(user='a')=>(await request('topup',{user,body:{amount:'5',methodId:method,requestId:id()}})).data.id;
const receipt=(topup,attempt,bytes,mime='image/png',user='a')=>request('receipt?kind=topup&id='+topup+'&attempt='+attempt,{user,bytes,mime});
const resetRates=()=>pool.query('delete from payment_rate_limits');
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 config.allowedOrigins=[origin];config.supabaseUrl=origin;
 productionRate=createPaymentStore(config);
 store.rateLimit=(...args)=>productionRate.rateLimit(...args);
 system=createPaymentSystem({config,store,json,readBody:async(req,max)=>JSON.parse((await raw(req,max)).toString()),
  readRawBody:raw,requireAuth:()=>false,requireMutationAuth:()=>false,
  loadCatalog:async()=>f.catalog,actorName:'synthetic-admin',shopContext:async req=>({pool,user:userFor(req)}),
  mailer:{start(){},async drain(){}},validateReceiptFile:async receipt=>{
   safety++;
   const {validateReceiptFile}=await import('../mirpanel-admin/receipt-file-safety.mjs');
   return validateReceiptFile(receipt);
  }});
 const png=await imageReceipt(),jpg=await imageReceipt('Android',{},'image/jpeg'),pdf=pdfReceipt();
 // Reproduce the old shared-IP key with the exact production PostgreSQL limiter.
 const legacyKey='shop:'+security.ipHash('192.0.2.20');
 for(let n=0;n<100;n++)await store.rateLimit(legacyKey,60,100);
 await assert.rejects(store.rateLimit(legacyKey,60,100),error=>error.status===429&&error.retryAfter>0);
 checks++;
 const topup=await draft(),attempt=id(),before=writes;
 eq((await receipt(topup,attempt,png)).status,200,'upload unaffected by exhausted generic read budget');
 for(let n=0;n<9;n++)eq((await receipt(topup,attempt,png)).status,200);
 eq(writes,before+1,'replay does not create another object');
 const limited=await receipt(topup,attempt,png);
 eq(limited.status,429);
 assert(limited.data.retryAfter>=1&&limited.data.retryAfter<=60);checks++;
 eq(Number(limited.headers.get('retry-after')),limited.data.retryAfter);
 const topupB=await draft('b');
 eq((await receipt(topupB,id(),png,'image/png','b')).status,200,'second account sharing IP retains upload budget');
 eq((await request('topup?id='+topup,{user:'b'})).status,404);
 await resetRates();
 const concurrent=await draft(),concurrentAttempt=id(),prior=writes;
 delay=400;
 const race=await Promise.all([receipt(concurrent,concurrentAttempt,jpg,'image/jpeg'),receipt(concurrent,concurrentAttempt,jpg,'image/jpeg')]);
 eq(race.map(item=>item.status),[200,200]);eq(writes,prior+1,'one flight for simultaneous requests');
 delay=0;
 const orphan=await draft(),orphanAttempt=id(),preOrphan=writes;
 loseAfterStorage=true;
 eq((await receipt(orphan,orphanAttempt,pdf,'application/pdf')).status,504);
 eq((await receipt(orphan,orphanAttempt,pdf,'application/pdf')).status,200);
 eq(writes,preOrphan+1,'stored object before lost acknowledgement recovered');
 eq((await request('topup?id='+orphan)).data.receiptRequestId,orphanAttempt);
 const submissions=await Promise.all([
  request('topup/submit',{body:{id:orphan}}),request('topup/submit',{body:{id:orphan}})
 ]);
 eq(submissions.map(result=>result.status),[200,200],'parallel submit replays one topup');
 eq((await pool.query("select count(*)::int n from wallet_topups where id=$1 and status='reviewing'",[orphan])).rows[0].n,1);
 eq((await pool.query('select count(*)::int n from wallet_ledger')).rows[0].n,0);

 eq((await receipt(await draft(),id(),Buffer.alloc(5242881))).status,413);
 eq((await request('topup',{user:'',body:{}})).status,401,'anonymous access requires sign-in');
 eq((await pool.query("select hit_count from payment_rate_limits where rate_key like 'topup-access:%' order by window_start desc limit 1")).rows[0].hit_count,1);
 console.log('PASS production HTTP+PostgreSQL limiter: shared-IP failure reproduced, separate account budgets, Retry-After, parallel upload, stored-file recovery, 5 MB.');

 for(const [engine,width] of (process.argv.includes('--http-only')?[]:[[chromium,390],[webkit,390]])){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   await resetRates();
   const context=await browser.newContext({viewport:{width,height:900}});
   await context.addCookies([{name:'qa_user',value:'a',url:origin}]);
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/balans');
   await page.getByRole('button',{name:/Bu kartla davam et/}).click();
   const input=page.getByLabel('Çek faylı',{exact:true}),send=page.getByRole('button',{name:'Balans əlavə et',exact:true});
   const upload=async(name,buffer,mimeType)=>input.setInputFiles({name,buffer,mimeType});
   for(const [name,buffer,mime]of [['çek.jpg',jpg,'image/jpeg'],['çek.png',png,'image/png'],['çek.pdf',pdf,'application/pdf']]){
    const count=writes;
    delay=1000;
    await upload(name,buffer,mime);
    eq(await send.isDisabled(),true,'submit disabled during slow upload');
    await page.getByText('Çek uğurla yükləndi',{exact:true}).waitFor();
    eq(writes,count+1,name+' one upload');
    eq(await send.isEnabled(),true);
   }
   delay=0;
   await resetRates();
   let uploadRequests=0,fail429=true;
   await page.route('**/api/payments/shop/receipt?*',async route=>{
    uploadRequests++;
    if(fail429){fail429=false;return route.fulfill({status:429,headers:{'Retry-After':new Date(Date.now()+3000).toUTCString()},
     json:{error:'Çox sayda sorğu göndərilib.',retryAfter:3}});}
    return route.continue();
   });
   await upload('429 çek.png',png,'image/png');
   const retry=page.getByRole('button',{name:/Yenidən cəhd et/});
   await page.getByText(/saniyə sonra yenidən cəhd/).waitFor();
   eq(await retry.isDisabled(),true);eq(await send.isDisabled(),true);
   eq(await input.evaluate(e=>e.files[0].name),'429 çek.png');
   await page.locator('.wallet-receipt').screenshot({path:path.join(output,engine.name()+'-429.png')});
   await page.waitForTimeout(3500);
   eq(uploadRequests,1,'no automatic resend after countdown');
   eq(await retry.isEnabled(),true);
   eq(await page.locator('.wallet-bank-fields').innerText().then(x=>x.includes('5.00')),true,'amount retained');
   await retry.click();
   await page.getByText('Çek uğurla yükləndi',{exact:true}).waitFor();
   eq(uploadRequests,2);
   await page.unroute('**/api/payments/shop/receipt?*');
   await resetRates();
   let offline=true;
   await page.route('**/api/payments/shop/receipt?*',route=>{if(offline){offline=false;return route.abort('connectionreset');}return route.continue();});
   await upload('offline.jpg',jpg,'image/jpeg');
   await page.getByRole('button',{name:'Yenidən cəhd et',exact:true}).waitFor();
   eq(await send.isDisabled(),true);
   await page.getByRole('button',{name:'Yenidən cəhd et',exact:true}).click();
   await page.getByText('Çek uğurla yükləndi',{exact:true}).waitFor();
   await page.unroute('**/api/payments/shop/receipt?*');
   await resetRates();
   loseResponse=true;
   const preLost=writes;
   await upload('lost-response.png',await imageReceipt('Lost acknowledgement'),'image/png');
   await page.getByText('Çek uğurla yükləndi',{exact:true}).waitFor();
   eq(writes,preLost+1,'lost HTTP response recovered from draft');
   await resetRates();
   delay=500;
   const preDouble=writes;
   await upload('double.pdf',pdfReceipt('Double click'),'application/pdf');
   await input.evaluate(e=>{e.dispatchEvent(new Event('change'));e.dispatchEvent(new Event('change'));});
   await page.getByText('Çek uğurla yükləndi',{exact:true}).waitFor();
   eq(writes,preDouble+1,'duplicate change events stay single flight');
   delay=0;
   let blockedSubmit=true,submitRequests=0;
   await page.route('**/api/payments/shop/topup/submit',route=>{
    submitRequests++;
    if(blockedSubmit){blockedSubmit=false;return route.fulfill({status:429,headers:{'Retry-After':'2'},json:{error:'Limit',retryAfter:2}});}
    return route.continue();
   });
   await send.click();
   await page.getByText(/saniyə sonra yenidən cəhd/).waitFor();
   eq(await send.isDisabled(),true);
   await page.waitForTimeout(2300);eq(submitRequests,1);
   eq(await send.isEnabled(),true);
   const draftId=await page.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.topup.v2.a')).id);
   loseSubmit=true;
   await send.evaluate(e=>{e.click();e.click();});
   await page.getByRole('heading',{name:'Ödəniş uğurla əlavə edildi!',exact:true}).waitFor();
   eq(submitRequests,2);
   eq((await pool.query("select status from wallet_topups where id=$1",[draftId])).rows[0].status,'reviewing');
   eq((await pool.query("select count(*)::int n from wallet_ledger")).rows[0].n,0);
   eq(errors,[]);
   await page.screenshot({path:path.join(output,engine.name()+'-submitted.png')});
   console.log('PASS',engine.name(),width,'JPG PNG PDF, slow upload, connection reset, repeated change/click, Retry-After countdown, saved file and amount, one reviewing topup, no wallet credit.');
   await context.close();
  }finally{await browser.close();}
 }
 eq((await pool.query('select count(*)::int n from wallet_ledger')).rows[0].n,0);
 console.log(JSON.stringify({checks,writes,safety,maxActive,productionWrites:0,realBalancesChanged:0}));
}finally{
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await f.close();
}
