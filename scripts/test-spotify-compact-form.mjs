import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const product={id:'spotify',title:'Spotify Premium (Öz hesabınız)',image:'/assets/spotify.png',plans:[{label:'1 Ay (Öz hesabınızda aktiv edilir)',price:5.49}]};
const fields=[{key:'email',type:'email',label:'Gmail ünvanınız',required:true,maxLength:160},{key:'password',type:'password',label:'Spotify şifrəniz',required:true,maxLength:160}];
let secret='',requests=0,failOnce=true,saved=0;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local');
 if(u.pathname==='/api/payments/shop/quote'){
  res.setHeader('Content-Type','application/json');
  return res.end(JSON.stringify({items:[{productId:'spotify',planIndex:0,unitCents:549,available:9,fields,terms:'Sınaq şərti',termsVersion:'fixture',planName:product.plans[0].label}]}));
 }
 if(u.pathname==='/api/payments/shop/draft'){
  requests++;let body='';for await(const chunk of req)body+=chunk;
  const data=JSON.parse(body);
  assert.ok(data.productId==='spotify'&&data.planIndex===0&&data.values.email==='reader@example.test'&&data.values.password===secret,'Selected package and fields must remain unchanged');
  res.setHeader('Content-Type','application/json');
  if(failOnce){failOnce=false;res.writeHead(503);return res.end(JSON.stringify({error:'Yenidən cəhd edin.'}));}
  saved++;return res.end(JSON.stringify({draftId:data.id,lineId:data.id,productId:data.productId,planIndex:0,termsVersion:'fixture',quantity:1}));
 }
 if(u.pathname==='/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end('<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#080a0c"><script type="module">import {startCartEntry} from "/community-assets/cart-entry.js";window.MirpanelCart={apiVersion:7,read(){return[]},checkout(){return[]},set(){},clear(){},commitDraft(){window.committed=true},open(){window.cartOpened=true}};const product='+JSON.stringify(product)+';await startCartEntry(product,product.plans[0]);</script></body></html>');
 }
 const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.slice(18):u.pathname.slice(1);
 try{const body=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':'image/png');res.end(body);}catch{res.writeHead(404).end();}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,out='outputs/spotify-compact';fs.mkdirSync(out,{recursive:true});
try{for(const [name,engine] of [['chrome',chromium],['webkit',webkit]]){
 const browser=await engine.launch(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of [320,390,430,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.route('https://www.spotify.com/password-reset/',r=>r.fulfill({contentType:'text/html',body:'Password reset fixture'}));
  const page=await context.newPage();page.setDefaultTimeout(10000);
  await page.goto(origin);
  const dialog=page.locator('dialog.cart-entry[open]');
  await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Təsdiqləyirəm'}).click();
  await dialog.getByRole('heading',{name:'Məlumat daxil edin',exact:true}).waitFor();
  const email=dialog.getByLabel('Spotify hesabınızın e-poçt ünvanı',{exact:true}),password=dialog.getByLabel('Spotify hesab şifrəsi',{exact:true});
  assert.equal(await email.getAttribute('placeholder'),'example@email.com');
  assert.equal(await password.getAttribute('placeholder'),'Şifrənizi daxil edin');
  assert.equal(await password.getAttribute('type'),'password');
  assert.equal(await dialog.locator('.spotify-entry-logo').count(),1);
  assert.equal(await dialog.locator('.spotify-entry-input>.spotify-field-icon').count(),2);
  if(name==='chrome'&&[390,1440].includes(width))await page.screenshot({path:out+'/preview-'+width+'.png'});
  secret=randomUUID();failOnce=true;const before=requests,creditsBefore=saved;
  await email.fill('reader@example.test');await password.fill(secret);
  await dialog.getByRole('button',{name:'Şifrəni göstər',exact:true}).click();
  assert.equal(await password.getAttribute('type'),'text');assert.ok(await password.inputValue()===secret);assert.equal(requests,before);
  await dialog.getByRole('button',{name:'Şifrəni gizlət',exact:true}).click();
  assert.equal(await password.getAttribute('type'),'password');assert.ok(await password.inputValue()===secret);
  const link=dialog.getByRole('link',{name:'password-reset',exact:true});
  assert.equal(await link.getAttribute('href'),'https://www.spotify.com/password-reset/');
  const popup=page.waitForEvent('popup');await link.click();const tab=await popup;await tab.waitForLoadState();await tab.close();
  assert.ok(await password.inputValue()===secret);assert.equal(await email.inputValue(),'reader@example.test');
  await dialog.getByRole('button',{name:'Davam et'}).click();
  await dialog.getByText('Yenidən cəhd edin.',{exact:true}).waitFor();
  assert.ok(await password.inputValue()===secret);
  await dialog.getByRole('button',{name:'Davam et'}).click();
  await page.waitForFunction(()=>window.committed&&window.cartOpened);
  assert.equal(saved,creditsBefore+1);assert.equal(requests,before+2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS '+name+' '+width+' icons, empty screenshot, toggle, reset tab, preserved values, failed/retry and correct draft');
  await context.close();
 }}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
