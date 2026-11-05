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
 await msg.fill(raw);await p.screenshot({path:out+'/admin.png',fullPage:true});
 let lost=true,keys=[];await p.route('**/manual-stock/ready-message',async route=>{keys.push(route.request().headers()['x-idempotency-key']);if(lost){lost=false;await route.fetch();await route.abort();}else await route.continue();});
 await save.click();await p.waitForFunction(()=>!!document.querySelector('#status').textContent);assert.equal(await msg.inputValue(),raw);assert.equal(await stock(),1);
 await save.click();await p.getByText('1 hazır mesaj stoka əlavə edildi.',{exact:true}).waitFor();assert.equal(await stock(),1);
 for(let n=2;n<=3;n++){await msg.fill(raw);await save.click();await p.getByText('1 hazır mesaj stoka əlavə edildi.',{exact:true}).waitFor();assert.equal(await stock(),n);}
 assert.equal(keys[0],keys[1]);assert.equal(new Set(keys).size,3);
 const product=(await pool.query('select id from manual_stock_products where source_product_id=$1',['capcut'])).rows[0];
 const {account}=await post('/accounts',{login:'ready-worker',name:'Sintetik işçi',password});await post('/account-control',{id:account.id,action:'enable'});await post('/permission',{employeeId:account.id,productId:product.id,allowed:true});
 const wc=await browser.newContext({viewport:{width:390,height:900},permissions:['clipboard-read','clipboard-write']}),w=await wc.newPage();
 await w.goto(origin+'/employee/stock/login');await w.getByLabel('Giriş adı').fill('ready-worker');await w.getByLabel('Şifrə').fill(password);await w.getByRole('button',{name:'Daxil ol'}).click();
 await w.locator('.products button').click();await w.getByText('Stokda: 3 hesab',{exact:true}).waitFor();await w.getByRole('button',{name:/Stokdan al/}).click();
 await w.getByText('Qalan stok: 2 hesab',{exact:true}).waitFor();assert.equal(await stock(),2);
 assert.equal(await w.locator('.message').textContent(),raw);
 for(let i=0;i<2;i++){await w.getByRole('button',{name:/Mesajı kopyala/}).click();assert.equal((await w.evaluate(()=>navigator.clipboard.readText())).replaceAll('\r\n','\n'),raw);assert.equal(await stock(),2);}
 await w.reload();await w.getByText('Qalan stok: 2 hesab',{exact:true}).waitFor();assert.equal(await stock(),2);await w.screenshot({path:out+'/worker.png',fullPage:true});
 assert.equal(Number((await pool.query('select count(*) n from manual_stock_allocations')).rows[0].n),1);
 for(const table of ['manual_stock_units','manual_stock_audit','manual_stock_requests'])assert.equal(JSON.stringify((await pool.query('select * from '+table)).rows).includes('Giriş hazırdır'),false);
 console.log(JSON.stringify({threeIdenticalSaves:3,afterClaim:2,exactClipboard:true,lostResponseDeduplicated:true,productionWrites:0}));
}finally{await browser.close();await f.close();}
