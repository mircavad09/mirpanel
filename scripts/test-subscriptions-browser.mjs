import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const id='12345678-1234-4234-8234-000000000001',path='/api/payments/shop';
const live=process.argv.includes('--live-assets');
let rows=[],saved=null;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 const input=async()=>{const parts=[];for await(const p of req)parts.push(p);return JSON.parse(Buffer.concat(parts));};
 if(u.pathname===path+'/subscriptions')return json({accountId:'a',subscriptions:rows});
 if(u.pathname===path+'/quote'){
  const {items:[x]}=await input();
  return json({balanceCents:1000,items:[{...x,available:4,unitCents:549,planName:'1 ay',sourcePlanKey:'month',terms:'Sınaq şərtləri',termsVersion:'current',fields:[]}]});
 }
 if(u.pathname===path+'/draft'){saved=await input();return json({draftId:id,lineId:id,termsVersion:'current'});}
 if(u.pathname==='/profil'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end(`<!doctype html><html lang="az"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/community-assets/account-panel.css"><body class="profile-screen"><main id="communityApp" class="community-shell"><section class="account-panel"><aside class="account-sidebar"></aside><div class="account-tab-content" id="app"></div></section></main><script type="module">
   import {mountSubscriptions} from '/community-assets/account-subscriptions.js?v=subscription-card-parity-1';
   window.MirpanelCart={apiVersion:6,read:()=>[],checkout:()=>[],set(){},clear(){},commitDraft(){window.committed=true},open(){window.cartOpen=true}};
   const el=(tag,a,...children)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(a))e.setAttribute(k,String(v));e.append(...children.filter(v=>v!=null));return e;};
   const button=(label,fn)=>{const b=el('button',{type:'button'},label);b.onclick=fn;return b;};
   const api=u=>fetch(u).then(r=>r.json());
   mountSubscriptions({content:document.querySelector('#app'),el,button,link:(label,href,cls)=>el('a',{href,class:cls},label),api,validate:d=>{if(d.accountId!=='a')throw Error();}});
  </script></body></html>`);
 }
 const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.slice(18):u.pathname.slice(1);
 if(live&&u.pathname.startsWith('/community-assets/')){
  const response=await fetch('https://mirpanel.com'+u.pathname+u.search);
  res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')});
  return res.end(Buffer.from(await response.arrayBuffer()));
 }
 if(file==='assets/capcut.png'){res.setHeader('Content-Type','image/png');return res.end(fs.readFileSync(file));}
 if(/\.(js|css)$/.test(file)&&!file.includes('..')&&fs.existsSync(file)){
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync(file));
 }
 res.writeHead(404);res.end();
});
const row=(productId,title,days,price,renewalStatus=null)=>({id,productId,title,days,plan:'1 ay',expiresOn:'2026-12-03',progress:35,renewalStatus,renewalCents:price,options:[{index:0,key:'month',label:'1 ay',cents:549,canRenew:true}]});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/profil?tab=subscriptions';
try{
 for(const [engine,width] of [chromium,webkit].flatMap(engine=>[1440,320,390,430].map(width=>[engine,width]))){
  const b=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   const p=await b.newPage({viewport:{width,height:820},isMobile:width<600,hasTouch:width<600});
   rows=[];saved=null;await p.goto(url);await p.getByText('Aktiv abunəliyiniz yoxdur.').waitFor();
   assert.equal(await p.locator('.subs-count').textContent(),'0 aktiv');
   rows=[row('capcut','CapCut Pro',6,549),row('netflix','Netflix Şəxsi',10,299)];
   await p.reload();await p.getByText('2 aktiv').waitFor();
   assert.match(await p.locator('.subs-summary').textContent(),/8[.,]48/);
   assert.equal(await p.getByRole('button',{name:'Balansı hazırla'}).getAttribute('aria-pressed'),'false');
   await p.getByText('1 abunəliyin müddəti bu həftə bitir.',{exact:false}).waitFor();
   const cap=p.locator('.subs-card').filter({hasText:'CapCut Pro'}),net=p.locator('.subs-card').filter({hasText:'Netflix Şəxsi'});
   assert.equal(await cap.locator('progress').getAttribute('data-tone'),'amber');
   assert.equal(await cap.getByRole('button',{name:'Yenilə'}).getAttribute('data-urgent'),'true');
   assert.equal(await net.locator('progress').getAttribute('data-tone'),'orange');
   assert.equal(await net.getByRole('button',{name:'Yenilə'}).getAttribute('data-urgent'),null);
   assert.equal(await cap.locator('time').textContent(),'03.12.2026');
   await cap.getByRole('button',{name:'Yenilə'}).click();
   const modal=p.getByRole('dialog',{name:'Paket seç'}),next=modal.getByRole('button',{name:'Davam et'});
   assert.equal(await next.isDisabled(),true);
   assert.equal(await modal.getByText('Netflix Şəxsi',{exact:true}).count(),0);
   await modal.getByRole('button',{name:/1 ay/}).click();await next.click();
   const terms=p.locator('dialog.cart-entry');
   await terms.getByText('Sınaq şərtləri').waitFor();await terms.getByRole('checkbox').check();
   await terms.getByRole('button',{name:'Təsdiqləyirəm'}).click();
   await p.waitForFunction(()=>window.committed&&window.cartOpen);
   assert.equal(saved.renewalId,id);assert.equal(saved.renewalExpiresOn,'2026-12-03');assert.equal(saved.productId,'capcut');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   rows=[row('capcut','CapCut Pro',3,null,'preparing'),row('netflix','Netflix Şəxsi',7,299,'failed')];
   await p.reload();await p.getByText('Hazırlanır',{exact:true}).waitFor();await p.getByText('Son yeniləmə tamamlanmadı',{exact:true}).waitFor();
   await p.getByText('1 abunəliyin qiyməti məlum deyil; cəmə daxil edilməyib.').waitFor();
   assert.equal(await cap.locator('progress').getAttribute('data-tone'),'red');
   assert.equal(await net.locator('progress').getAttribute('data-tone'),'amber');
   assert.equal(await net.getByRole('button',{name:'Yenilə'}).getAttribute('data-urgent'),null);
   await cap.getByRole('button',{name:'Yenilə'}).click();await modal.getByText('Bu abunəlik üçün yeniləmə artıq davam edir.').waitFor();
   assert.equal(await modal.getByRole('button',{name:/1 ay/}).isDisabled(),true);
   const old={...row('capcut','CapCut Pro',28,null),plan:'Silinmiş CapCut paketi',lastPurchaseCents:499};
   rows=[{...old,days:5,expiresOn:'2026-11-14'}, {...old,days:30,expiresOn:'2026-12-09'},{...row('netflix','Netflix Şəxsi',31,null),options:[]}];
   saved=null;await p.reload();
   await p.getByText('30 gündə yenilənəcək',{exact:true}).waitFor();
   await p.getByText('9,98 ₼ · 2 abunəlik',{exact:true}).waitFor();
   assert.equal(await p.getByText(/Təxmini cəm/).count(),0);
   await p.locator('.subs-warning').getByText('1 abunəliyin müddəti bu həftə bitir. Kəsilməməsi üçün indidən yeniləyə bilərsiniz.',{exact:true}).waitFor();
   assert.equal(await p.getByText('Son alış qiyməti',{exact:true}).count(),0);
   assert.equal(await p.getByText('Silinmiş CapCut paketi',{exact:false}).count(),2);
   assert.deepEqual(await cap.locator('time').allTextContents(),['14.11.2026','09.12.2026']);
   const summaryButton=p.getByRole('button',{name:'Balansı hazırla'});
   await p.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.includes('account-subscriptions.css')));
   assert.deepEqual(await summaryButton.evaluate(n=>{const s=getComputedStyle(n);return [s.backgroundColor,s.color,s.fontWeight];}),['rgb(8, 122, 85)','rgb(255, 255, 255)','600']);
   await summaryButton.click();
   assert.equal(await p.locator('.subs-card').count(),2);
   assert.equal(await p.getByText('Netflix Şəxsi',{exact:true}).count(),0);
   await p.getByRole('button',{name:'Hamısını göstər'}).click();
   await net.getByRole('button',{name:'Yenilə'}).click();
   await modal.getByText('Hazırda satışda olan paket tapılmadı.').waitFor();
   await modal.getByRole('button',{name:'Ləğv et'}).click();
   await cap.first().getByRole('button',{name:'Yenilə'}).click();
   await modal.getByText('5,49 ₼',{exact:true}).waitFor();
   assert.equal(saved,null,'Opening the picker must not write a draft');
   await modal.getByRole('button',{name:/1 ay/}).click();await next.click();
   await terms.getByText('Sınaq şərtləri').waitFor();await terms.getByRole('checkbox').check();
   await terms.getByRole('button',{name:'Təsdiqləyirəm'}).click();
   await p.waitForFunction(()=>window.committed&&window.cartOpen);
   assert.equal(saved.productId,'capcut');
   rows=[old,{...old,days:7}];await p.reload();
   await p.getByText('1 abunəliyin müddəti bu həftə bitir. Kəsilməməsi üçün indidən yeniləyə bilərsiniz.',{exact:true}).waitFor();
   rows=[{...old,days:5},{...old,days:7}];await p.reload();
   await p.getByText('2 abunəliyin müddəti bu həftə bitir. Kəsilməməsi üçün indidən yeniləyə bilərsiniz.',{exact:true}).waitFor();
   rows=[old];await p.reload();await p.getByText('4,99 ₼ · 1 abunəlik',{exact:true}).waitFor();
   assert.equal(await p.locator('.subs-warning').count(),0);
   {
    const longPlan='1 Aylıq (0–500 AI kredit) endirim (Telefon)';
    rows=[8,7,6,1].map((days,i)=>({...row('capcut','CapCut Pro',days,null),id:id.slice(0,-1)+(i+1),plan:i===1?longPlan:'7 gün',expiresOn:'2026-11-'+(10+days),image:'/assets/capcut.png',lastPurchaseCents:499}));
    await p.reload();
    await p.getByText(longPlan,{exact:false}).waitFor();
    await p.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.includes('account-subscriptions.css')));
    const cards=p.locator('.subs-card');
    for(const [i,card] of (await cards.all()).entries()){
     const product=await card.locator('.subs-product').boundingBox(),days=await card.locator('.subs-days').boundingBox();
     const image=await card.locator('.subs-image').boundingBox(),title=await card.locator('h2').boundingBox(),plan=await card.locator('.subs-plan').boundingBox(),date=await card.locator('.subs-expiry').boundingBox();
     const renew=await card.locator('.subs-renew').boundingBox(),progress=await card.locator('progress').boundingBox();
     assert(image.x+image.width<=title.x && product.x+product.width<=days.x && plan.y>=title.y+title.height && date.y>=plan.y+plan.height && date.x===title.x);
     assert(renew.height>=44 && progress.x+progress.width<=renew.x);
     assert(Math.abs(progress.y+progress.height/2-renew.y-renew.height/2)<1);
     const badgeStyle=await card.locator('.subs-days').evaluate(n=>{const s=getComputedStyle(n);return [s.backgroundColor,s.color,s.borderRadius];});
     if(i===0)assert.notEqual(badgeStyle[0],'rgb(120, 14, 27)');
     else assert.deepEqual(badgeStyle,['rgb(120, 14, 27)','rgb(255, 209, 214)','999px']);
     const buttonStyle=await card.locator('.subs-renew').evaluate(n=>{const s=getComputedStyle(n);return [s.backgroundColor,s.color,s.borderRadius,getComputedStyle(n.querySelector('svg')).stroke];});
     assert.equal(buttonStyle[2],'999px');
     if(i>=2)assert.deepEqual(buttonStyle,['rgb(255, 255, 255)','rgb(17, 17, 17)','999px','rgb(17, 17, 17)']);
    }
    assert.equal(await p.getByText('Son alış qiyməti',{exact:true}).count(),0);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const screenshot=width===390?process.env.MIRPANEL_SUBS_SCREENSHOT:width===1440?process.env.MIRPANEL_SUBS_DESKTOP_SCREENSHOT:null;
    if(screenshot)await cards.nth(2).screenshot({path:screenshot});
    const renewButton=cards.last().getByRole('button',{name:'Yenilə'});
    if(width<600)await renewButton.tap();else await renewButton.click();
    await modal.getByRole('button',{name:/1 ay/}).click();await next.click();
    await terms.getByText('Sınaq şərtləri').waitFor();await terms.getByRole('checkbox').check();
    await terms.getByRole('button',{name:'Təsdiqləyirəm'}).click();
    await p.waitForFunction(()=>window.committed&&window.cartOpen);
    assert.equal(saved.renewalId,rows[3].id);
   }
   console.log('PASS '+engine.name()+' '+width+'px: card parity at 8/7/6/1 days, long plan, summary, and correct renewal → existing terms → cart');
  }finally{await b.close();}
 }
}finally{await new Promise(r=>server.close(r));}
