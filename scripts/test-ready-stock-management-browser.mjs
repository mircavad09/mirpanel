import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {signature} from '../mirpanel-admin/employee-security.mjs';
import {saveReadyStock,readyStockView} from '../mirpanel-admin/community/ready-stock.mjs';
import {ensureReadyStockManagement} from '../mirpanel-admin/community/ready-stock-management.mjs';
import {saveProductMessage} from '../mirpanel-admin/community/ready-stock-product-messages.mjs';
import {inventoryAvailability} from '../inventory-availability.mjs';
import {bakuDate,shiftCalendarDays} from '../mirpanel-admin/payment-order-lifecycle.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const live=process.argv.includes('--live'),f=await shopFixture(),{pool,db,catalog,id,rpc}=f;
const secret=crypto.randomBytes(32),security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:secret.toString('base64')});
const out='outputs/ready-stock-management';fs.mkdirSync(out,{recursive:true});
let server;
try{
 for(const file of ['ready-stock-migration.sql','ready-stock-product-messages-migration.sql'])await db.exec(db.read('mirpanel-admin/community/'+file));
 await ensureReadyStockManagement(pool);
 catalog.products[0].title='CapCut Pro';catalog.products[1].title='Spotify Premium';
 for(const p of catalog.products){await saveProductMessage(pool,security,catalog,{productId:p.id,message:'Sintetik ümumi qayda'});await rpc('inventory_set_nullable_quantity',[p.id,50,'synthetic-admin',id(),(await rpc('inventory_snapshot')).find(x=>x.productId===p.id)?.version||0,null]);}
 const assets={};for(const name of ['ready-stock-admin.js','ready-stock-admin.css']){
  const local=fs.readFileSync('mirpanel-admin/public/'+name,'utf8');
  if(live){const r=await fetch('https://mirpanel.onrender.com/'+name+'?v=account-management-1');assert.equal(r.status,200);const body=await r.text();assert.equal(body.replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));assets[name]=body;}else assets[name]=local;
 }
 server=http.createServer(async(req,res)=>{
  try{
   const p=new URL(req.url,'http://local').pathname;
   if(p==='/api/admin/payment-ready-stock'){
    let result;if(req.method==='GET'){const inv=await rpc('inventory_snapshot');result=await readyStockView(pool,catalog,catalog.products.map(p=>inventoryAvailability(p,inv.find(x=>x.productId===p.id))),security);}
    else{let data='';for await(const chunk of req)data+=chunk;result=await saveReadyStock(pool,security,secret,catalog,'synthetic-admin',JSON.parse(data));}
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
   }
   const asset=assets[p.slice(1)];if(asset){res.writeHead(200,{'Content-Type':p.endsWith('css')?'text/css':'text/javascript'});res.end(asset);return;}
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ready-stock-admin.css"><style>body{background:#0b0d0f;color:white;font:14px system-ui;margin:8px}button,input,select,textarea{font:inherit}.btn{border:1px solid #4c5259;border-radius:7px;padding:7px;background:#252a31;color:white}input,select,textarea{padding:8px;background:#0b0e10;border:1px solid #555;color:white;border-radius:7px}button{cursor:pointer}label{display:grid;gap:5px}</style><main id="host"></main><script type="module">import {mountReadyStock} from "/ready-stock-admin.js";const api=async(path,opts)=>{const r=await fetch(path,opts),d=await r.json();if(!r.ok)throw Object.assign(Error(d.error),{status:r.status});return d;};mountReadyStock(document.querySelector("#host"),api);</script>');
  }catch(e){res.writeHead(e.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.status?e.message:'Synthetic test failed'}));}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 for(const [engine,width] of [[chromium,390],[chromium,1440],[webkit,390],[webkit,1440]]){
  // Separate SKU data for each browser run; all data lives in a disposable database.
  await pool.query('delete from ready_stock_account_revisions');await pool.query('delete from ready_stock_management');await pool.query('delete from ready_stock_units');
  for(const p of catalog.products.slice(0,2))await saveReadyStock(pool,security,secret,catalog,'synthetic-admin',{productId:p.id,index:0,planSignature:signature(p.plans[0]),requestId:id(),autoWallet:false,accounts:[1,2,3].map(n=>({email:p.id+n+'@example.test',password:'Synthetic-'+n}))});
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);const cards=page.locator('.readySavedAccount');await cards.nth(2).waitFor();
   await cards.first().getByRole('button',{name:'Redaktə et',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Hesabı redaktə et'});await dialog.waitFor();
   assert.equal(await dialog.locator('[name=password]').getAttribute('type'),'text');await dialog.locator('[name=email]').fill('edited@example.test');await dialog.locator('[name=password]').fill('Synthetic-edited');await dialog.locator('[name=message]').fill('Əlavə sintetik məlumat');
   await dialog.getByRole('button',{name:'Dəyişikliyi saxla'}).click();await page.getByText('Hesab yeniləndi.',{exact:true}).waitFor();await page.reload();await page.getByText('edited@example.test',{exact:true}).waitFor();
   await cards.filter({hasText:'edited@example.test'}).getByRole('button',{name:'Redaktə et',exact:true}).click();assert.equal(await dialog.locator('[name=password]').inputValue(),'Synthetic-edited');await dialog.getByRole('button',{name:'Bağla',exact:true}).click();
   page.once('dialog',d=>d.accept());await cards.filter({hasNotText:'edited@example.test'}).first().getByRole('button',{name:'Sil',exact:true}).click();await page.getByText('Hesab satışa hazır stokdan silindi.',{exact:true}).waitFor();assert.equal(await cards.count(),2);assert.equal(await page.locator('[data-ready]').innerText(),'2');
   await cards.filter({hasText:'edited@example.test'}).getByRole('button',{name:'Müştəriyə bağla',exact:true}).click();const bind=page.getByRole('dialog',{name:'Müştəriyə bağla'});await bind.locator('[name=customer]').fill('Reader A');await bind.locator('[data-results] button').first().click();await bind.locator('[name=date]').fill(shiftCalendarDays(bakuDate(),7));await bind.locator('[name=verified]').check();await bind.getByRole('button',{name:'Müştəriyə bağla',exact:true}).click();await page.getByText('Hesab müştəriyə bağlandı. Əlavə balans tutulmadı.',{exact:true}).waitFor();
   const sold=page.locator('[data-saved-accounts] section').nth(1);await sold.getByText(/Reader A/).waitFor();assert.equal(await sold.getByRole('button',{name:'Sil',exact:true}).isDisabled(),true);assert.equal(await page.locator('[data-ready]').innerText(),'1');
   await page.locator('[name=product]').selectOption('finite');await cards.nth(2).waitFor();assert.equal(await cards.count(),3);assert.equal(await page.getByText('edited@example.test',{exact:true}).count(),0);
   await page.locator('[name=product]').selectOption('ordinary');await sold.getByText(/Reader A/).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
   await page.locator('[data-saved-accounts]').screenshot({path:out+'/'+(live?'live-':'')+engine.name()+'-'+width+'.png'});
   console.log('PASS',live?'live assets':'local',engine.name(),width,'edit persisted, plain password, delete count, bind, customer metadata, product isolation');await context.close();
  }finally{await browser.close();}
 }
}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await f.close();}
