import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const ids=['90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003'];
const item={productId:'synthetic',planIndex:0,quantity:1,lineId:ids[0],draftId:ids[0],termsVersion:'test',title:'Synthetic',planName:'Test',unitCents:500,available:20,terms:'Synthetic terms',fields:[]};
let failDraft,failRemove,replay,posts,state,paid,mode;
const checkout=()=>({id:ids[2],state,mode,methodId:ids[1],totalCents:500,items:[item],expiresAt:new Date(Date.now()+600000).toISOString(),receiptUploaded:true,paymentConfirmed:paid,...(state==='submitted'?{orderCode:mode==='wallet'?'992':'991',whatsappUrl:'/unexpected-whatsapp',...(mode==='wallet'?{deliveryStatus:'completed'}:{})}:{})});
const server=http.createServer(async(req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 const out=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
 if(p==='/api/community/state')return out(200,{profile:{id:'synthetic',balanceCents:10000}});
 if(p==='/api/payments/methods')return out(200,{methods:[{id:ids[1],available:true,displayName:'Synthetic card'}]});
 if(p.startsWith('/api/payments/shop/')){
  const route=p.slice(19);
  let body='';for await(const x of req)body+=x;
  if(route==='quote')return out(200,{items:JSON.parse(body).items.map(x=>({...item,...x})),totalCents:500,balanceCents:10000});
  if(route==='drafts')return out(200,{items:[]});
  if(route==='draft')return failDraft?out(503,{error:'Synthetic failure'}):out(200,{...item,draftId:JSON.parse(body).id,lineId:JSON.parse(body).id});
  if(route==='draft/remove')return failRemove?out(503,{error:'Synthetic failure'}):out(200,{removed:true});
  if(route==='checkout'){if(body&&JSON.parse(body).mode==='wallet'){mode='wallet';state='submitted';paid=true;return out(200,{...checkout(),orderCreated:true});}return out(200,checkout());}
  if(route==='method')return out(200,{id:ids[1],displayName:'Synthetic card',number:'4000000000001234',holderName:'Test'});
  if(route==='receipt')return out(200,{receiptUploaded:true});
  if(route==='cancel'){const applied=state==='reserved';state='cancelled';return out(200,{cancelled:true,cancellationApplied:applied});}
  if(route==='submit'){posts++;state='submitted';return out(200,{...checkout(),orderCreated:!replay});}
 }
 if(['/','/sebet','/odenis'].includes(p)){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  return res.end('<!doctype html><meta name="viewport" content="width=device-width"><body>'+(p==='/'?'<button id="pp-order-btn">Sifariş et</button><a id="cartHeaderLink">Səbət</a><script src="/cart-store.js"></script><script type="module">import {startCartEntry} from "/community-assets/cart-entry.js";const plans=[{}];document.querySelector("#pp-order-btn").onclick=()=>startCartEntry({id:"synthetic",title:"Synthetic",plans},plans[0]);</script>':'<link rel="stylesheet" href="/community-assets/shop.css"><main id="shopApp" class="shop-page"></main><script type="module" src="/community-assets/shop-ui.js"></script>'));
 }
 if(['/profil','/mehsul'].includes(p)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end('<!doctype html><h1>Synthetic destination</h1>');}
 const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
 if(!file.includes('..')&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'audio/wav'});return res.end(fs.readFileSync(file));}
 res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const [name,engine,width,blocked] of [['desktop',chromium,1440,false],['mobile Chrome',chromium,390,false],['mobile WebKit',webkit,390,false],['audio blocked',chromium,390,true]]){
  const b=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   const c=await b.newContext({viewport:{width,height:844},hasTouch:width===390,isMobile:width===390});
   await c.addInitScript(({blocked})=>{
    const defer=window.setTimeout;window.setTimeout=(f,ms,...args)=>defer(f,ms===12000?120:ms,...args);
    const mark=kind=>{const k='sound-test',a=JSON.parse(sessionStorage.getItem(k)||'[]');sessionStorage.setItem(k,JSON.stringify([...a,kind]));};
    const A=window.AudioContext||window.webkitAudioContext;
    if(!A){const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=async function(){const match=this.src.match(/\/sounds\/(06|07|08)-/);if(match)mark({'06':'add','07':'remove','08':'order'}[match[1]]);try{return await play.call(this);}catch(e){if(match)sessionStorage.setItem('sound-media-error',e.name);throw e;}};return;}
    const labels=new WeakMap(),decode=A.prototype.decodeAudioData,create=A.prototype.createBufferSource;
    A.prototype.decodeAudioData=async function(bytes){const sizes={37970:'add',31796:'remove',53406:'order'},kind=sizes[bytes.byteLength],buffer=await decode.call(this,bytes);labels.set(buffer,kind);return buffer;};
    A.prototype.createBufferSource=function(){const n=create.call(this),start=n.start;n.start=function(...args){if(blocked)throw Error('Synthetic autoplay block');const result=start.apply(n,args);mark(labels.get(n.buffer));return result;};return n;};
   },{blocked});
   const p=await c.newPage(),responses=[];p.setDefaultTimeout(7000);p.on('dialog',d=>void d.accept());
   const actions=p.locator('.shop-result-actions a');
   async function checkActions(code){
    assert.deepEqual(await actions.evaluateAll(nodes=>nodes.map(a=>{
     const svg=a.querySelector('svg'),label=a.lastElementChild,box=a.getBoundingClientRect(),i=svg.getBoundingClientRect(),t=label.getBoundingClientRect(),s=getComputedStyle(a);
     return {label:label.textContent,href:a.getAttribute('href'),icon:svg.getAttribute('aria-hidden'),centered:Math.abs((i.left+t.right)/2-(box.left+box.right)/2)<1&&Math.abs((i.top+i.bottom)/2-(t.top+t.bottom)/2)<1&&i.right<t.left,background:s.backgroundColor,color:s.color};
    })),[
     {label:'Sifarişlərimə bax',href:'/profil?tab=orders&order='+code,icon:'true',centered:true,background:'rgb(255, 182, 0)',color:'rgb(17, 17, 17)'},
     {label:'Məhsullara bax',href:'/mehsul',icon:'true',centered:true,background:'rgb(46, 46, 46)',color:'rgb(255, 255, 255)'},
     {label:'Ana səhifə',href:'/',icon:'true',centered:true,background:'rgba(0, 0, 0, 0)',color:'rgb(255, 255, 255)'}
    ]);
   }
   p.on('response',r=>{const path=new URL(r.url()).pathname;if(/sounds|draft\/remove|shop\/cancel/.test(path))responses.push([path,r.status()]);});
   const sounds=()=>p.evaluate(()=>JSON.parse(sessionStorage.getItem('sound-test')||'[]'));
   const waitSound=async expected=>{if(!blocked)await p.waitForFunction(n=>JSON.parse(sessionStorage.getItem('sound-test')||'[]').length>=n,expected.length).catch(async e=>{console.log({name,expected,actual:await sounds(),responses,debug:await p.evaluate(()=>({claimed:sessionStorage.getItem('mirpanel.checkout-sounds'),mediaError:sessionStorage.getItem('sound-media-error'),error:document.querySelector('.shop-error')?.textContent}))});throw e;});assert.deepEqual(await sounds(),blocked?[]:expected);};
   failDraft=true;failRemove=false;replay=false;posts=0;state='reserved';paid=false;mode='card';
   await p.goto(origin);await p.waitForFunction(()=>typeof document.querySelector('#pp-order-btn')?.onclick==='function');const order=p.locator('#pp-order-btn');await order.click();
   const entry=p.locator('dialog.cart-entry');
   await entry.getByRole('button',{name:'Ləğv et'}).click();assert.deepEqual(await sounds(),[]);
   await order.click();await entry.getByRole('checkbox').check();
   const confirm=entry.getByRole('button',{name:'Təsdiqləyirəm'});
   await confirm.click();await entry.getByText('Synthetic failure').waitFor();assert.deepEqual(await sounds(),[]);
   failDraft=false;
   await confirm.evaluate(b=>{b.click();b.click();});
   await p.locator('.mir-cart-drawer[open]').waitFor();await waitSound(['add']);
   await p.reload();await p.waitForFunction(()=>window.MirpanelCart?.read().length===1);await waitSound(['add']);
   await p.goto(origin+'/sebet');const remove=p.getByRole('button',{name:'Sil: Synthetic'});await remove.click();await waitSound(['add','remove']);
   await p.evaluate(id=>localStorage.setItem('mirpanel.cart.checkout.v1',JSON.stringify({id})),ids[2]);
   await p.goto(origin+'/odenis');await p.getByRole('button',{name:'Ləğv et',exact:true}).click();await waitSound(['add','remove','remove']);
   state='reserved';replay=true;
   await p.evaluate(id=>localStorage.setItem('mirpanel.cart.checkout.v1',JSON.stringify({id})),ids[2]);
   await p.reload();await p.getByRole('button',{name:'Davam et',exact:true}).click();await p.getByText('Sifariş № 991').waitFor();await waitSound(['add','remove','remove']);
   state='reserved';replay=false;
   await p.evaluate(id=>localStorage.setItem('mirpanel.cart.checkout.v1',JSON.stringify({id})),ids[2]);
   await p.reload();const submit=p.getByRole('button',{name:'Davam et',exact:true});
   await p.getByLabel('Çek faylı',{exact:true}).setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
   await p.getByText('Çek uğurla yükləndi',{exact:true}).waitFor();await waitSound(['add','remove','remove']);await submit.dblclick();
   await p.getByText('Sifariş № 991').waitFor();await waitSound(['add','remove','remove']);assert.equal(posts,2);
   assert.equal(new URL(p.url()).pathname,'/odenis');
   assert.equal(await p.getByRole('link',{name:'Sifarişlərimə bax'}).getAttribute('href'),'/profil?tab=orders&order=991');
   await p.getByRole('heading',{name:'Ödəniş yoxlanılır',exact:true}).waitFor();
   await p.getByText(/Çekiniz qəbul edildi/).waitFor();
   await checkActions('991');
   assert.equal(await p.getByRole('link',{name:/WhatsApp/}).count(),0);
   paid=true;await p.getByRole('heading',{name:'Ödənişiniz uğurla tamamlandı!',exact:true}).waitFor();await waitSound(['add','remove','remove','order']);
   await p.getByText(/Sifarişiniz hazırlanır/).waitFor();
   await checkActions('991');
   await p.getByRole('link',{name:'Sifarişlərimə bax'}).waitFor();
   await p.reload();await waitSound(['add','remove','remove','order']);
   await p.goto(origin);await p.waitForFunction(()=>window.MirpanelCart);
   await p.evaluate(x=>localStorage.setItem('mirpanel.cart.v1',JSON.stringify([x])),item);
   await p.goto(origin+'/odenis?mode=wallet');await p.locator('.checkout-consent input').check();
   await p.getByRole('button',{name:/Sifarişi tamamla/}).dblclick();
   await p.getByText('Sifariş № 992').waitFor();await waitSound(['add','remove','remove','order','order']);
   assert.equal(await p.getByRole('link',{name:'Sifarişlərimə bax'}).getAttribute('href'),'/profil?tab=orders&order=992');
   await p.getByText('Hesab məlumatlarınız Sifarişlərim bölməsində hazırdır.').waitFor();
   assert.deepEqual(await p.locator('.shop-result-actions a').allTextContents(),['Sifarişlərimə bax','Məhsullara bax','Ana səhifə']);
   await checkActions('992');
   for(const label of ['Məhsullara bax','Ana səhifə'])await p.getByRole('link',{name:label,exact:true}).waitFor();
   await p.reload();await waitSound(['add','remove','remove','order','order']);
   const mediaError=await p.evaluate(()=>sessionStorage.getItem('sound-media-error'));
   if(mediaError)assert.equal(mediaError,'NotSupportedError');
   const resultURL=p.url();
   for(const [index,url] of ['/profil?tab=orders&order=992','/mehsul','/'].entries()){
    await actions.nth(index).click();await p.waitForURL(origin+url);
    await p.goto(resultURL);await actions.first().waitFor();
   }
   console.log('PASS '+name+(mediaError?' (correct playback attempts; Windows WebKit media unavailable)':''));
  }finally{await b.close();}
 }
}finally{await new Promise(r=>server.close(r));}
