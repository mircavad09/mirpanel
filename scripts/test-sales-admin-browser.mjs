import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium,webkit}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
for(const [name,engine]of [['chrome',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.setContent('<button id="salesRefresh">Yenilə</button><div id="salesStatus"></div><div id="salesEditor"></div>');
  await page.addScriptTag({content:`const state={data:{products:[]},csrfToken:'synthetic'};let sent=[];let fixture={initializedAt:'2026-11-14T00:00:00Z',version:1,distributed:10000,realTotal:1,total:10001,products:[{productId:'free_fire',title:'Free Fire',historical:3,real:1,total:4},{productId:'capcut',title:'CapCut Pro',historical:9997,real:0,total:9997}]};async function api(url,options){if(options){const input=JSON.parse(options.body);sent.push(input);fixture.version++;for(const p of fixture.products){p.historical=input.items.find(i=>i.product_id===p.productId).count;p.total=p.historical+p.real;}fixture.distributed=fixture.products.reduce((s,p)=>s+p.historical,0);fixture.total=fixture.distributed+fixture.realTotal;}return structuredClone(fixture);}`});
  await page.addScriptTag({content:fs.readFileSync('mirpanel-admin/public/product-sales-admin.js','utf8')});
  const input=page.locator('input[data-product-id="free_fire"]');await input.waitFor();
  await input.fill('4');assert.equal(await page.locator('#salesSave').isEnabled(),true);
  assert.ok((await input.locator('..').textContent()).includes('Görünən: 5'));
  await page.locator('#salesSave').click();
  assert.equal(await page.evaluate(()=>sent[0].items.find(p=>p.product_id==='free_fire').count),4);
  assert.equal(await page.evaluate(()=>sent[0].items.find(p=>p.product_id==='capcut').count),9997);
  assert.equal(await page.evaluate(()=>fixture.distributed),10001);
  assert.ok((await page.locator('#salesEditor').textContent()).includes(await page.evaluate(()=>new Intl.NumberFormat('az-AZ').format(10001))));
  await input.fill('-1');assert.equal(await page.locator('#salesSave').isDisabled(),true);
  console.log(JSON.stringify({engine:name,width,previewFourPlusOne:5,independentBaselineSave:true,otherProductsUnchanged:true,invalidBlocked:true,liveWrites:0}));await page.close();
 }}finally{await browser.close();}
}
