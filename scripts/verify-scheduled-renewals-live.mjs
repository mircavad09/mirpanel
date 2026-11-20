// Read-only business verification. Only admin authentication login/logout writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const before=process.argv.includes('--before'),out='payment-test-artifacts/scheduled-renewals';fs.mkdirSync(out,{recursive:true});
const key=fs.readFileSync(path.join(process.env.USERPROFILE,'.render/cli.yaml'),'utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const envResponse=await fetch('https://api.render.com/v1/services/srv-dbse90u1egvs73djpp2g/env-vars?limit=100',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(30000)});assert(envResponse.ok,'Render read access required');
const env=Object.fromEntries((await envResponse.json()).map(x=>[x.envVar.key,x.envVar.value]));
const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},max:1,connectionTimeoutMillis:20000});
const base='https://mirpanel-frankfurt.onrender.com',req=(p,opts={})=>fetch(base+p,{...opts,signal:AbortSignal.timeout(60000),redirect:'manual'});let cookie,csrf,browser;
const report={checkedAt:new Date().toISOString(),businessWrites:0,stage:before?'before':'after'};
try{
 const c=await pool.connect();try{await c.query('begin read only');
  const legacy=(await c.query('select * from mirpanel_community.subscription_renewals order by checkout_id,source_id')).rows;
  report.legacyRenewalRows=legacy.length;
  const saved={checkedAt:report.checkedAt,legacy,functions:(await c.query("select p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='mirpanel_community' and p.proname in ('apply_subscription_renewal','finish_scheduled_renewal','cancel_scheduled_renewal_order')")).rows};
  fs.writeFileSync(out+'/'+(before?'before-backup':'after-readback')+'.json',JSON.stringify(saved,null,2));
  const installed=(await c.query("select to_regclass('mirpanel_community.scheduled_renewals') present")).rows[0].present;report.schemaInstalled=!!installed;
  if(installed){report.scheduled=(await c.query('select state,count(*)::int count from mirpanel_community.scheduled_renewals group by state')).rows;report.deliveryTrigger=(await c.query("select count(*)::int n from pg_trigger where tgname='scheduled_renewal_delivered' and tgenabled='O'")).rows[0].n;}
  report.readyPlans=(await c.query("select product_id,plan_key,auto_wallet,count(u.id)::int ready from mirpanel_community.ready_stock_plans p left join mirpanel_community.ready_stock_units u using(product_id,plan_key,plan_signature) where p.product_id ilike '%capcut%' and u.delivery_id is null group by product_id,plan_key,auto_wallet")).rows;
  await c.query('rollback');
 }finally{c.release();}
 const login=await req('/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD})});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];csrf=(await(await req('/api/session',{headers:{Cookie:cookie}})).json()).csrfToken;
 const state=await req('/api/admin/state',{headers:{Cookie:cookie}});assert.equal(state.status,200);const data=await state.json();
 report.activeTermProducts=(data.data?.products||[]).filter(p=>p.active!==false).map(p=>({id:p.id,title:p.title,packages:p.plans?.length||0}));
 report.health=(await req('/api/payments/health')).status;assert.equal(report.health,200);
 if(!before){
  const admin=await req('/api/admin/community/renewals',{headers:{Cookie:cookie}});report.adminStatus=admin.status;assert.equal(admin.status,200);const details=await admin.json();assert.equal(details.pollSeconds,30);assert(!details.policies.some(p=>['pubg_mobile','free_fire','mirpanel_token','telegram_premium'].includes(p.productId)),'Consumable/supplier packages must not be subscription policies');assert(details.policies.every(p=>typeof p.plan==='string'&&p.plan.trim()));report.intervalSeconds=details.pollSeconds;report.policies=details.policies;
  for(const filter of ['renewed','delivery','unrenewed']){const r=await req('/api/admin/community/renewals?filter='+filter,{headers:{Cookie:cookie}});report[filter]={status:r.status};assert.equal(r.status,200);report[filter].total=(await r.json()).total;}
  report.anonymousRenewal=(await fetch('https://mirpanel.com/api/payments/shop/renewal',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://mirpanel.com'},body:'{}',signal:AbortSignal.timeout(60000)})).status;assert.equal(report.anonymousRenewal,401);
  for(const [url,file]of [['/community-assets/account-subscriptions.js','mirpanel-admin/community/public/account-subscriptions.js'],['/payment-admin.js','mirpanel-admin/public/payment-admin.js']]){const r=await req(url,{headers:{Cookie:cookie}});assert.equal(r.status,200);assert.equal((await r.text()).replace(/\r\n/g,'\n'),fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));}report.liveAssetsMatch=true;
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const width of [390,1440]){const context=await browser.newContext({viewport:{width,height:950}});const [name,value]=cookie.split('=');await context.addCookies([{name,value,url:base,httpOnly:true,secure:true,sameSite:'Strict'}]);const page=await context.newPage();await page.route('**/*',r=>r.request().method()==='GET'?r.continue():r.abort());await page.goto(base+'/admin.html#paymentOrders');await page.locator('[data-payment-order-tab="expiring"]').click();await page.locator('#scheduledRenewals h3').waitFor({timeout:60000});await page.locator('#scheduledRenewals [data-renewal-filter="waiting"]').waitFor();fs.mkdirSync('outputs/scheduled-renewals',{recursive:true});await page.locator('#scheduledRenewals').screenshot({path:'outputs/scheduled-renewals/live-admin-'+width+'.png'});await context.close();}
  report.liveAdminScreenshots=true;
 }
 console.log(JSON.stringify(report,null,2));fs.writeFileSync(out+'/'+report.stage+'-verification.json',JSON.stringify(report,null,2));
}finally{await browser?.close();if(cookie&&csrf)await req('/api/logout',{method:'POST',headers:{Cookie:cookie,Origin:base,'X-CSRF-Token':csrf}});await pool.end();}
