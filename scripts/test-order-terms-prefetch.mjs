import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const products=['hbomax','netflix','capcut'].map(id=>({id,title:id,plans:[{label:'1 ay',price:5},{label:'2 ay',price:10}]}));
const seen=[],drafts=[],key=(productId,planIndex)=>productId+':'+planIndex;
let newer=false,gate;
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost'),p=u.pathname;
 if(p.startsWith('/api/payments/shop/')){
  let raw='';for await(const x of req)raw+=x;
  const body=JSON.parse(raw||'{}');
  if(p.endsWith('/drafts'))return json(res,200,{items:[]});
  if(p.endsWith('/quote')){
   const {productId,planIndex}=body.items[0],lookup=key(productId,planIndex),version=newer?'new':'old';
   seen.push(lookup);if(gate?.key===lookup)await gate.wait;
   return json(res,200,{balanceCents:0,items:[{productId,planIndex,terms:lookup+' '+version,termsVersion:version,planName:(planIndex+1)+' ay',fields:productId==='netflix'?[{key:'pin',type:'text',label:'Otaq kodu',digits:4,required:true,maxLength:4}]:[]}]});
  }
  if(p.endsWith('/draft')){
   drafts.push(body);
   if(newer&&body.termsVersion==='old')return json(res,409,{code:'CART_TERMS_CHANGED',error:'Paketin şərtləri dəyişib. Yenidən təsdiqləyin.'});
   return json(res,200,{draftId:body.id,lineId:body.id,termsVersion:body.termsVersion});
  }
 }
 if(p==='/api/community/state')return json(res,200,{profile:{user_id:'synthetic',balanceCents:0}});
 if(p==='/')return res.end(products.map(x=>'<a href="/mehsul/'+x.id+'">'+x.id+'</a>').join(' '));
 if(p.startsWith('/mehsul/')){
  const product=products.find(x=>p.endsWith('/'+x.id));if(!product)return json(res,404,{});
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><body><div id="pp-plans-container"><button class="pp-plan-label" onclick="currentPlanIdx=0">1 ay</button><button class="pp-plan-label" onclick="currentPlanIdx=1">2 ay</button></div><button id="pp-order-btn" disabled>Sifariş et</button><script>const DATA={products:${JSON.stringify(products)}};let currentProduct=DATA.products.find(p=>p.id===${JSON.stringify(product.id)}),currentPlanIdx=0;</script><script src="/order-confirmation.js"></script><script>document.getElementById('pp-order-btn').disabled=false;</script></body>`);
 }
 const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
 if(!file.includes('..')&&fs.existsSync(file)&&fs.statSync(file).isFile()){
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync(file));
 }
 json(res,404,{});
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const count=(id,i)=>seen.filter(x=>x===key(id,i)).length;
try{
 for(const [engine,width] of [[chromium,1440],[chromium,390],[webkit,390]]){
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   for(const product of products){
    seen.length=0;drafts.length=0;newer=false;
    const page=await browser.newPage({viewport:{width,height:850},hasTouch:width===390});page.setDefaultTimeout(8000);
    const quoteResponse=i=>page.waitForResponse(r=>r.url().endsWith('/quote')&&r.request().postDataJSON().items[0].planIndex===i);
    const first=quoteResponse(0);await page.goto(origin+'/mehsul/'+product.id);await first;
    const order=page.locator('#pp-order-btn'),dialog=page.locator('dialog.cart-entry[open]');
    await order.evaluate(b=>{b.click();b.click();});
    await dialog.locator('.cart-entry-terms').getByText(key(product.id,0)+' old').waitFor();
    assert.equal(await dialog.count(),1);assert.equal(count(product.id,0),1);
    assert.equal(await dialog.getByRole('button',{name:'Təsdiqləyirəm'}).isDisabled(),true);
    await dialog.getByRole('button',{name:'Ləğv et'}).click();
    let release;gate={key:key(product.id,1),wait:new Promise(r=>release=r)};
    const requested=page.waitForRequest(r=>r.url().endsWith('/quote')&&r.postDataJSON().items[0].planIndex===1);
    await page.getByRole('button',{name:'2 ay',exact:true}).click();await requested;
    await order.click();
    await dialog.getByRole('heading',{name:'Diqqət!'}).waitFor();
    await dialog.locator('[role=status][aria-busy=true]').waitFor();
    assert.equal(await dialog.locator('.cart-entry-terms,input[type=checkbox]').count(),0);
    assert.equal(await dialog.getByText('Sifariş şərtləri yoxlanılır…').count(),0);
    release();gate=null;
    await dialog.locator('.cart-entry-terms').getByText(key(product.id,1)+' old').waitFor();
    assert.equal(count(product.id,1),1);
    if(product.id==='netflix'){
     await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Təsdiqləyirəm'}).click();
     await dialog.getByRole('textbox',{name:'Otaq kodu'}).fill('0012');newer=true;
     await dialog.getByRole('button',{name:'Davam et'}).click();
     await dialog.locator('.cart-entry-terms').getByText(key(product.id,1)+' new').waitFor();
     assert.equal(await dialog.getByRole('button',{name:'Təsdiqləyirəm'}).isDisabled(),true);
     assert.equal((await page.evaluate(()=>window.MirpanelCart.read())).length,0);
     await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Təsdiqləyirəm'}).click();
     assert.equal(await dialog.getByRole('textbox',{name:'Otaq kodu'}).inputValue(),'0012');
     await dialog.getByRole('button',{name:'Davam et'}).evaluate(b=>{b.click();b.click();});
     await page.waitForFunction(()=>window.MirpanelCart.read().length===1);
     assert.equal(drafts.length,2);assert.equal(drafts[0].id,drafts[1].id);assert.equal(drafts[1].values.pin,'0012');assert.equal(drafts[1].termsVersion,'new');
    }else{
     await dialog.getByRole('button',{name:'Ləğv et'}).click();
     await page.getByRole('button',{name:'1 ay',exact:true}).click();await order.click();
     await dialog.locator('.cart-entry-terms').getByText(key(product.id,0)+' old').waitFor();
     assert.equal(count(product.id,0),1);
     await dialog.getByRole('button',{name:'Ləğv et'}).click();
     await page.goto(origin+'/');await page.goBack();
     await order.click();await dialog.locator('.cart-entry-terms').getByText(key(product.id,0)+' old').waitFor();
    }
    console.log(JSON.stringify({engine:engine.name(),width,product:product.id,preclick:true,oneDialog:true,perPackage:true,slowNetwork:true,changedTerms:product.id==='netflix',back:product.id!=='netflix'}));
    await page.close();
   }
  }finally{await browser.close();}
 }
}finally{await new Promise(r=>server.close(r));}
