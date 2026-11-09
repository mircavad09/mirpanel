import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';

const baseline=process.argv.includes('--before'),audit=process.argv.includes('--audit'),live=process.argv.includes('--live'),ordersOnly=process.argv.includes('--orders-only');
const usersOnly=process.argv.includes('--users');
const filtersOnly=process.argv.includes('--order-filters');
const phase=baseline?'before':live?'live':'after';
const output=path.resolve('../../outputs/admin-mobile-layout');
fs.mkdirSync(output,{recursive:true});
const admin=path.resolve('mirpanel-admin/public'),community=path.resolve('mirpanel-admin/community/public');
const state=extractAdminState(fs.readFileSync('app.js','utf8'));
const avatarUrl='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="#b28337"/><path fill="white" d="M20 9a6 6 0 1 0 0 12 6 6 0 1 0 0-12m0 15c-8 0-12 4-12 8h24c0-4-4-8-12-8"/></svg>');
const user={id:'qa-user',memberNumber:1022,name:'Məhəmməd Əli Abdullazadə Məmmədov',email:'qa@example.invalid',lastSeen:new Date(Date.now()-180000).toISOString(),balanceCents:1234567,spentCents:98765432,avatarUrl,orderCount:2,online:true,emailVerified:true};
const item={title:'CapCut Pro — çox uzun sintetik məhsul adı (telefon və kompüter üçün)',planName:'Uzun paket adı · 1 aylıq istifadə',quantity:2,unitCents:499};
const netflix={title:'Netflix Şəxsi',planName:'1 aylıq',quantity:1,unitCents:594};
const order={id:'12345678-1234-4234-8234-000000000001',orderCode:'MP-123456',customerName:user.name,customerNumber:user.memberNumber,productTitle:item.title,planName:item.planName,items:[item],amount:9.98,currency:'AZN',status:'reviewing',reservationStatus:'reviewing',paymentMethodLabel:'ABB •••• 1234',receiptAvailable:true,createdAt:user.lastSeen,auditHistory:[]};
const wallet={...order,id:'12345678-1234-4234-8234-000000000002',orderCode:'MP-123457',items:[netflix,item],amount:15.92,paymentSource:'wallet',paymentConfirmed:true,deliveryPending:true,receiptAvailable:false};
const api=u=>{
 const p=u.pathname,q=u.searchParams;
 if(p==='/api/admin/state')return {data:state,sha:'synthetic',loadedAt:user.lastSeen,csrfToken:'test'};
 if(p.endsWith('/community/users'))return {users:q.get('filter')==='banned'||(q.get('q')&&!user.name.toLocaleLowerCase('az').includes(q.get('q').toLocaleLowerCase('az')))?[]:[user],hasMore:false,total:1};
 if(p.endsWith('/users/'+user.id))return {user,profile:{},orders:[{order_code:order.orderCode,product_title:item.title,plan_name:item.planName,amount:9.98,currency:'AZN',status:'reviewing'}],totalCents:user.spentCents};
 if(p.endsWith('/community/wallet'))return {cents:user.balanceCents,items:[],more:false};
 if(p.endsWith('/payment-orders'))return {orders:[q.get('pendingStage')==='delivery'?wallet:ordersOnly?{...order,items:[],quantity:2}:order],counts:{pending:1,today:0,all:1,expiring:0},pagination:{page:1,pageSize:20,total:1,totalPages:1},filters:{products:[{id:'capcut',title:'CapCut Pro'}],durations:[],methods:[]},statistics:{},appliedFilters:{}};
 if(p.endsWith('/receipt'))return {url:'about:blank#synthetic-receipt'};
 if(p.endsWith('/delivery'))return {lines:[{index:0,title:netflix.title,plan:netflix.planName,remaining:1},{index:1,title:item.title,plan:item.planName,remaining:2}]};
 if(p.endsWith('/payment-methods'))return {methods:[{id:'qa-bank',displayName:'Sintetik bank',providerName:'ABB',active:true,hasNumber:true,available:true,last4:'1234',limitMode:'unlimited'}]};
 if(p.endsWith('/payment-settings'))return {settings:{}};
 if(p.endsWith('/payment-monthly-reports'))return {current:null,archives:[]};
 if(p.endsWith('/dashboard'))return {users:1,online:1,orders:2,pendingOrders:1,walletCents:'1234567'};
 if(p.endsWith('/homepage-banners'))return {managed:true,banners:[],maxBytes:100000};
 if(p.endsWith('/stories'))return {stories:[]};
 if(p.endsWith('/ready-stock'))return {products:[]};
 if(p.endsWith('/state'))return {profile:{display_name:'Sınaq admini'},settings:{},messages:[],members:[],pinned:[]};
 return {items:[],rows:[],orders:[],products:[],requests:[],history:[],banners:[],methods:[],archives:[],resources:[],events:[],settings:{},backgrounds:{},notifications:[],threads:[],accounts:[]};
};
const aliases={'/':'/admin.html','/admin/employee-stock':'/manual-stock-admin.html','/admin/workforce':'/workforce-admin.html'};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://fixture');
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(u.pathname.startsWith('/api/')){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(api(u)));}
 const name=aliases[u.pathname]||u.pathname;
 const f=name.startsWith('/community-assets/')?path.join(community,name.slice(18)):path.join(admin,name);
 if(!f.startsWith(admin+path.sep)&&!f.startsWith(community+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});
 const baseFiles=['admin.css','admin-wallet-users.css','admin-wallet-users.js','admin-community-panel.js','cms-admin.js','payment-admin.js','admin.html'];
 return res.end(baseline&&baseFiles.includes(path.basename(f))?execFileSync('git',['show','c22c61f:mirpanel-admin/public/'+path.basename(f)]):fs.readFileSync(f));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=live?'https://mirpanel.onrender.com':'http://127.0.0.1:'+server.address().port;
const viewSelector=v=>'.navBtn[data-view="'+v+'"]';
const layout=page=>page.evaluate(()=>{
 const view=[...document.querySelectorAll('main>section')].find(n=>n.offsetWidth>0);
 const nodes=[...(view||document.body).querySelectorAll('table,dialog,.btn,input,select,textarea,.paymentOrderAdminCard,.wu-toolbar,.panel')].filter(n=>n.getClientRects().length);
 const issues=nodes.filter(n=>{const b=n.getBoundingClientRect();return b.right>innerWidth+1||b.left< -1||n.matches('table')&&n.scrollWidth>n.clientWidth+1;}).slice(0,10).map(n=>[n.tagName,String(n.className).slice(0,65),Math.round(n.getBoundingClientRect().right)]);
 return {viewport:innerWidth,document:document.documentElement.scrollWidth,issues};
});
try{
 const variants=baseline?[[chromium,320],[chromium,390],[chromium,1440]]:[[chromium,320],[chromium,390],[chromium,430],[webkit,320],[webkit,390],[webkit,430],[chromium,1440]];
 for(const [engine,width] of variants){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   const context=await browser.newContext({viewport:{width,height:860},hasTouch:width<600,isMobile:width<600,serviceWorkers:'block'});
   if(live&&(usersOnly||filtersOnly||ordersOnly)){
    const session=process.env.MIRPANEL_ADMIN_TEST_SESSION,index=session?.indexOf('=')??-1;
    if(index<1)throw Error('A temporary admin session is required for the protected Users assets.');
    await context.addCookies([{name:session.slice(0,index),value:session.slice(index+1),url:origin,httpOnly:true,secure:true,sameSite:'Strict'}]);
   }
   await context.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(u.origin!==origin||r.request().method()!=='GET')return r.abort();
    if(live&&u.pathname.startsWith('/api/'))return r.fulfill({json:api(u)});
    // Use the checked-in shell for the synthetic admin session; all view scripts
    // and styles still come from the deployed Render service.
    if(live&&!usersOnly&&!filtersOnly&&!ordersOnly&&u.pathname==='/admin.html')return r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(admin,'admin.html'))});
    return r.continue();
   });
   const page=await context.newPage();page.setDefaultTimeout(10000);
   const assets=new Map();
   const expectedAssets=usersOnly?['/admin-wallet-users.js','/admin-wallet-users.css']:['/payment-admin.js','/admin.css'];
   if(live)page.on('response',r=>{const u=new URL(r.url());if(r.ok()&&u.origin===origin&&expectedAssets.includes(u.pathname))assets.set(u.pathname,r.text());});
   const verifyAssets=async()=>{if(live)for(const file of expectedAssets){
    assert(assets.has(file),'Deployed asset missing: '+file);
    const normalize=v=>v.replace(/\r\n/g,'\n').trimEnd();
    assert.equal(normalize(await assets.get(file)),normalize(fs.readFileSync(path.join(admin,file),'utf8')));
   }};
   if(ordersOnly)await page.addInitScript(()=>{window.open=()=>({location:{replace:url=>{window.syntheticReceipt=url;}},close(){}});});
   await page.goto(origin+'/admin.html');
   await page.locator(viewSelector('communityUsers')).waitFor({state:'attached'});
   const open=async v=>{
    const link=page.locator(viewSelector(v));
    if(await link.isVisible())await link.click();else await link.evaluate(n=>n.click());
    await page.locator('#'+v+'View').waitFor();
   };
   const mobile=width<600;
   let usersLayout;
   if(filtersOnly){
    const queries=[];
    let release, fail=false;
    const filterOptions={products:[{id:'capcut',title:'CapCut Pro — çox uzun məhsul seçimi, telefon və kompüter üçün'}],durations:[{value:'1',label:'Bir aylıq çox uzun paket müddəti'}],methods:[{id:'abb',label:'ABB — çox uzun bank seçimi'}]};
    await page.route('**/api/admin/payment-orders?*',async r=>{
     const u=new URL(r.request().url());
     const q=u.searchParams;
     if(q.has('pendingStage'))queries.push(Object.fromEntries(q));
     if(q.has('search'))await new Promise(resolve=>{release=resolve;});
     if(fail)return r.fulfill({status:503,json:{error:'Sintetik şəbəkə xətası.'}});
     const result=api(u);result.filters=filterOptions;result.appliedFilters.durationMonths=q.get('durationMonths')||'';
     if(q.has('search'))result.orders=[{...order,id:wallet.id,orderCode:'MP-654321'}];
     await r.fulfill({json:result});
    });
    await open('paymentOrders');
    const form=page.locator('#paymentOrderFilters'), status=page.locator('#paymentOrdersStatus'), list=page.locator('#paymentOrdersList');
    const initialOrder=list.locator('[data-order-code="MP-123456"]');
    await initialOrder.waitFor();
    const grid=await form.evaluate(n=>{
     const controls=[...n.querySelectorAll('label:not(.paymentCustomDate) input,label:not(.paymentCustomDate) select')];
     const formBox=n.getBoundingClientRect();
     return {ids:controls.map(e=>e.id),rows:controls.map(e=>Math.round(e.getBoundingClientRect().top)),columns:getComputedStyle(n).gridTemplateColumns.split(' ').length,
      fits:controls.every(e=>{const b=e.getBoundingClientRect();return b.left>=formBox.left&&b.right<=formBox.right&&b.right<=innerWidth;}),
      actions:[...n.querySelectorAll('button')].map(e=>{const b=e.getBoundingClientRect();return [b.top,b.height];})};
    });
    if(!mobile){assert.equal(grid.columns,8);await verifyAssets();console.log(JSON.stringify({phase,width,desktopColumns:grid.columns}));continue;}
    assert.deepEqual(grid.ids,['paymentOrderSearch','paymentOrderProduct','paymentOrderPlan','paymentOrderMethod','paymentOrderPeriod','paymentOrderSort']);
    assert.equal(grid.columns,3);assert(grid.fits);assert.equal(new Set(grid.rows.slice(0,3)).size,1);assert.equal(new Set(grid.rows.slice(3)).size,1);assert(grid.rows[3]>grid.rows[0]);
    assert(grid.actions.every(([top,height])=>top===grid.actions[0][0]&&height>=44&&top>grid.rows[3]));
    const count=queries.length;
    await form.locator('#paymentOrderSearch').fill('MP-654321');
    for(const [field,value] of [['Product','capcut'],['Plan','1'],['Method','abb'],['Period','this_month'],['Sort','oldest']]) await form.locator('#paymentOrder'+field).selectOption(value);
    assert.equal(queries.length,count);
    assert(await form.locator('select').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().right<=innerWidth)));
    const originalDocument=await page.evaluate(()=>performance.timeOrigin);
    const request=page.waitForRequest(r=>r.url().includes('/payment-orders?')&&new URL(r.url()).searchParams.has('search'));
    await form.locator('#paymentOrderFiltersApply').click();
    await request;await page.locator('#paymentOrdersStatus[data-filter-loading]').waitFor();
    await form.evaluate(n=>{n.requestSubmit();n.requestSubmit();});
    assert.equal(queries.length,count+1);
    assert.deepEqual(queries.at(-1),{tab:'pending',period:'this_month',search:'MP-654321',productId:'capcut',durationMonths:'1',methodId:'abb',sort:'oldest',page:'1',pendingStage:'payment'});
    assert(await initialOrder.isVisible());
    assert.equal(await status.evaluate(n=>getComputedStyle(n,'::before').width),'11px');
    release();await list.locator('[data-order-code="MP-654321"]').waitFor();
    await form.locator('#paymentOrderFiltersClear').click();
    await initialOrder.waitFor();
    assert.deepEqual(queries.at(-1),{tab:'pending',period:'all',sort:'newest',page:'1',pendingStage:'payment'});
    assert.equal(queries.length,count+2);assert.equal(await page.evaluate(()=>performance.timeOrigin),originalDocument);
    assert.equal(await form.locator('#paymentOrderSearch').inputValue(),'');
    if(engine===chromium&&width===390){await form.evaluate(n=>n.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(output,'order-filters-'+phase+'-390.png')});}
    fail=true;await form.locator('#paymentOrderFiltersApply').click();
    await page.waitForFunction(()=>document.querySelector('#paymentOrdersStatus').textContent.includes('Mövcud siyahı qorunub'));
    assert(await form.locator('#paymentOrderFiltersApply').isEnabled());assert.equal(await status.getAttribute('data-filter-loading'),null);
    assert(await initialOrder.isVisible());
    await verifyAssets();console.log(JSON.stringify({phase,engine:engine.name(),width,grid,apply:true,clear:true,slow:true,duplicate:false,error:true}));continue;
   }
   if(!ordersOnly){
   await open('communityUsers');
   const userView=page.locator('#communityUsersView');
   await userView.getByText(user.name,{exact:true}).first().waitFor();
   await page.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.includes('/admin-wallet-users.css')));
   if(engine===chromium&&[390,1440].includes(width)){await userView.evaluate(n=>n.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(output,'users-'+phase+'-'+width+'.png')});}
   usersLayout=await layout(page);
   if(!baseline){assert.deepEqual(usersLayout.issues,[]);assert.equal(await userView.locator('.wu-mobile-details').first().isVisible(),mobile);}
   if(!baseline&&mobile){
    const geometry=await userView.locator('.wu-identity strong').evaluate(name=>{
     const rects=(node,start=0,end=node.length)=>{const r=document.createRange();r.setStart(node,start);r.setEnd(node,end);return [...r.getClientRects()];};
     const n=name.firstChild;
     const split=[...n.textContent.matchAll(/\S+/g)].some(w=>rects(n,w.index,w.index+w[0].length).length!==1);
     const amounts=[...name.closest('tr').querySelectorAll('.wu-money')].map(a=>rects(a.firstChild));
     const fits=amounts.every(rs=>rs.length===1&&rs[0].left>=0&&rs[0].right<=innerWidth);
     return {split,fits,sameRow:amounts.length===2&&Math.abs(amounts[0][0].top-amounts[1][0].top)<1};
    });
    assert.deepEqual(geometry,{split:false,fits:true,sameRow:true});
    const row=userView.locator('.wu-mobile-details').first();
    await row.locator('summary').click();assert.equal(await row.getAttribute('open'),'');
    await row.getByRole('button',{name:'Profilə bax',exact:true}).click();
    await userView.getByRole('heading',{name:user.name}).waitFor();
    await userView.getByRole('button',{name:/Geri/}).click();
    assert.equal(await row.getAttribute('open'),'');
    await row.locator('summary').click();assert.equal(await row.getAttribute('open'),null);
    const search=userView.getByPlaceholder('Ad, e-poçt və üzv ID-si');
    await search.fill('Uyğun deyil');await search.press('Enter');
    await userView.getByText('İstifadəçi tapılmadı.').waitFor();
    await search.fill('Məhəmməd');await userView.getByRole('button',{name:'Axtar',exact:true}).click();
    await userView.getByText(user.name,{exact:true}).first().waitFor();
    await userView.getByRole('button',{name:'Qadağan olunmuş'}).click();await userView.getByText('İstifadəçi tapılmadı.').waitFor();
    await userView.getByRole('button',{name:'Onlayn'}).click();await userView.getByText(user.name,{exact:true}).first().waitFor();
    assert.equal(await userView.locator('.wu-money').first().evaluate(n=>getComputedStyle(n).whiteSpace),'nowrap');
   }else if(!baseline){
    assert.equal(await userView.locator('.wu-user-list').evaluate(n=>getComputedStyle(n).display),'table');
    assert.equal(await userView.locator('.wu-icon:visible').count(),2);
   }
   }
   if(usersOnly){await verifyAssets();console.log(JSON.stringify({phase,engine:engine.name(),width,usersLayout}));continue;}
   await open('paymentOrders');
   const orderView=page.locator('#paymentOrdersView'),card=orderView.locator('[data-payment-order-id]').first();
   await card.waitFor();
   if(baseline&&engine===chromium&&[390,1440].includes(width)){await card.evaluate(n=>n.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(output,'orders-'+phase+'-'+width+'.png')});}
   const ordersLayout=await layout(page);
   if(!baseline){
    assert.deepEqual(ordersLayout.issues,[]);
    const toggle=card.locator('[data-order-toggle]');
    const details=card.locator('.paymentOrderCardDetails');
    const checkFields=async()=>assert.deepEqual(await details.locator('dt').allTextContents(),['Məhsul','Ödəniş üsulu','Müştəri']);
    for(const value of ['MP-123456','Yoxlanılır',...(mobile?['CapCut Pro','9.98 ₼']:[])])assert((await toggle.innerText()).includes(value));
     assert.equal(await card.getByRole('button',{name:'Çeki aç'}).isVisible(),false);
     await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
     await checkFields();
     assert.deepEqual(await details.locator('li').allTextContents(),[item.title+' · '+item.planName+' · 2 ədəd · 9,98 ₼']);
     await card.getByRole('button',{name:'Çeki aç'}).waitFor();
     await card.getByRole('button',{name:'Ödənişi təsdiqlə'}).waitFor();
     await card.getByText(user.name+' · #1022',{exact:true}).waitFor();
     await details.getByText('ABB •••• 1234',{exact:true}).waitFor();
     for(const label of ['Sifariş məlumatları','Üzərinə götür'])assert.equal(await card.getByRole('button',{name:label}).count(),0);
     if(ordersOnly){
      await card.getByRole('button',{name:'Çeki aç'}).click();
      await page.waitForFunction(()=>window.syntheticReceipt==='about:blank#synthetic-receipt');
      await card.getByRole('button',{name:'Ödənişi təsdiqlə'}).click();
      const approval=page.locator('dialog.paymentActionDialog');
      await approval.getByRole('button',{name:'Təsdiqlə',exact:true}).waitFor();
      await approval.getByRole('button',{name:'Ləğv et',exact:true}).click();
     }
     await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
     await orderView.locator('#paymentOrderProduct').selectOption('capcut');
     const filterRequest=page.waitForResponse(r=>new URL(r.url()).searchParams.get('productId')==='capcut'&&r.url().includes('/payment-orders?')&&r.ok());
     await orderView.locator('#paymentOrderFiltersApply').click();await filterRequest;
     await orderView.locator('[data-payment-pending-stage=delivery]').click();
     await toggle.getByText(/MP-123457/).waitFor();
     await toggle.click();await checkFields();
     await details.getByText('MirPanel balansı',{exact:true}).waitFor();
     assert.deepEqual(await details.locator('li').allTextContents(),['Netflix Şəxsi · 1 aylıq · 1 ədəd · 5,94 ₼',item.title+' · '+item.planName+' · 2 ədəd · 9,98 ₼']);
     assert.equal(await card.getByRole('button',{name:'Çeki aç'}).count(),0);
     assert.equal(await card.getByRole('button',{name:'Ödənişi təsdiqlə'}).count(),0);
     assert.deepEqual((await layout(page)).issues,[]);
     if(engine===chromium&&[390,1440].includes(width)){await card.evaluate(n=>n.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(output,'compact-order-'+phase+'-'+width+'.png')});}
     await card.getByRole('button',{name:'Təhvil ver'}).click();
     const dialog=page.locator('dialog[data-payment-delivery-dialog]');
     await dialog.waitFor();await dialog.getByLabel('Müştəriyə təqdim ediləcək hazır mesaj').fill('Sintetik mətn');
     if(mobile)await page.setViewportSize({width,height:420});
     const send=dialog.getByRole('button',{name:'Göndər və təhvil ver'});await send.scrollIntoViewIfNeeded();
     assert((await send.boundingBox()).y<(mobile?420:860));
     await dialog.getByRole('button',{name:'Bağla'}).click();
     await page.setViewportSize({width,height:860});
   }
   await verifyAssets();
   const auditViews=[];
   if(audit&&width<600){
    const views=await page.locator('.nav .navBtn').evaluateAll(ns=>ns.map(n=>[n.dataset.view,n.getAttribute('href')]));
    for(const [v,href] of views){
     if(v){await open(v);await page.waitForTimeout(100);auditViews.push({view:v,...await layout(page)});}
     else if(href?.startsWith('/admin/')){
      await page.goto(origin+href);await page.waitForTimeout(120);auditViews.push({view:href,...await layout(page)});await page.goto(origin+'/admin.html');await page.locator(viewSelector('communityUsers')).waitFor({state:'attached'});
     }
    }
   }
   console.log(JSON.stringify({phase,engine:engine.name(),width,usersLayout,ordersLayout,auditViews}));
  }finally{await browser.close();}
 }
}finally{await new Promise(r=>server.close(r));}
