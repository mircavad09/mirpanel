import http from 'node:http';import fs from 'node:fs';import assert from 'node:assert/strict';
import{chromium}from'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const header=fs.readFileSync('customer-header.html','utf8'),root='payment-test-artifacts/plain-header';fs.mkdirSync(root,{recursive:true});
let cents=0,signed=true,checks=0,browser;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname;const json=v=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));};
 if(p==='/api/community/state')return json({profile:signed?{user_id:'synthetic',display_name:'Demo',email:'demo@example.test',avatar:0,balanceCents:cents}:null});
 if(p==='/api/community/notifications')return json({items:[],unread:0});
 // Even stale metadata must never mount retired header images.
 if(p==='/api/payments/backgrounds')return json({backgrounds:{'header-cart':'/api/payments/backgrounds/header-cart?v=old','header-balance':'/api/payments/backgrounds/header-balance?v=old'}});
 if(['/','/mehsul'].includes(p)){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/site-header.css"><style>body{margin:0;background:#0c0e11;color:#fff;font:15px system-ui}</style><body>'+header+'<main><h1>Sintetik sınaq</h1></main><script src="/site-header.js" defer></script></body></html>');}
 const f=p.slice(1);if(f.includes('..')||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(f));
});
try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const width of [320,360,390,430,768,1024,1280,1440,1920]){const ctx=await browser.newContext({viewport:{width,height:950}}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const[count,balance]of [[0,0],[2,12550],[100,1000000]]){cents=balance;signed=true;
   await p.goto(origin);await p.waitForFunction(()=>window.MirpanelCart&&window.mirpanelAccountProfile&&document.querySelector('#cartHeaderLink')&&(innerWidth<1000||document.querySelector('.desktop-balance')));
   await p.evaluate(count=>{const a=[];for(let i=0;i<count;i+=20)a.push({productId:'synthetic-'+i,planIndex:0,quantity:Math.min(20,count-i)});localStorage.setItem('mirpanel.cart.v1',JSON.stringify(a));window.dispatchEvent(new Event('mirpanel:cart'));},count);
   await p.waitForTimeout(100);eq(await p.locator('#cartHeaderLink small').textContent(),count>99?'99+':count?String(count):'');
   eq(await p.locator('.site-header .siteDecoration').count(),0);
   if(width<1000){eq(await p.locator('#cartHeaderLink').isVisible(),false);eq(await p.locator('[data-browser-nav=cart]').isVisible(),true);eq(await p.locator('.browser-bottom-nav [data-browser-nav]').count(),7);}
   else{eq(await p.locator('#cartHeaderLink>svg').isVisible(),true);eq(await p.locator('.desktop-balance>svg').isVisible(),true);eq(await p.locator('#cartHeaderLink small').isVisible(),count>0);eq(await p.locator('.desktop-balance span').textContent(),(balance/100).toFixed(2)+' ₼');
    const bounds=await p.locator('#cartHeaderLink,.desktop-balance').evaluateAll(a=>a.map(n=>{const r=n.getBoundingClientRect(),t=n.querySelector('span').getBoundingClientRect(),i=n.querySelector('svg').getBoundingClientRect(),s=getComputedStyle(n);return {h:r.height,left:r.left,right:r.right,textLeft:t.left,textRight:t.right,iconLeft:i.left,iconRight:i.right,bg:s.backgroundImage,shadow:s.boxShadow,animation:s.animationName};}));eq(bounds.every(r=>r.h===42&&r.iconLeft>=r.left&&r.iconRight<r.textLeft&&r.textRight<r.right&&r.right<=width&&r.bg==='none'&&r.shadow==='none'&&r.animation==='none'),true,'plain bounds '+width+' '+JSON.stringify(bounds));
   }
   eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
   if(count===2&&[390,1440].includes(width))await p.screenshot({path:root+'/header-'+width+'.png'});
   await p.goto(origin+'/mehsul');await p.waitForFunction(()=>window.MirpanelCart&&window.mirpanelAccountProfile);await p.waitForTimeout(100);eq(await p.locator('#cartHeaderLink small').textContent(),count>99?'99+':count?String(count):'');eq(await p.locator('.site-header img.siteDecoration').count(),0);eq(await p.locator(width<1000?'[data-browser-nav=cart]':'#cartHeaderLink').isVisible(),true);
  }
  eq(errors,[]);await ctx.close();
 }
 for(const width of [390,1440]){signed=false;const p=await browser.newPage({viewport:{width,height:950}});await p.goto(origin);await p.waitForFunction(()=>window.MirpanelCart);await p.waitForTimeout(150);eq(await p.locator('.desktop-balance').count(),0);eq(await p.locator('[data-browser-nav=profile]').count(),0);eq(await p.locator('#cartHeaderLink').isVisible(),width>=1000);await p.close();}
 console.log(JSON.stringify({checks,failures:0,widths:[320,360,390,430,768,1024,1280,1440,1920],cartCounts:[0,2,'99+'],balances:['0.00','125.50','10000.00'],staleHeaderImagesIgnored:true,productionWrites:0}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
