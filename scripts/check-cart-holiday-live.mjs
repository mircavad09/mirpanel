// Public live render/quote checks only. All other non-read requests are blocked.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='outputs/cart-holiday';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[];
try{for(const width of [390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:width===390?620:1000}}),page=await ctx.newPage();let blocked=0;
 await page.route('**/*',r=>{const req=r.request(),u=new URL(req.url());if(!['GET','HEAD'].includes(req.method())&&!(u.origin==='https://mirpanel.com'&&u.pathname==='/api/payments/shop/quote'&&req.method()==='POST')){blocked++;return r.abort();}return r.continue();});
 await page.goto('https://mirpanel.com/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.MirpanelCart&&typeof DATA!=='undefined',{timeout:30000});
 await page.evaluate(async()=>{
  const p=DATA.products.find(p=>p.id==='prime');if(!p)throw Error('Prime product not found');
  const r=await fetch('/api/payments/shop/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{productId:p.id,planIndex:0,quantity:1}]})});
  if(!r.ok)throw Error('Live quote '+r.status);const q=await r.json(),x=q.items[0];
  localStorage.setItem('mirpanel.cart.v1',JSON.stringify([{productId:p.id,planIndex:0,quantity:1,termsVersion:x.termsVersion}]));
  window.dispatchEvent(new Event('mirpanel:cart'));MirpanelCart.open();
 });
 const dialog=page.locator('dialog.mir-cart-drawer[open]');await dialog.locator('.mir-cart-festive').waitFor();await dialog.locator('.mir-cart-suggestion').first().waitFor();
 await page.waitForFunction(()=>!document.querySelector('.mir-cart-notice').textContent.includes('yoxlanılır'));await page.waitForTimeout(400);
 const info=await dialog.evaluate(d=>({modal:d.matches(':modal'),background:getComputedStyle(d).backgroundColor,rect:d.getBoundingClientRect().toJSON(),prices:[...d.querySelectorAll('.mir-cart-suggestion .mir-cart-info>b')].map(x=>x.textContent),hat:!!d.querySelector('.mir-cart-hat'),lights:d.querySelectorAll('.mir-cart-lights i').length,total:d.querySelector('.mir-cart-sum').textContent,savings:d.querySelector('.mir-cart-savings').textContent}));
 assert(info.modal&&info.hat&&info.lights===36);assert.equal(info.background,'rgb(0, 0, 0)');assert(info.prices.every(x=>/^\d+,\d{2} ₼$/.test(x)));
 assert(info.rect.top>=20&&info.rect.bottom<=(width===390?620:1000)-20);
 for(const button of [dialog.getByRole('button',{name:'Səbəti bağla',exact:true}),dialog.locator('.mir-cart-next')])assert(await button.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);}));
 // Move focus off the initially autofocus close control for the pointer-view screenshot.
 await page.evaluate(()=>document.activeElement?.blur());await page.screenshot({path:out+'/live-'+width+'.png'});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await dialog.locator('.mir-cart-lights i').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 await dialog.getByRole('button',{name:'Artır: Amazon Prime Video',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.mir-cart-notice').textContent.includes('yoxlanılır'));assert.match(await dialog.locator('header').innerText(),/Səbət \(2\)/);
 await dialog.getByRole('button',{name:'Səbəti bağla',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(new URL(page.url()).pathname,'/');
 results.push({width,...info,blockedWrites:blocked,ordersCreated:0,paymentsCreated:0});await ctx.close();
}fs.writeFileSync(out+'/live-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}finally{await browser.close();}
