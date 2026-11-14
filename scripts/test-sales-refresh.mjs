import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';

const live=process.argv.includes('--live');
const {products}=extractAdminState(await fs.readFile('app.js','utf8'));
const type={'.html':'text/html','.page':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/mehsul'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await fs.readFile('mehsul.page'));}
 const name=url.pathname==='/'?'index.html':url.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+url.pathname.slice(18):url.pathname.slice(1)+(/^\/mehsul\/[a-z0-9-]+$/.test(url.pathname)?'.page':'');
 try{
  const bytes=await fs.readFile(name);
  res.setHeader('Content-Type',type[path.extname(name)]||'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=live?'https://mirpanel.com':'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of [390,1440])for(const path of ['/','/mehsul','/mehsul/capcut-pro']){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});let total=99,requests=0;
  await context.addInitScript(()=>sessionStorage.setItem('mirpanel.intro.seen','1'));
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/api/product-sales'){requests++;return route.fulfill({json:{initialized:true,productId:u.searchParams.get('productId'),productTotal:total,siteTotal:10000+total,completedTotal:total}});}
   if(u.pathname==='/api/payments/inventory')return route.fulfill({json:{products:products.map(p=>({productId:p.id,scope:'product',unlimited:true,canOrder:true,plans:p.plans.map((_,i)=>({planKey:String(i),canOrder:true,tracked:false}))}))}});
   if(u.pathname.startsWith('/api/'))return route.fulfill({json:{items:[],products:[],stories:[],banners:[]}});
   if(u.origin!==origin)return route.abort();return route.continue();
  });
  const page=await context.newPage();await page.goto(origin+path,{waitUntil:'domcontentloaded'});
  const line=page.locator(path==='/'?'#grid [data-home-sales-id=capcut]':path==='/mehsul'?'.catalog-grid [data-home-sales-id=capcut]':'.product-detail-sales');
  await line.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[data-home-sales-id=capcut],.product-detail-sales')].some(n=>n.textContent.includes('99')));
  total=102;
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-home-sales-id=capcut],.product-detail-sales')].some(n=>n.textContent.includes('102')),null,{timeout:16000});
  total=103;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-home-sales-id=capcut],.product-detail-sales')].some(n=>n.textContent.includes('103')),null,{timeout:5000});
  assert(requests>=3);console.log(JSON.stringify({width,path,refresh:'99 → 102 → 103',automatic:true,focus:true}));await context.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
