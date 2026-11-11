import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const draftId='f35c6be1-7f3e-4a51-8af1-5d31bda72453';
const item={productId:'test',planIndex:0,quantity:2,draftId,lineId:draftId};
if(process.argv.includes('--live')){
 const response=await fetch('https://mirpanel.com/sebet');
 assert.ok(response.ok);
 const html=await response.text();
 assert.ok(html.includes('/community-assets/shop-ui.js?v=cart-ready-now-1'),'direct cart uses current shop UI');
 assert.ok(html.includes('/site-header.js?v=cart-ready-now-1'),'direct cart uses current header');
}
const scripts=new Map();
for(const name of ['cart-store.js','cart-ready.js','shop-ui.js']){
 const file=name==='shop-ui.js'?'mirpanel-admin/community/public/'+name:name;
 const local=await fs.readFile(file,'utf8');
 if(process.argv.includes('--live')){
  const response=await fetch('https://mirpanel.com/'+(name==='shop-ui.js'?'community-assets/':'')+name+'?v=cart-ready-now-1');
  assert.ok(response.ok);
  const text=await response.text();
  assert.ok(text.replaceAll('\r\n','\n')===local.replaceAll('\r\n','\n'),name+' matches deployed source');
  scripts.set(name,text);
 }else scripts.set(name,local);
}
for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:850}});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await context.addInitScript(item=>{
    if(localStorage.getItem('mirpanel.cart.v1')===null)localStorage.setItem('mirpanel.cart.v1',JSON.stringify([item]));
   },item);
   let available=4,termsMissing=false,release;
   let pending=new Promise(resolve=>{release=resolve;});
   await context.route('**/*',async route=>{
    const {pathname}=new URL(route.request().url()),name=pathname.split('/').at(-1);
    if(pathname.endsWith('/quote')){
     await pending;
     return route.fulfill({json:{items:[{...item,title:'Sınaq məhsulu',planName:'1 ay',unitCents:500,standardCents:500,available,termsMissing,detailsMissing:false}],totalCents:1000,balanceCents:1000}});
    }
    if(pathname.endsWith('/drafts'))return route.fulfill({json:{items:[{...item,quantity:1,termsVersion:'a'.repeat(64)}]}});
    if(scripts.has(name))return route.fulfill({contentType:'text/javascript',body:scripts.get(name)});
    if(name==='wallet-topup.js')return route.fulfill({contentType:'text/javascript',body:'export const createWalletTopup=()=>{},topupReviewTime="";'});
    if(name==='topup-amount.js')return route.fulfill({contentType:'text/javascript',body:'export const parseTopupCents=()=>0,topupAmountText=()=>"";'});
    if(name==='checkout-sounds.js')return route.fulfill({contentType:'text/javascript',body:'export const playCheckoutSound=()=>{};'});
    if(pathname.startsWith('/api/'))return route.fulfill({json:{}});
    return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><a href="/sebet" data-browser-nav="cart">Səbət</a><script>const DATA={products:[{id:"test",title:"Sınaq məhsulu",plans:[{price:5}]}]};</script><script src="/cart-store.js"></script>'+(pathname==='/sebet'?'<main id="shopApp"></main><script type="module" src="/community-assets/shop-ui.js"></script>':'')});
   });
   const start='https://cart.test';
   const dialog=page.locator('dialog[open]'),open=()=>page.getByRole('link',{name:'Səbət',exact:true}).click();
   const next=dialog.getByRole('button',{name:'Ödənişə keç'});
   const immediate=async()=>{
    await next.waitFor();
    assert.equal(await next.isEnabled(),true);
    assert.doesNotMatch(await dialog.innerText(),/stok yoxlanılır|şərtlərini yenidən/i);
   };
   await page.goto(start);
   await open();await immediate();
   const other=await context.newPage();
   await other.goto(start+'/other');await page.bringToFront();await immediate();await other.close();
   await page.reload();await open();await immediate();
   await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{id:'same-user'}}));window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:null}));window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{id:'same-user'}}));});
   await immediate();
   available=1;release();
   await dialog.getByText('Stokda 1 ədəd var.',{exact:true}).waitFor();
   assert.equal(await next.isDisabled(),true);
   pending=new Promise(resolve=>{release=resolve;});
   await page.reload();await open();
   await dialog.getByText('Stokda 1 ədəd var.',{exact:true}).waitFor();
   assert.equal(await next.isDisabled(),true);
   available=0;release();
   await dialog.getByText('Stokda yoxdur',{exact:true}).waitFor();
   pending=new Promise(resolve=>{release=resolve;});
   await page.goto(start+'/sebet');
   const basketNext=page.locator('#shopApp').getByRole('button',{name:'Ödənişə keç'});
   await basketNext.waitFor();
   assert.equal(await basketNext.isDisabled(),true);
   available=4;termsMissing=true;release();
   await page.waitForFunction(()=>window.MirpanelCart.read()[0]?.termsVersion);
   assert.equal(await basketNext.isDisabled(),true);
   await page.goto(start);await open();
   await dialog.getByText('Məhsulun şərtlərini yenidən təsdiqləyin.',{exact:true}).waitFor();
   assert.equal(await next.isDisabled(),true);
   assert.deepEqual(errors,[]);
   await context.close();
   console.log(engine.name(),width,'PASS');
  }
 }finally{await browser.close();}
}
