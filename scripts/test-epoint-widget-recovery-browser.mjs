import http from 'node:http';import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {startEpointCheckout,readEpointCheckout,readEpointPayment} from '../mirpanel-admin/epoint-checkout.mjs';
import {reconcileEpoint} from '../mirpanel-admin/epoint-reconcile.mjs';
import {onRequest as paymentPage} from '../functions/odenis/epoint/[[path]].js';
const {chromium,webkit}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const env={EPOINT_PUBLIC_KEY:'synthetic',EPOINT_PRIVATE_KEY:'synthetic',EPOINT_TOKEN_WIDGET_ENABLED:'true',EPOINT_APPLE_PAY_ENABLED:'true',EPOINT_APPLE_DOMAIN_VERIFIED:'true'};
const f=await shopFixture();let ref,paid=false,orderChecks=0;
const send=async(url,options)=>{
 if(!url.endsWith('/get-status'))return Response.json({status:'success',widget_url:'https://epoint.az/widget/fixture'});
 const data=JSON.parse(Buffer.from(options.body.get('data'),'base64'));if(!data.transaction){assert.equal(data.order_id,'mp_ep_'+ref);orderChecks++;}
 return Response.json(paid?{status:'success',code:'000',amount:'6.00',transaction:'te_fixture_'+ref,order_id:'mp_ep_'+ref}:{status:'server_error',message:'record not found'});
};
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');res.setHeader('Content-Type','application/json');
 if(u.pathname.startsWith('/community-assets/')){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync('mirpanel-admin/community/public/'+u.pathname.split('/').pop()));return;}
 if(['/api/payments/epoint/checkout','/api/payments/epoint/status'].includes(u.pathname)){
  assert.equal(req.method,'GET');await reconcileEpoint(f.pool,ref,{env,send,user:'a'}).catch(()=>{});
  return res.end(JSON.stringify(await (u.pathname.endsWith('/checkout')?readEpointPayment(f.pool,'a',ref,{env}):readEpointCheckout(f.pool,'a',ref))));
 }
 if(u.pathname.startsWith('/odenis/epoint/')){const r=await paymentPage({request:new Request('https://mirpanel.com'+u.pathname+u.search)});res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(await r.text());}
 res.statusCode=404;res.end('{}');
}catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{for(const [name,engine] of [['chrome',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [390,1440]){
  ref=randomUUID();paid=false;orderChecks=0;await startEpointCheckout(f.pool,'a',{requestId:ref,amount:'6.00',method:'apple-pay'},{env,send});
  const context=await browser.newContext({viewport:{width,height:900},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15'});await context.addInitScript(()=>window.ApplePaySession={canMakePayments:()=>true});
  await context.route('https://epoint.az/widget/fixture',route=>route.fulfill({contentType:'text/html',body:`<button onclick="parent.postMessage({status:'success'},'*')">Synthetic result</button>`}));
  const page=await context.newPage();await page.goto(origin+'/odenis/epoint/odeme?ref='+ref);await page.waitForFunction(()=>document.querySelector('[data-apple-status]').textContent.startsWith('Rəsmi '));
  assert.equal((await f.pool.query('select candidate_transaction from mirpanel_community.epoint_checkout_requests where id=$1',[ref])).rows[0].candidate_transaction,null);
  paid=true;await f.pool.query("update mirpanel_community.epoint_checkout_requests set next_check_at=clock_timestamp()-interval '1 second' where id=$1",[ref]);
  await page.frameLocator('iframe').getByRole('button').click();await page.waitForURL('**/odenis/epoint/ugurlu?*');await page.getByRole('heading',{name:'Balansınız uğurla artırıldı',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Balansınız uğurla artırıldı',exact:true}).waitFor();
  assert.equal((await f.pool.query("select count(*)::int n from mirpanel_community.wallet_ledger where request_id=$1 and kind='topup_credit'",[ref])).rows[0].n,1);assert.ok(orderChecks>=2);
  await context.close();console.log('PASS '+name+' '+width+': callback and transaction hint absent, server order lookup, verified success screen, reload, one 6 AZN credit; synthetic only');
 }}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));await f.close();}
