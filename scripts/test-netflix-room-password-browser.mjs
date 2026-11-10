import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const files={'/ready-stock-admin.js':'mirpanel-admin/public/ready-stock-admin.js','/ready-stock-admin.css':'mirpanel-admin/public/ready-stock-admin.css','/admin.css':'mirpanel-admin/public/admin.css'};
const server=http.createServer((req,res)=>{
 if(files[req.url]){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(files[req.url]));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/admin.css"><link rel="stylesheet" href="/ready-stock-admin.css"><main style="margin:12px"><div id="stock"></div></main><script type="module">import {mountReadyStock} from '/ready-stock-admin.js';mountReadyStock(document.querySelector('#stock'),async(url,options)=>{const r=await fetch(url,options);if(!r.ok)throw Error('Synthetic error');return r.json();});</script>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of [390,1360]){
  const page=await browser.newPage({viewport:{width,height:900}});let date='2027-01-15',writes=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const groupId='00000000-0000-4000-8000-000000000001';
  await page.route('**/api/admin/payment-ready-stock',async route=>{
   const input=route.request().method()==='POST'?route.request().postDataJSON():null;
   if(input?.netflixAccountPassword){const x=input.netflixAccountPassword;assert.equal(x.groupId,groupId);
    if(x.action==='preview')return route.fulfill({json:{email:'synthetic@example.test',activeRooms:2,activeCustomers:2,revision:'synthetic-revision'}});
    assert.equal(x.action,'rotate');assert.equal(x.password,'Example-new');assert.equal(x.expectedRevision,'synthetic-revision');writes++;return route.fulfill({json:{changed:true}});
   }
   return route.fulfill({json:{products:[{id:'netflix',title:'Netflix Şəxsi',message:'',plans:[{index:0,title:'1 ay',signature:'test',sales:10,ready:0}]}],netflixRooms:[1,2,3,4,5].map(n=>({id:groupId.slice(0,-1)+n,groupId,accountEmail:'synthetic@example.test',name:String(n),endsOn:date,deliveryId:'example-'+n,status:[2,3].includes(n)?'paid':'expired',active:[2,3].includes(n),statusLabel:[2,3].includes(n)?'Ödəniş edib, ödənilmiş müddəti davam edir':'Müddəti bitib, yenilənməyib'}))}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  const release=page.getByRole('button',{name:'Boşalt və satışa qaytar',exact:true});await release.first().waitFor();
  assert.equal(await release.count(),5);assert.equal(await release.nth(1).isDisabled(),true);assert.equal(await release.nth(2).isDisabled(),true);assert.equal(await release.first().isEnabled(),true);
  await page.getByRole('button',{name:'Şifrəni yenilə',exact:true}).click();
  const form=page.locator('.netflixPasswordForm');await form.getByText('synthetic@example.test · Təsirlənəcək aktiv otaqlar: 2 · Müştərilər: 2').waitFor();
  assert.equal(await form.locator('input').getAttribute('type'),'text');await form.locator('input').fill('Example-new');
  await form.getByRole('button',{name:'Şifrəni saxla',exact:true}).click();
  await page.getByText('Şifrə yeniləndi. Bildirişlər və Sheets yeniləməsi növbəyə əlavə edildi.').waitFor();
  assert.equal(writes,1);assert.deepEqual(errors,[]);
  assert.ok(await page.locator('.netflixAccountGroup').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
  console.log('PASS '+width+'px — account group, five states, protected active rooms, visible password, impact preview and rotation');await page.close();
 }
}finally{await browser.close();server.close();}
