import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {manualStockFixture} from './manual-stock-fixture.mjs';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const f=await manualStockFixture(),{pool,origin,catalog}=f;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
catalog.products=[{id:'capcut',title:'CapCut Pro',plans:[{id:'month',label:'1 aylıq',months:1}]}];
const out='payment-test-artifacts/manual-stock-ready';fs.mkdirSync(out,{recursive:true});
const raw='  Salam! 👋\n\n*CapCut Pro*\n_Giriş hazırdır_\n~köhnə~\n`kod` {{literal}} <nümunə>\n  ';
const password=crypto.randomBytes(20).toString('base64url');
const base='/api/admin/workforce/manual-stock';
async function post(path,body){const r=await fetch(origin+base+path,{method:'POST',headers:{Cookie:'test_admin=owner','X-CSRF-Token':'synthetic-csrf','X-Idempotency-Key':crypto.randomUUID(),'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();}
async function stock(){return Number((await pool.query("select count(*) n from manual_stock_units where state='AVAILABLE'")).rows[0].n);}
try{
 const ac=await browser.newContext({viewport:{width:390,height:900}});await ac.addCookies([{name:'test_admin',value:'owner',url:origin}]);const p=await ac.newPage();
 await p.goto(origin+'/admin/employee-stock');await p.getByLabel('Məhsul',{exact:true}).selectOption('capcut');
 await p.getByLabel('Paket',{exact:true}).selectOption({label:'1 aylıq'});
 const msg=p.getByLabel('Hazır mesaj',{exact:true}),save=p.getByRole('button',{name:'Yadda saxla',exact:true});
 assert.equal(await p.locator('#stockApp input[type=password]').count(),0);
 await msg.first().fill(raw);const add=p.getByRole('button',{name:'+ Yeni stok əlavə et',exact:true});await add.click();await add.click();await add.click();await p.getByRole('button',{name:'Sahəni sil',exact:true}).last().click();assert.equal(await msg.count(),3);await msg.nth(1).fill(raw);await msg.nth(2).fill(raw);await p.screenshot({path:out+'/admin.png',fullPage:true});
 let lost=true,keys=[];await p.route('**/manual-stock/ready-message',async route=>{keys.push(route.request().headers()['x-idempotency-key']);if(lost){lost=false;await route.fetch();await route.abort();}else await route.continue();});
 await save.click();await p.waitForFunction(()=>!!document.querySelector('#status').textContent);assert.deepEqual(await msg.evaluateAll(ns=>ns.map(n=>n.value)),[raw,raw,raw]);assert.equal(await stock(),3);
 await save.click();await p.getByText('3 hazır mesaj stoka əlavə edildi.',{exact:true}).waitFor();assert.equal(await stock(),3);
 assert.equal(keys[0],keys[1]);assert.equal(new Set(keys).size,1);
 const product=(await pool.query('select id from manual_stock_products where source_product_id=$1',['capcut'])).rows[0];
 const {account}=await post('/accounts',{login:'ready-worker',name:'Sintetik işçi',password});await post('/account-control',{id:account.id,action:'enable'});
 const wc=await browser.newContext({viewport:{width:390,height:900},permissions:['clipboard-read','clipboard-write']}),w=await wc.newPage();
 await w.goto(origin+'/employee/stock/login');await w.getByLabel('Giriş adı').fill('ready-worker');await w.getByLabel('Şifrə').fill(password);await w.getByRole('button',{name:'Daxil ol'}).click();
 await w.getByText('İcazəli məhsul tapılmadı.',{exact:true}).waitFor();await post('/permission',{employeeId:account.id,productId:product.id,allowed:true});await w.locator('.products button').click();await w.getByText('Stokda: 3 hesab',{exact:true}).waitFor();await w.getByRole('button',{name:/Stokdan al/}).click();
 await w.getByText('Qalan stok: 2 hesab',{exact:true}).waitFor();assert.equal(await stock(),2);
 assert.equal(await w.locator('.message').textContent(),raw);
 for(let i=0;i<2;i++){await w.getByRole('button',{name:/Mesajı kopyala/}).click();assert.equal((await w.evaluate(()=>navigator.clipboard.readText())).replaceAll('\r\n','\n'),raw);assert.equal(await stock(),2);}
 await w.reload();await w.getByText('Qalan stok: 2 hesab',{exact:true}).waitFor();assert.equal(await stock(),2);await w.screenshot({path:out+'/worker.png',fullPage:true});
 assert.equal(Number((await pool.query('select count(*) n from manual_stock_allocations')).rows[0].n),1);
 for(const table of ['manual_stock_units','manual_stock_audit','manual_stock_requests'])assert.equal(JSON.stringify((await pool.query('select * from '+table)).rows).includes('Giriş hazırdır'),false);
 await w.getByRole('button',{name:'Çıxış',exact:true}).click();await w.waitForURL('**/employee/stock/login');
 const expiry=await fetch(origin+'/api/employee/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:'ready-worker',password})});assert.equal(expiry.status,200);
 await pool.query("update manual_stock_sessions set expires_at=now()-interval '1 second' where employee_id=$1 and expires_at>now()",[account.id]);
 await p.getByRole('button',{name:'Hesablar',exact:true}).click();await p.getByText('CapCut Pro',{exact:true}).click();await p.getByText(/^1 aylıq · Mövcud stok: 2$/).click();await p.getByText('Götürülüb',{exact:true}).waitFor();
 assert.equal(await p.getByText('Mövcuddur',{exact:true}).count(),2);assert.equal(await p.locator('.private-record').filter({hasText:'CapCut Pro'}).count(),0);
 await p.getByRole('button',{name:'Mesajı aç',exact:true}).first().click();assert.equal(await p.locator('.private-record:visible').textContent(),raw);await p.getByRole('button',{name:'Mesajı gizlət',exact:true}).click();await p.screenshot({path:out+'/accounts.png',fullPage:true});
 await p.getByRole('button',{name:'İşçi girişləri',exact:true}).click();await p.getByText('Giriş tarixçəsi',{exact:true}).click();await p.getByText(/^İşçi özü çıxdı · /).waitFor();assert.equal(await p.getByText(/^Uğurlu giriş · /).count(),2);assert.equal(await p.getByText(/^Sessiyanın müddəti bitdi · /).count(),1);await p.screenshot({path:out+'/access.png',fullPage:true});
 await p.getByRole('button',{name:'Götürmələr',exact:true}).click();await p.getByText('Sintetik işçi · CapCut Pro · 1 aylıq',{exact:true}).waitFor();assert.match(await p.locator('#stockApp .items p').first().textContent(),/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}$/);
 await p.getByLabel('İşçiyə görə süz').selectOption(account.id);await p.getByLabel('Məhsula görə süz').selectOption(product.id);await p.getByText('Sintetik işçi · CapCut Pro · 1 aylıq',{exact:true}).waitFor();await p.screenshot({path:out+'/claims.png',fullPage:true});
 const old=await wc.request.post(origin+'/api/employee/login',{data:{login:'ready-worker',password}});assert.equal(old.status(),200);await w.goto(origin+'/employee/stock');await w.getByText('Sintetik işçi',{exact:true}).waitFor();
 await p.getByRole('button',{name:'İşçi girişləri',exact:true}).click();p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'İşçini sil',exact:true}).click();await p.getByText('İşçi siyahıdan çıxarıldı.',{exact:true}).waitFor();
 assert.equal((await wc.request.get(origin+'/api/employee/session')).status(),401);
 assert.equal(Number((await pool.query('select count(*) n from manual_stock_permissions where employee_id=$1',[account.id])).rows[0].n),0);
 assert.equal(Number((await pool.query('select count(*) n from manual_stock_allocations where employee_id=$1',[account.id])).rows[0].n),1);assert.equal(await stock(),2);
 await p.getByText('Arxivlənmiş işçilərin tarixçəsi',{exact:true}).click();await p.getByText('Giriş tarixçəsi',{exact:true}).click();await p.getByText(/^İşçi özü çıxdı · /).waitFor();
 console.log(JSON.stringify({batch:3,afterClaim:2,exactClipboard:true,livePermissionGrant:true,archivedSessionRejected:true,historyPreserved:true,productionWrites:0}));
}finally{await browser.close();await f.close();}
