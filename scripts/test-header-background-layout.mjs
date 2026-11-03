import http from 'node:http';import fs from 'node:fs';import assert from 'node:assert/strict';import{createRequire}from'node:module';
import{chromium}from'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const sharp=createRequire(new URL('../receipt-worker/package.json',import.meta.url))('sharp'),root='payment-test-artifacts/header-backgrounds';fs.mkdirSync(root,{recursive:true});
const header=fs.readFileSync('customer-header.html','utf8');
const images={};for(const key of ['header-cart','header-balance']){const file=root+'/'+key+'.webp';images[key]=fs.existsSync(file)?fs.readFileSync(file):await sharp(Buffer.from('<svg width="800" height="320"><rect x="8" y="40" width="784" height="240" rx="115" fill="#191919" stroke="#e9ba37" stroke-width="3"/><circle cx="100" cy="160" r="45" fill="#d8ae35"/></svg>')).webp().toBuffer();}
let cents=0,signed=true,custom=true,version=1,checks=0,browser;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname;const json=v=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));};
 if(p==='/api/community/state')return json({profile:signed?{user_id:'synthetic',display_name:'Demo',email:'demo@example.test',avatar:0,balanceCents:cents}:null});
 if(p==='/api/community/notifications')return json({items:[],unread:0});
 if(p==='/api/payments/backgrounds')return json({backgrounds:custom?Object.fromEntries(Object.keys(images).map(k=>[k,'/api/payments/backgrounds/'+k+'?v='+version])):{}});
 if(p.startsWith('/api/payments/backgrounds/')){res.setHeader('Content-Type','image/webp');return res.end(images[p.split('/').at(-1)]);}
 if(['/','/mehsul'].includes(p)){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/site-header.css"><style>body{margin:0;background:#0c0e11;color:#fff;font:15px system-ui}main{padding:30px}</style><body>'+header+'<main><h1>'+ (p==='/'?'Ana səhifə':'Məhsullar')+'</h1><p>Sintetik görünüş sınağı</p></main><script src="/site-header.js" defer></script></body></html>');}
 const f=p.slice(1);if(f.includes('..')||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(f));
});
try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const width of [320,360,390,430,768,1024,1440,1920]){
  const ctx=await browser.newContext({viewport:{width,height:950}}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const [count,balance]of [[0,0],[2,12550],[100,1000000]]){cents=balance;custom=true;signed=true;
   await p.goto(origin);await p.waitForFunction(()=>window.MirpanelCart&&window.mirpanelAccountProfile&&document.querySelector('#cartHeaderLink')&&(innerWidth<1000||document.querySelector('.desktop-balance')));
   await p.evaluate(count=>{const a=[];for(let i=0;i<count;i+=20)a.push({productId:'synthetic-'+i,planIndex:0,quantity:Math.min(20,count-i)});localStorage.setItem('mirpanel.cart.v1',JSON.stringify(a));window.dispatchEvent(new Event('mirpanel:cart'));},count);
   await p.waitForTimeout(80);eq(await p.locator('#cartHeaderLink small').textContent(),count>99?'99+':count?String(count):'');
   if(width<1000){eq(await p.locator('#cartHeaderLink').isVisible(),false);eq(await p.locator('.site-header .siteDecoration').count(),0);eq(await p.locator('.browser-bottom-nav [data-browser-nav]').count(),7);eq(await p.locator('[data-browser-nav=cart]').isVisible(),true);eq(await p.locator('[data-browser-nav=cart] [data-cart-count]').count(),count?1:0);}
   else{await p.waitForFunction(()=>document.querySelectorAll('.site-header .hasSiteDecoration').length===2);await p.locator('.site-header .siteDecoration').evaluateAll(a=>Promise.all(a.map(i=>i.decode())));await p.waitForTimeout(30);
    if(images['header-cart'].equals(images['header-balance']))await p.waitForFunction(()=>document.querySelector('.headerWalletFallback'));
    eq(await p.locator('#cartHeaderLink>svg').isVisible(),false);eq(await p.locator('.desktop-balance>svg').isVisible(),images['header-cart'].equals(images['header-balance']));
    eq(await p.locator('#cartHeaderLink small').isVisible(),count>0);
    eq(await p.locator('#cartHeaderLink,.desktop-balance').evaluateAll(a=>Math.abs(a[0].getBoundingClientRect().height-a[1].getBoundingClientRect().height)<1),true);
    eq(await p.locator('.desktop-balance span').textContent(),(balance/100).toFixed(2)+' ₼');
    eq(await p.locator('.site-header .hasSiteDecoration').evaluateAll(a=>a.every(n=>{const r=n.getBoundingClientRect(),t=n.querySelector('span').getBoundingClientRect(),img=n.querySelector('img'),s=getComputedStyle(n);return s.borderTopWidth==='0px'&&t.left>=r.left+45&&t.right<r.right&&r.right<=innerWidth&&img.getBoundingClientRect().width>=r.width;})),true,'art/text bounds '+width);
   }
   eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
   if(count===2&&[390,1440].includes(width))await p.screenshot({path:root+'/header-'+width+'.png'});
   await p.goto(origin+'/mehsul');await p.waitForFunction(()=>window.MirpanelCart&&window.mirpanelAccountProfile);await p.waitForTimeout(70);eq(await p.locator('#cartHeaderLink small').textContent(),count>99?'99+':count?String(count):'');
   if(width<1000){eq(await p.locator('[data-browser-nav=cart]').isVisible(),true);eq(await p.locator('.browser-bottom-nav [data-browser-nav]').count(),7);}else await p.waitForFunction(()=>document.querySelectorAll('.site-header .hasSiteDecoration').length===2);
  }
  custom=false;await p.evaluate(()=>window.dispatchEvent(new Event('mirpanel:decorations')));await p.waitForFunction(()=>!document.querySelector('.site-header .hasSiteDecoration'));if(width>=1000){eq(await p.locator('#cartHeaderLink>svg').isVisible(),true);eq(await p.locator('.desktop-balance>svg').isVisible(),true);}
  if(width===1440){const original=images['header-balance'];images['header-balance']=await sharp(original).modulate({brightness:0.8}).webp().toBuffer();version++;custom=true;await p.evaluate(()=>window.dispatchEvent(new Event('mirpanel:decorations')));await p.waitForFunction(()=>{const n=document.querySelector('.desktop-balance');return n?.querySelector('img')?.complete&&!n.classList.contains('headerWalletFallback');});eq(await p.locator('.desktop-balance>svg').isVisible(),false);images['header-balance']=original;version++;await p.evaluate(()=>window.dispatchEvent(new Event('mirpanel:decorations')));await p.waitForFunction(()=>document.querySelector('.headerWalletFallback'));eq(await p.locator('.desktop-balance>svg').isVisible(),true);}
  // Desktop-to-mobile resizing must remove images and preserve the bottom cart.
  if(width===1440){custom=true;await p.evaluate(()=>window.dispatchEvent(new Event('mirpanel:decorations')));await p.waitForFunction(()=>document.querySelectorAll('.hasSiteDecoration').length===2);await p.setViewportSize({width:390,height:950});await p.waitForFunction(()=>document.querySelectorAll('.site-header .siteDecoration').length===0);eq(await p.locator('#cartHeaderLink').isVisible(),false);eq(await p.locator('[data-browser-nav=cart]').isVisible(),true);}
  eq(errors,[]);await ctx.close();
 }
 for(const width of [390,1440]){signed=false;custom=true;const p=await browser.newPage({viewport:{width,height:950}});await p.goto(origin);await p.waitForFunction(()=>window.MirpanelCart);await p.waitForTimeout(150);eq(await p.locator('.desktop-balance').count(),0);eq(await p.locator('[data-browser-nav=profile]').count(),0);eq(await p.locator('.browser-bottom-nav [data-browser-nav]').count(),6);eq(await p.locator('#cartHeaderLink').isVisible(),width>=1000);await p.close();}
 console.log(JSON.stringify({checks,failures:0,widths:[320,360,390,430,768,1024,1440,1920],cartCounts:[0,2,'99+'],balanceAZN:['0.00','125.50','10000.00'],navigation:true,standardIconRestored:true,productionWrites:0}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
