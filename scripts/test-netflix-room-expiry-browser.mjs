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
  await page.route('**/api/admin/payment-ready-stock',async route=>{
   const input=route.request().method()==='POST'?route.request().postDataJSON():null;
   if(input?.netflixRoomEdit){const x=input.netflixRoomEdit;
    if(x.action==='open')return route.fulfill({json:{id:x.id,name:'1',pin:'0408',editable:false}});
    if(x.action==='password')return route.fulfill({json:{password:'Example-only-password'}});
    assert.equal(x.action,'expiry');assert.equal(x.endsOn,'2027-02-15');date=x.endsOn;writes++;return route.fulfill({json:{endsOn:date}});
   }
   return route.fulfill({json:{products:[{id:'netflix',title:'Netflix Şəxsi',message:'',plans:[{index:0,title:'1 ay',signature:'test',sales:10,ready:0}]}],netflixRooms:[{id:'00000000-0000-4000-8000-000000000001',name:'1',startsOn:'2026-11-10',endsOn:date,deliveryId:'example-delivery',status:'sold'}]}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'Redaktə et',exact:true}).click();
  const edit=page.locator('.netflixRoomEdit');await edit.locator('input[type=date]').fill('2027-02-15');
  await edit.getByRole('button',{name:'Bitmə tarixini saxla',exact:true}).click();
  await page.getByText('Hesabın bitmə tarixi yeniləndi. Müştərinin ödənilmiş müddəti qorundu.').waitFor();
  assert.equal(writes,1);assert.deepEqual(errors,[]);assert.ok(await page.locator('[data-room-summary]').innerText().then(t=>t.includes('2027-02-15')));
  console.log('PASS '+width+'px — sold-room account expiry editor, separate payment explanation and refresh');await page.close();
 }
}finally{await browser.close();server.close();}
