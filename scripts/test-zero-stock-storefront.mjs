import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const data=extractAdminState(fs.readFileSync('app.js','utf8')),pages=generateProductPageFiles(data.products,data.siteSections,data.cms,data.content);
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local');let f=u.pathname.slice(1)||'index.html';if(f.startsWith('community-assets/'))f='mirpanel-admin/community/public/'+f.slice(17);try{const body=pages.get(f+'.page')??fs.readFileSync(f);res.setHeader('Content-Type',/\.m?js$/.test(f)?'text/javascript':f.endsWith('.css')?'text/css':/\.(png|webp)$/.test(f)?'image/'+path.extname(f).slice(1):'text/html');res.end(body);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{for(const [name,engine]of [['chrome',chromium],['webkit',webkit]]){
 const b=await engine.launch({headless:true,...(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,390,430,1440]){
  let n=null;const p=await b.newPage({viewport:{width,height:900}});p.setDefaultTimeout(10000);
  await p.route('**/*',r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET')return r.abort();if(u.pathname==='/api/payments/inventory')return r.fulfill({json:{products:data.products.map(x=>({productId:x.id,scope:'product',available:n,unlimited:n===null,plans:[],canOrder:n!==0}))}});if(u.pathname.startsWith('/api/'))return r.fulfill({json:{}});if(u.origin!==origin)return r.fulfill({status:200,body:''});return r.continue();});
  await p.goto(origin+'/mehsul/capcut-pro');await p.waitForFunction(()=>!!window.MirpanelInventory);
  for(const value of [null,0,3,0,null]){n=value;await p.evaluate(()=>MirpanelInventory.refresh());assert.equal(await p.locator('#pp-order-btn').isDisabled(),value===0);if(value===0)assert.equal(await p.locator('.product-page-status').innerText(),'Stokda yoxdur');}
  n=0;await p.goto(origin);await p.waitForFunction(()=>!!window.MirpanelInventory);await p.evaluate(()=>MirpanelInventory.refresh());
  const cards=p.locator('#grid [data-product-id="capcut"]');assert(await cards.count()>0);
  for(const card of await cards.all()){assert.equal(await card.locator('.homeCardAdd').isDisabled(),true);assert.equal(await card.locator('.homeCardOrder').getAttribute('aria-disabled'),'true');assert.equal(await card.locator('.cardStockLine').innerText(),'Stokda yoxdur');}
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log(JSON.stringify({name,width,sequence:true,detail:true,home:true,mutations:0}));await p.close();
 }}finally{await b.close();}
}}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
