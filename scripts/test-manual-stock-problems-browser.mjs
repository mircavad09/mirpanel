import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {manualStockFixture} from './manual-stock-fixture.mjs';

const f=await manualStockFixture(),{pool,origin,catalog}=f;
const sharp=createRequire(import.meta.url)('../receipt-worker/node_modules/sharp');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const base='/api/admin/workforce/manual-stock',worker='/api/employee/manual-stock';
const out='payment-test-artifacts/manual-stock-problems';fs.mkdirSync(out,{recursive:true});
catalog.products=['chatgpt','netflix'].map((id,i)=>({id,title:i?'Netflix':'ChatGPT',plans:[{id:'month',label:'1 aylıq',months:1}]}));
const creds={login:'worker-problems-test',password:crypto.randomBytes(20).toString('base64url')};
const ready='Salam! 👋\n*ChatGPT* hesabınız hazırdır.',internal='SİNTETİK 2FA: 135790',instruction='Kod soruşulanda operatora yazın.';
async function post(path,body){const r=await fetch(origin+base+path,{method:'POST',headers:{Cookie:'test_admin=owner','X-CSRF-Token':'synthetic-csrf','X-Idempotency-Key':crypto.randomUUID(),'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();}
const png=background=>sharp({create:{width:480,height:220,channels:3,background}}).png().toBuffer();
try{
 const ac=await browser.newContext({viewport:{width:390,height:950}});await ac.addCookies([{name:'test_admin',value:'owner',url:origin}]);const p=await ac.newPage();
 await p.goto(origin+'/admin/employee-stock');await p.getByLabel('Məhsul',{exact:true}).selectOption('chatgpt');await p.getByLabel('Paket',{exact:true}).selectOption({label:'1 aylıq'});
 await p.getByLabel('Hazır mesaj',{exact:true}).fill(ready);await p.getByLabel(/^2FA məlumatı/).fill(internal);await p.getByLabel(/^İşçi təlimatı/).fill(instruction);await p.screenshot({path:out+'/admin-stock.png',fullPage:true});
 await p.getByRole('button',{name:'Yadda saxla',exact:true}).click();await p.getByText('1 hazır mesaj stoka əlavə edildi.',{exact:true}).waitFor();
 await post('/ready-message',{productId:'netflix',planKey:'id:month',message:'Sintetik Netflix stok mesajı.'});
 const {account}=await post('/accounts',{...creds,name:'Sintetik işçi'});await post('/account-control',{id:account.id,action:'enable'});
 const ids=Object.fromEntries((await pool.query('select source_product_id,id from manual_stock_products')).rows.map(x=>[x.source_product_id,x.id]));
 for(const productId of Object.values(ids))await post('/permission',{employeeId:account.id,productId,allowed:true});
 await p.getByRole('button',{name:'Problemlər',exact:true}).click();await p.getByRole('button',{name:'Netflix',exact:true}).click();
 await p.getByLabel('Problem başlığı').fill('Netflix giriş ekranı');await p.getByLabel(/^Şəkil/).setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:await png('#9b193e')});await p.getByLabel('İşçiyə izah').fill('Əvvəlcə tətbiqi yenidən açmağı yoxlayın.');await p.getByLabel('Müştəriyə cavab',{exact:true}).fill('Salam, zəhmət olmasa tətbiqi yenidən açın.');
 await p.getByRole('button',{name:'Problemi saxla',exact:true}).click();await p.getByRole('heading',{name:'Netflix giriş ekranı'}).waitFor();
 await p.getByRole('button',{name:'Redaktə et',exact:true}).click();await p.getByLabel(/^Şəkil/).setInputFiles({name:'synthetic-new.png',mimeType:'image/png',buffer:await png('#183b60')});await p.getByRole('button',{name:'Dəyişiklikləri saxla',exact:true}).click();await p.getByText('Problem saxlanıldı.',{exact:true}).waitFor();
 await p.locator('.problem-image').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('.problem-image')?.naturalWidth>0);await p.screenshot({path:out+'/admin-problem.png',fullPage:true});
 const wc=await browser.newContext({viewport:{width:390,height:950},permissions:['clipboard-read','clipboard-write']}),w=await wc.newPage();
 await w.goto(origin+'/employee/stock/login');await w.getByLabel('Giriş adı').fill(creds.login);await w.getByLabel('Şifrə').fill(creds.password);await w.getByRole('button',{name:'Daxil ol'}).click();
 await w.locator('.products').getByRole('button',{name:/ChatGPT/}).click();await w.getByText('Stokda: 1 hesab',{exact:true}).waitFor();assert.equal(await w.getByText(internal,{exact:true}).count(),0);
 await w.getByRole('button',{name:/Stokdan al/}).click();await w.getByText('Qalan stok: 0 hesab',{exact:true}).waitFor();await w.getByText(internal,{exact:true}).waitFor();await w.getByText(instruction,{exact:true}).waitFor();
 assert.equal(await w.getByText('Yalnız işçi üçün',{exact:true}).count(),2);assert.equal(await w.locator('.internal-data button').count(),0);
 await w.getByRole('button',{name:/Mesajı kopyala/}).click();assert.equal((await w.evaluate(()=>navigator.clipboard.readText())).replaceAll('\r\n','\n'),ready);
 assert.equal(Number((await pool.query("select count(*) n from manual_stock_units where state='TAKEN'")).rows[0].n),1);await w.screenshot({path:out+'/worker-stock.png',fullPage:true});
 await w.getByRole('button',{name:'Problemlər',exact:true}).click();await w.getByRole('button',{name:'Netflix',exact:true}).click();
 await w.getByText('Əvvəlcə tətbiqi yenidən açmağı yoxlayın.',{exact:true}).waitFor();await w.locator('.problem-image').scrollIntoViewIfNeeded();await w.waitForFunction(()=>document.querySelector('.problem-image')?.naturalWidth>0);
 await w.getByRole('button',{name:'Cavabı kopyala',exact:true}).click();assert.equal(await w.evaluate(()=>navigator.clipboard.readText()),'Salam, zəhmət olmasa tətbiqi yenidən açın.');await w.screenshot({path:out+'/worker-problem.png',fullPage:true});
 const img=await w.locator('.problem-image').getAttribute('src');assert.equal((await fetch(origin+img)).status,401);
 await post('/permission',{employeeId:account.id,productId:ids.netflix,allowed:false});assert.equal((await wc.request.get(origin+worker+'/problems?product='+ids.netflix)).status(),403);assert.equal((await wc.request.get(origin+img)).status(),403);
 await w.getByRole('button',{name:'Netflix',exact:true}).waitFor({state:'detached',timeout:20000});
 p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Problemi sil',exact:true}).click();await p.getByText('Bu məhsul üçün problem qeydi yoxdur.',{exact:true}).waitFor();
 assert.equal(Number((await pool.query('select count(*) n from manual_stock_problems')).rows[0].n),0);
 assert.equal(JSON.stringify((await pool.query('select * from manual_stock_units')).rows).includes(internal),false);
 console.log(JSON.stringify({chatgptClaim:'1→0',clipboardOnlyCustomerMessage:true,netflixImageVisible:true,problemImageReplacementAndDelete:true,revokedImageAndListDenied:true,productionWrites:0}));
}finally{await browser.close();await f.close();}
