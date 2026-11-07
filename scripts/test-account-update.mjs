import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {chromium,webkit,firefox} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {onRequest as authShell} from '../functions/hesab.js';
import {onRequest as authAssets} from '../functions/community-assets/[[path]].js';
const before=process.argv.includes('--before'),engines=process.argv.filter(x=>['chrome','edge','webkit','firefox'].includes(x));
const plans=[{months:1,price:5.99}];
const quote={items:[{planName:'1 ay',terms:'Sintetik HBO Max şərtləri.',note:'Müştəri məlumatları qorunur.',termsVersion:'a'.repeat(64),fields:[]}]};
const contentTypes={js:'text/javascript',css:'text/css',html:'text/html',png:'image/png'};
function file(name){try{const data=before&&name.endsWith('cart-entry.css')?execFileSync('git',['show','5b7a2c1:'+name]):fs.readFileSync(name);return new Response(data,{headers:{'Content-Type':contentTypes[name.split('.').at(-1)]||'application/octet-stream'}});}catch{return new Response(null,{status:404});}}
const authResponse=await authShell({request:new Request('https://mirpanel.com/hesab?mode=signup'),env:{ASSETS:{fetch:async r=>{assert.equal(new URL(r.url).pathname,'/customer-header');return file('customer-header.html');}}}});
assert.equal(authResponse.status,200);const authHtml=await authResponse.text();
assert.match(authHtml,/id="authApp"/);
const asset=await authAssets({request:new Request('https://mirpanel.com/community-assets/auth-forms.js'),env:{ASSETS:{fetch:async r=>file(new URL(r.url).pathname.slice(1))}}});
assert.match(await asset.text(),/export function mountAuth/);
const html=(body)=>new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>'+body,{headers:{'Content-Type':'text/html'}});
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 let r;
 if(path==='/hesab')r=new Response(authHtml,{headers:{'Content-Type':'text/html'}});
 else if(path==='/first-click')r=html(`<button id="order">Sifariş et</button><script>window.MirpanelCart={version:5,commitDraft(){},open(){}};document.getElementById('order').onclick=async()=>{const m=await import('/community-assets/cart-entry.js');const plans=${JSON.stringify(plans)};await m.startCartEntry({id:'hbomax',title:'HBO Max',plans},plans[0]);}</script>`);
 else if(path==='/api/payments/shop/quote')r=Response.json(quote);
 else if(path.startsWith('/api/'))r=Response.json({error:'Synthetic API'}, {status:503});
 else if(path.startsWith('/community-assets/'))r=file('mirpanel-admin/community/public/'+path.slice(18));
 else r=file(path.slice(1));
 res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const engine of engines.length?engines:['chrome','edge','webkit','firefox']){
  let browser;
  try{browser=await (engine==='webkit'?webkit:engine==='firefox'?firefox:chromium).launch(engine==='firefox'?{timeout:20000,firefoxUserPrefs:{'gfx.webrender.software':false,'gfx.webrender.force-disabled':true}}:engine==='edge'?{channel:'msedge'}:engine==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});}
  catch(e){console.log(JSON.stringify({engine,notRun:e.message.split('\n')[0]}));continue;}
  try{
   const ctx=await browser.newContext({viewport:{width:390,height:700},hasTouch:true}),page=await ctx.newPage();let attempts=0;
   if(!before)await page.route('**/api/payments/shop/quote',async route=>{await new Promise(r=>setTimeout(r,650));return ++attempts===1?route.fulfill({status:503,contentType:'text/html',body:'Synthetic unavailable'}):route.continue();});
   if(before)await page.route('**/community-assets/cart-entry.js',route=>route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show','5b7a2c1:mirpanel-admin/community/public/cart-entry.js'])}));
   await page.goto(origin+'/first-click');await page.getByRole('button',{name:'Sifariş et',exact:true}).click();const d=page.locator('dialog[open]');
   if(!before){await d.getByRole('button',{name:'Yenidən cəhd et'}).waitFor();assert.equal(await d.getByRole('checkbox').count(),0);await d.getByRole('button',{name:'Yenidən cəhd et'}).click();}
   const confirm=d.getByRole('button',{name:'Təsdiqləyirəm',exact:true});await confirm.waitFor({state:'attached'});
   const layout=await confirm.evaluate(b=>{const rect=b.getBoundingClientRect(),dialog=b.closest('dialog').getBoundingClientRect();return{button:rect.height,inside:rect.top>=dialog.top&&rect.bottom<=dialog.bottom,body:b.closest('.cart-warning-body').offsetHeight};});
   console.log(JSON.stringify({engine,baseline:before,layout}));
   if(!before){assert.equal(layout.inside,true);assert.equal(await confirm.isDisabled(),true);await d.getByRole('checkbox').check();assert.equal(await confirm.isEnabled(),true);}
   await page.goto(origin+'/hesab?next=%2Fodenis');await page.locator('.auth-submit').waitFor();assert.equal(await page.getByText('Məlumatlar yüklənir…',{exact:true}).count(),0);
   await page.locator('.auth-mode-tabs').getByRole('link',{name:'Qeydiyyat',exact:true}).click();await page.locator('#account-phone').waitFor();await page.goBack();await page.locator('.auth-submit:not(.auth-submit-signup)').waitFor();
   console.log(JSON.stringify({engine,formTabs:true,historyBack:true,weakQuoteRetry:!before,physical:false,productionWrites:0}));await ctx.close();
  }finally{await browser.close();}
 }
}finally{await new Promise(r=>server.close(r));}
