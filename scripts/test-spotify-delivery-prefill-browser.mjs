import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const port=10098,live=process.argv.includes('--live'),out=path.resolve('outputs/spotify-delivery-prefill');await fs.mkdir(out,{recursive:true});
const fixture=spawn(process.execPath,['scripts/payment-orders-browser-fixture.mjs'],{windowsHide:true,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','inherit']});
try{
 await Promise.race([once(fixture.stdout,'data'),once(fixture,'exit').then(()=>{throw Error('Fixture stopped');})]);
 let liveScript;
 if(live){const r=await fetch('https://mirpanel.onrender.com/payment-admin.js?v=spotify-delivery-prefill-1');assert(r.ok);liveScript=await r.text();assert(liveScript.includes('const fillAccount='));}
 for(const engine of [chromium,webkit])for(const width of [390,1440]){
  const b=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   const p=await b.newPage({viewport:{width,height:900}});p.setDefaultTimeout(9000);
   if(live)await p.route('**/payment-admin.js',r=>r.fulfill({contentType:'text/javascript',body:liveScript}));
   await p.goto('http://127.0.0.1:'+port);
   await p.evaluate(()=>{
    const s=window.__fixtureState,original=window.api;
    const make=(o,n)=>({...o,customerName:'Sintetik '+n,customerNumber:1100+n,paymentSource:'wallet',deliveryPending:true,productId:'spotify',productTitle:'Spotify Premium',planName:'Öz hesabınızda',items:[{productId:'spotify',title:'Spotify Premium',planName:'Öz hesabınızda',quantity:1,unitCents:549},...(n===1?[{productId:'capcut',title:'CapCut',planName:'1 ay',quantity:1,unitCents:499}]:[])]});
    s.prefillOrders=[make(s.all[0],1),make(s.all[1],2)];s.prefillDelay={};s.prefillPosts=[];
    window.api=async(url,options={})=>{
     const u=new URL(url,location.origin),order=s.prefillOrders.find(o=>u.pathname==='/api/admin/payment-orders/'+o.id+'/delivery');
     if(order){
      const n=s.prefillOrders.indexOf(order)+1;
      if(options.method==='POST'){s.prefillPosts.push(JSON.parse(options.body));return {status:'completed'};}
      await new Promise(r=>setTimeout(r,s.prefillDelay[n]||50));
      return {lines:order.items.map((item,index)=>({index,title:item.title,plan:item.planName,remaining:1,message:'Sintetik hazır mesaj',...(index===0?{customerAccount:{email:'buyer'+n+'@example.test',password:s.prefillMissing&&n===2?'':'synthetic-'+n}}:{})}))};
     }
     const result=await original(url,options);
     if(u.pathname==='/api/admin/payment-orders'&&u.searchParams.get('pendingStage')==='delivery'){result.orders=s.prefillOrders;result.pagination.total=2;}
     return result;
    };
   });
   await p.locator('.navBtn[data-view=paymentOrders]').click();await p.locator('[data-payment-order-id]').first().waitFor();
   await p.locator('[data-payment-pending-stage=delivery]').click();
   const cards=p.locator('[data-payment-order-id]');await cards.filter({hasText:'Sintetik 1'}).waitFor();
   const modal=p.locator('dialog[data-payment-delivery-dialog]'),email=modal.locator('[name=email]'),password=modal.locator('[name=password]'),line=modal.locator('[name=line]');
   const close=()=>modal.getByRole('button',{name:'Bağla',exact:true}).click();
   async function open(n){const card=cards.filter({hasText:'Sintetik '+n});if(width<650&&await card.locator('.paymentOrderCardDetails').evaluate(e=>e.hidden))await card.locator('[data-order-toggle]').click();await card.getByRole('button',{name:'Təhvil ver',exact:true}).click();await modal.waitFor();}
   async function loaded(){await line.locator('option').first().waitFor({state:'attached'});assert.equal(await password.getAttribute('type'),'text');}
   await open(1);await loaded();assert.equal(await email.inputValue(),'buyer1@example.test');assert.equal(await password.inputValue(),'synthetic-1');
   await email.fill('edited@example.test');await password.fill('admin-edited');await line.selectOption('1');assert.equal(await email.inputValue(),'');assert.equal(await password.inputValue(),'');
   await line.selectOption('0');assert.equal(await email.inputValue(),'edited@example.test');assert.equal(await password.inputValue(),'admin-edited');await close();
   await open(1);await loaded();assert.equal(await password.inputValue(),'synthetic-1');await close();
   // Admin can type before the delayed preview, and those edits win.
   await p.evaluate(()=>__fixtureState.prefillDelay[2]=650);await open(2);assert.equal(await email.inputValue(),'');assert.equal(await password.inputValue(),'');await password.fill('early-admin-edit');await loaded();assert.equal(await email.inputValue(),'buyer2@example.test');assert.equal(await password.inputValue(),'early-admin-edit');await close();
   await p.evaluate(()=>{__fixtureState.prefillDelay[2]=20;__fixtureState.prefillMissing=true;});await open(2);await loaded();assert.equal(await email.inputValue(),'buyer2@example.test');assert.equal(await password.inputValue(),'');await close();
   // A closed order's late reply cannot fill the newly selected order.
   await p.evaluate(()=>{__fixtureState.prefillDelay[1]=750;__fixtureState.prefillMissing=false;});await open(1);await close();await open(2);await loaded();await p.waitForTimeout(850);assert.equal(await email.inputValue(),'buyer2@example.test');assert.equal(await password.inputValue(),'synthetic-2');
   await p.screenshot({path:path.join(out,`${live?'live':'local'}-${engine.name()}-${width}.png`)});
   await email.fill('confirmed@example.test');await password.fill('confirmed-synthetic');await modal.getByRole('button',{name:'Göndər və təhvil ver'}).evaluate(b=>{b.click();b.click();});await modal.waitFor({state:'hidden'});
   const posts=await p.evaluate(()=>__fixtureState.prefillPosts);assert.equal(posts.length,1);assert.equal(posts[0].email,'confirmed@example.test');assert.equal(posts[0].password,'confirmed-synthetic');
   console.log('PASS',live?'live assets':'local',engine.name(),width,'prefill/edit/reopen/late response/isolation/submit');
  }finally{await b.close();}
 }
}finally{fixture.kill();}
