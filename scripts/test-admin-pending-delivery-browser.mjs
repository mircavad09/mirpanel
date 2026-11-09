import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const port=10087;
const fixture=spawn(process.execPath,['scripts/payment-orders-browser-fixture.mjs'],{windowsHide:true,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','inherit']});
try{
 await Promise.race([once(fixture.stdout,'data'),once(fixture,'exit').then(()=>{throw Error('Fixture stopped');})]);
 for(const [engine,width] of [[chromium,1440],[chromium,390],[webkit,390]]){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   const p=await browser.newPage({viewport:{width,height:850}});p.setDefaultTimeout(9000);
   await p.goto('http://127.0.0.1:'+port);
   await p.evaluate(()=>{
    const s=window.__fixtureState, original=window.api;
    const wallet={...s.all[0],customerName:'Sintetik müştəri',customerNumber:1022,paymentSource:'wallet',deliveryPending:true,items:[{title:'CapCut Pro',planName:'1 aylıq',quantity:1,unitCents:499},{title:'Netflix Şəxsi',planName:'1 aylıq',quantity:1,unitCents:499}]};
    const auto={...s.all[1],paymentSource:'wallet',deliveryPending:false};
    const lines=wallet.items.map((x,index)=>({index,title:x.title,plan:x.planName,remaining:1}));
    let loseResponse=true;
    s.deliveryPosts=[];s.deliveryReads=0;
    window.api=async(path,options={})=>{
     const url=new URL(path,location.origin);
     if(url.pathname.endsWith('/'+wallet.id+'/delivery')){
      if(options.method!=='POST'){s.deliveryReads++;await new Promise(r=>setTimeout(r,75));return {lines:structuredClone(lines)};}
      const input=JSON.parse(options.body);
      if(!s.deliveryPosts.some(x=>x.requestId===input.requestId))lines[input.line].remaining-=input.quantity;
      s.deliveryPosts.push(input);
      wallet.deliveryPending=lines.some(x=>x.remaining>0);
      if(loseResponse){loseResponse=false;throw Error('Sintetik cavab itdi');}
      return {status:wallet.deliveryPending?'preparing':'completed'};
     }
     const result=await original(path,options);
     if(url.pathname==='/api/admin/payment-orders'){
      if(url.searchParams.get('pendingStage')==='delivery'){result.orders=wallet.deliveryPending?[wallet]:[];result.pagination.total=result.orders.length;}
      else if(url.searchParams.get('tab')==='today')result.orders=[auto,...(wallet.deliveryPending?[]:[wallet])];
     }
     return result;
    };
   });
   await p.locator('.navBtn[data-view=paymentOrders]').click();
   const cards=p.locator('[data-payment-order-id]');
   await cards.first().waitFor();
   if(width<=650)await cards.first().locator('[data-order-toggle]').click();
   assert.equal(await cards.first().getByRole('button',{name:'Çeki aç'}).count(),1);
   assert.equal(await cards.first().getByRole('button',{name:'Ödənişi təsdiqlə'}).count(),1);
   await p.locator('[data-payment-pending-stage=delivery]').click();
   const wallet=cards.filter({hasText:'#1022'});
   if(width<=650)await wallet.locator('[data-order-toggle]').click();
   await wallet.getByText('MirPanel balansı').waitFor();
   assert.equal(await cards.count(),1);assert.equal(await wallet.getByRole('button',{name:'Çeki aç'}).count(),0);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await wallet.getByRole('button',{name:'Təhvil ver'}).evaluate(b=>{b.click();b.click();});
   const modal=p.locator('dialog[data-payment-delivery-dialog]');
   await modal.waitFor();
   assert.equal(await p.evaluate(()=>__fixtureState.deliveryReads),1);
   await modal.getByLabel('Məhsul və paket').selectOption('1');
   await modal.getByLabel('E-poçt (istəyə bağlı)').fill('delivery@example.test');
   await modal.getByLabel('Şifrə (istəyə bağlı)').fill('synthetic-only');
   await modal.getByLabel('Müştəriyə təqdim ediləcək hazır mesaj').fill('Sintetik mesaj\nİkinci sətir');
   const send=modal.getByRole('button',{name:'Göndər və təhvil ver'});
   await send.evaluate(b=>{b.click();b.click();});
   await modal.getByRole('alert').getByText(/Sintetik cavab itdi/).waitFor();
   assert.equal(await p.evaluate(()=>__fixtureState.deliveryPosts.length),1);
   await send.click();await modal.waitFor({state:'hidden'});
   const posts=await p.evaluate(()=>__fixtureState.deliveryPosts);
   assert.deepEqual(posts[0],posts[1]);assert.equal(posts[0].line,1);
   assert.equal(posts[0].email,'delivery@example.test');assert.equal(posts[0].password,'synthetic-only');
   await wallet.getByRole('button',{name:'Təhvil ver'}).click();await modal.waitFor();
   assert.equal(await modal.locator('option').count(),1);
   assert.equal(await modal.getByLabel('Məhsul və paket').inputValue(),'0');
   await modal.getByLabel('Müştəriyə təqdim ediləcək hazır mesaj').fill('Sintetik CapCut');
   await send.click();await modal.waitFor({state:'hidden'});await wallet.waitFor({state:'hidden'});
   await p.locator('[data-payment-order-tab=today]').click();
   await cards.filter({hasText:'Tamamlandı'}).first().waitFor();assert.equal(await cards.count(),2);
   console.log(JSON.stringify({engine:engine.name(),width,review:true,partial:true,complete:true,retrySameRequest:true,doubleClick:true}));
  }finally{await browser.close();}
 }
}finally{fixture.kill();if(fixture.exitCode===null)await once(fixture,'exit');}
