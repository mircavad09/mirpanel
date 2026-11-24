import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
import {extractAdminState,normalizeAdminPayload,patchAppSource} from '../mirpanel-admin/core.mjs';
import {savePackageCosts} from '../mirpanel-admin/package-costs.mjs';
import {catalogCostRows} from '../mirpanel-admin/payment-profit.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
// Fixed loopback-only disposable cluster; never accepts a production URL.
const pool=new pg.Pool({host:'127.0.0.1',port:55478,user:'package_cost_test',database:'postgres',max:8});
const source=fs.readFileSync('app.js','utf8'),data=extractAdminState(source);
const product=data.products.find(p=>p.id==='netflix');
data.products=[product];data.content={[product.id]:data.content[product.id]};
const first=product.plans[0],second=product.plans[1];assert(first&&second);
assert.notEqual(first.id,second.id);
const reordered=structuredClone(data);reordered.products[0].plans.reverse();reordered.products[0].plans.find(p=>p.id===first.id).label='Yeni ad';
assert.equal(extractAdminState(patchAppSource(source,reordered)).products[0].plans.find(p=>p.label==='Yeni ad').id,first.id);
assert.throws(()=>normalizeAdminPayload({...data,products:[{...product,plans:[first,first]}]}),/identifikator/);
let failSave=false;
const rows=async()=>catalogCostRows(data,(await pool.query('select product_id,plan_id,cost_amount,updated_at::text as updated_at from payment_plan_costs')).rows);
const item=(id,cost,expectedUpdatedAt=null)=>({productId:product.id,planId:id,cost,expectedUpdatedAt});
const save=items=>savePackageCosts(pool,items,data,'isolated-test-admin');
const out='outputs/package-cost';fs.mkdirSync(out,{recursive:true});
let server;
try{
 await pool.query('drop table if exists payment_plan_costs,payment_audit_log,package_cost_history_probe,payment_orders');
 await pool.query("create table package_cost_history_probe(order_id text,cost_snapshot numeric,profit_snapshot numeric);insert into package_cost_history_probe values('synthetic-old-order',1.25,4.50)");
 await pool.query('create table payment_plan_costs(product_id text,plan_id text,cost_amount numeric(12,2) not null,updated_at timestamptz not null default now(),updated_by text,primary key(product_id,plan_id)); create table payment_audit_log(actor_type text,actor_ref text,action text,entity_type text,entity_id text,metadata jsonb)');
 const migration=fs.readFileSync('supabase/migrations/202608090002_payment_costs_and_profit.sql','utf8');
 await pool.query(migration.match(/create or replace function public.save_payment_plan_costs[\s\S]*?\n\$\$;/)[0]);
 await pool.query("create table payment_orders(id uuid,product_id text,checkout_snapshot jsonb,cost_price_snapshot numeric,currency text,status text,payment_confirmed boolean)");
 await save([item(first.id,'0'),item(second.id,'1,25')]);
 let r=await rows();assert.equal(r.find(x=>x.planId===first.id).costAmount,'0.00');assert.equal(r.find(x=>x.planId===second.id).costAmount,'1.25');
 const baseline=r.find(x=>x.planId===second.id).updatedAt;
 const parallel=await Promise.allSettled([save([item(second.id,'2.10',baseline)]),save([item(second.id,'2.20',baseline)])]);
 assert.equal(parallel.filter(x=>x.status==='fulfilled').length,1);assert.equal(parallel.find(x=>x.status==='rejected').reason.status,409);
 for(const cost of ['-1','abc','1.234'])await assert.rejects(()=>save([item(first.id,cost)]),e=>e.status===400);
 await assert.rejects(()=>save([{productId:product.id,planId:first.id,cost:'1'}]),e=>e.status===409);
 const timestamp=(await rows()).find(x=>x.planId===first.id).updatedAt;await save([item(first.id,'',timestamp)]);assert.equal((await rows()).find(x=>x.planId===first.id).costAmount,null);
 await save([item(first.id,'0')]);
 assert.deepEqual((await pool.query('select * from package_cost_history_probe')).rows,[{order_id:'synthetic-old-order',cost_snapshot:'1.25',profit_snapshot:'4.50'}]);
 const guarded={products:[{id:'game',plans:[{id:'epinby_123',price:2,supplier:{provider:'epinby',productId:123,type:'VOUCHER',fields:[]}}]}]};
 await assert.rejects(()=>savePackageCosts(pool,[{productId:'game',planId:'epinby_123',cost:'1',expectedUpdatedAt:null}],guarded),e=>e.status===409);
 server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://local');const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  try{
   if(u.pathname==='/api/admin/state')return json(200,{data,sha:'a'.repeat(40),csrfToken:'test-token',loadedAt:new Date().toISOString()});
   if(u.pathname==='/api/admin/payment-costs'){
    if(req.method==='POST'){let raw='';for await(const b of req)raw+=b;if(failSave)return json(503,{error:'İzolyasiya edilmiş şəbəkə xətası'});await save(JSON.parse(raw).items);}
    return json(200,{rows:await rows(),categories:[]});
   }
   if(u.pathname.startsWith('/api/'))return json(200,{role:'admin',ok:true,items:[],rows:[],orders:[],permissions:{},methods:[]});
   const file=path.resolve('mirpanel-admin/public',u.pathname==='/'?'admin.html':u.pathname.slice(1));
   if(!file.startsWith(path.resolve('mirpanel-admin/public')+path.sep))return json(404,{});
   if(!fs.existsSync(file))return json(404,{});
   const content=fs.readFileSync(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(content);
  }catch(e){json(e.status||500,{error:e.message});}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const results=[];
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{for(const width of [390,1440]){
   const c=await browser.newContext({viewport:{width,height:1000}});await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const page=await c.newPage();
   await page.goto(origin);await page.locator('#plans .planRow').first().waitFor({state:'attached'});
   await page.evaluate(()=>{showView('products');document.querySelector('#plans details').open=true;for(let el=document.querySelector('#plans');el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;});
   await page.locator('[data-product-section="1"]').click();
   const input=page.locator('[data-package-cost] input').first(),saveButton=page.locator('[data-cost-save]').first();await input.waitFor();await page.waitForFunction(()=>!document.querySelector('[data-package-cost] input').disabled);
   await input.fill('3,25');await saveButton.click();await page.getByText('Maya saxlanıldı. 0 sifarişin boş mayası tamamlandı.',{exact:true}).waitFor();assert.equal((await rows()).find(x=>x.planId===first.id).costAmount,'3.25');
   assert.equal(await page.evaluate(()=>state.dirty),false,'Cost writes must not change the public product draft');
   await page.evaluate(()=>showView('paymentCosts'));await page.waitForFunction(()=>document.querySelector('[data-payment-cost-input]')?.value==='3.25');
   const costInput=page.locator('[data-payment-cost-input]').first();await costInput.fill('4,50');await page.locator('[data-save-payment-cost]').first().click();await page.waitForFunction(()=>document.querySelector('[data-payment-cost-input]')?.value==='4.50');
   await page.evaluate(()=>{showView('products');renderProductForm();document.querySelector('#plans details').open=true;for(let el=document.querySelector('#plans');el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;});await page.waitForFunction(()=>document.querySelector('[data-package-cost] input')?.value==='4.50');
   await page.locator('[data-package-cost] input').first().fill('7.00');
   const current=(await rows()).find(x=>x.planId===first.id);await save([item(first.id,'8.00',current.updatedAt)]);
   await page.locator('[data-cost-save]').first().click();await page.getByText(/Maya başqa görünüşdə dəyişdirilib/).waitFor();assert.equal(await page.locator('[data-package-cost] input').first().inputValue(),'7.00');assert.equal((await rows()).find(x=>x.planId===first.id).costAmount,'8.00');
   await page.locator('[data-cost-reload]').first().click();await page.waitForFunction(()=>document.querySelector('[data-package-cost] input').value==='8.00');
   failSave=true;await page.locator('[data-package-cost] input').first().fill('9.00');await page.locator('[data-cost-save]').first().click();await page.getByText('İzolyasiya edilmiş şəbəkə xətası',{exact:true}).waitFor();assert.equal(await page.locator('[data-package-cost] input').first().inputValue(),'9.00');failSave=false;
   await page.locator('[data-cost-save]').first().click();await page.getByText('Maya saxlanıldı. 0 sifarişin boş mayası tamamlandı.',{exact:true}).waitFor();
   for(const value of ['','0']){await page.locator('[data-package-cost] input').first().fill(value);await page.locator('[data-cost-save]').first().click();await page.getByText('Maya saxlanıldı. 0 sifarişin boş mayası tamamlandı.',{exact:true}).waitFor();assert.equal((await rows()).find(x=>x.planId===first.id).costAmount,value===''?null:'0.00');}
   await page.reload();await page.waitForFunction(()=>document.querySelector('[data-package-cost] input')?.value==='0.00');await page.evaluate(()=>{showView('products');document.querySelector('#plans details').open=true;for(let el=document.querySelector('#plans');el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;});
   await page.locator('[data-product-section="1"]').click();
   await page.locator('#plans .movePlan[data-direction="1"]').first().click();
   const moved=page.locator('#plans .planRow').nth(1);await moved.evaluate(e=>e.open=true);assert.equal(await moved.locator('[data-package-cost] input').inputValue(),'0.00');
   await page.locator('#plans').screenshot({path:`${out}/${engine.name()}-${width}.png`});
   await page.locator('#addPlanBtn').click();
   const newId=await page.evaluate(()=>selectedProduct().plans.at(-1).id);assert.match(newId,/^[a-f0-9-]{36}$/);
   assert.equal(await page.locator('#plans .planRow').last().locator('[data-cost-save]').isDisabled(),true);
   await page.locator('#plans .planRow').last().getByText('Yeni paketin mayasını yazmaq üçün əvvəl məhsulu yayımlayın.',{exact:true}).waitFor();
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
   results.push({engine:engine.name(),width,serverPersistence:true,zeroAndMissing:true,twoViews:true,conflictBlocked:true,failedSavePreserved:true,reorderStable:true,realProductWrites:0});await c.close();
  }}finally{await browser.close();}
 }
 fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await new Promise(r=>server?server.close(r):r());await pool.end();}

