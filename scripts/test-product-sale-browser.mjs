import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import {pathToFileURL} from 'node:url';import {extractAdminState} from '../mirpanel-admin/core.mjs';import {generateProductListingPageFiles,generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';import {inventoryAvailability as resolve} from '../inventory-availability.mjs';
const state=extractAdminState(fs.readFileSync('app.js','utf8')),active=state.products.filter(p=>p.active!==false),root=process.cwd(),pages=new Map([...generateProductListingPageFiles(state.products,state.siteSections,state.cms),...generateProductPageFiles(state.products,state.siteSections,state.cms,state.content)].map(([f,h])=>['/'+f.replace(/\.page$/,''),h]));
const ledger=new Map([['chatgpt',{scope:'product',available:0}],['capcut',{scope:'plan',plans:active.find(p=>p.id==='capcut').plans.map((_,i)=>({planKey:String(i),tracked:true,available:i?2:0}))}]]),snapshot=()=>state.products.filter(p=>p.active!==false).map(p=>resolve(p,ledger.get(p.id)));
const server=http.createServer((req,res)=>{let name=new URL(req.url,'http://fixture').pathname;if(name==='/')name='/index.html';if(name==='/favicon.ico'){res.writeHead(204);return res.end();}if(pages.has(name)){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(pages.get(name));}const file=path.resolve(root,'.'+name);if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.setHeader('Content-Type',/\.m?js$/.test(file)?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.png')?'image/png':'application/octet-stream');return res.end(fs.readFileSync(file));}res.writeHead(404);res.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,{chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs'))),browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH}),ctx=await browser.newContext(),p=await ctx.newPage(),errors=[];let checks=0,mutations=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
await ctx.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(u.pathname==='/cdn-cgi/rum')return r.fulfill({status:204});if(!['GET','HEAD'].includes(q.method())||u.hostname==='wa.me'){mutations++;return r.abort();}if(u.pathname==='/api/payments/inventory')return r.fulfill({json:{products:snapshot()}});if(u.pathname==='/api/payments/methods'){return r.fulfill({json:{methods:[],anyAvailable:false}});}if(u.pathname.startsWith('/api/'))return r.fulfill({json:[]});if(u.origin!==base&&!u.hostname.endsWith('.supabase.co'))return r.fulfill({status:200,body:''});return r.continue();});
p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.dismiss());const ready=async()=>{await p.waitForFunction(()=>window.MirpanelInventory&&(!document.getElementById('newSplashScreen')||getComputedStyle(document.getElementById('newSplashScreen')).display==='none'));await p.evaluate(()=>MirpanelInventory.refresh());};
try{
 // The open detail and each storefront entry react without a page refresh.
 const target={scope:'product',available:5};ledger.set('netflix_umumi',target);
 const pausedCard='[data-product-id="netflix_umumi"]';
 for(const width of [390,1440]){
  await p.setViewportSize({width,height:900});
  for(const route of ['/', '/mehsul','/mehsul/netflix-umumi']){
   target.salePaused=false;await p.goto(base+route);
   if(route==='/'){await ready();await p.evaluate(()=>renderGrid());}
   const detail=route.startsWith('/mehsul/'),button=detail?'#pp-order-btn':pausedCard+' .homeCardAdd';
   await p.waitForFunction(selector=>document.querySelector(selector)?.disabled===false,button);
   target.salePaused=true;
   await p.waitForFunction(selector=>document.querySelector(selector)?.disabled===true,button);
   eq(await p.locator(detail?'.product-page-status':pausedCard+' .cardStockLine').innerText(),'Stokda yoxdur');
   if(detail&&await p.locator('#cartAddProduct').count())eq(await p.locator('#cartAddProduct').isDisabled(),true);
   target.salePaused=false;
   await p.waitForFunction(selector=>document.querySelector(selector)?.disabled===false,button);
  }
 }
 eq(mutations,0);eq(errors,[]);console.log(JSON.stringify({ok:true,checks,widths:[390,1440],warmRoutes:['/','/mehsul','/mehsul/netflix-umumi'],bothDirections:true,productionWrites:0}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
