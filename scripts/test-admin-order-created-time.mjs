import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import {extractAdminState} from '../mirpanel-admin/core.mjs';

const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT || 'playwright');
const live=process.argv.includes('--live');
const origin=live?'https://mirpanel.onrender.com':'http://mirpanel.test';
const endpoint='/api/admin/payment-orders';
const publicDir=new URL('../mirpanel-admin/public/',import.meta.url);
const output=path.resolve('../../outputs/sifaris-vaxti');
await mkdir(output,{recursive:true});
const state=extractAdminState(await readFile(new URL('../app.js',import.meta.url),'utf8'));
const created='2026-11-09T17:39:01.000Z';
const fixture={id:'fixture-order',orderCode:'12662',status:'reviewing',productTitle:'Sintetik paket',amount:5.99,currency:'AZN',createdAt:created};
const completed={...fixture,id:'completed-order',orderCode:'12663',status:'completed',paymentConfirmed:true,createdAt:'2026-11-09T20:02:10.000Z',approvedAt:'2026-11-10T02:00:00.000Z',completedAt:'2026-11-10T05:00:00.000Z'};
const missing={...fixture,id:'missing-date',orderCode:'12664',createdAt:null,approvedAt:completed.approvedAt};
const malformed={...fixture,id:'invalid-date',orderCode:'12665',createdAt:'invalid'};
const types={html:'text/html; charset=utf-8',js:'text/javascript',mjs:'text/javascript',css:'text/css'};

let cookie='',csrf='';
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_CHROME});
try {
  if(live){
    const key=(await readFile(path.join(process.env.USERPROFILE,'.render/cli.yaml'),'utf8')).match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
    const response=await fetch('https://api.render.com/v1/services/srv-d8ead74m0tmc73emhsvg/env-vars?limit=100',{headers:{Authorization:'Bearer '+key}});
    assert.equal(response.status,200,'Render environment lookup');
    const values=Object.fromEntries((await response.json()).map(({envVar})=>[envVar.key,envVar.value]));
    assert(values.ADMIN_USERNAME&&values.ADMIN_PASSWORD,'Admin login config');
    const login=await fetch(origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({username:values.ADMIN_USERNAME,password:values.ADMIN_PASSWORD})});
    assert.equal(login.status,200,'Admin login');
    cookie=login.headers.get('set-cookie').split(';')[0];
    const session=await fetch(origin+'/api/session',{headers:{Cookie:cookie}});
    csrf=(await session.json()).csrfToken;
  }
  for(const width of [320,390,1440]){
    const context=await browser.newContext({viewport:{width,height:940},isMobile:width<650,hasTouch:width<650,timezoneId:'America/New_York'});
    if(live)await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:origin,httpOnly:true,secure:true,sameSite:'Strict'}]);
    const batches=new Map();
    await context.route('**/*',async route=>{
      const req=route.request(),u=new URL(req.url());
      if(u.origin!==origin||req.method()!=='GET')return route.abort();
      if(u.pathname===endpoint){
        const tab=u.searchParams.get('tab')||'pending';
        if(live){
          const response=await route.fetch();
          if(response.ok())batches.set(tab,(await response.json()).orders||[]);
          return route.fulfill({response});
        }
        const orders=tab==='pending'?[fixture,missing,malformed]:[completed];
        batches.set(tab,orders);
        return route.fulfill({json:{orders,permissions:{fields:false},counts:{pending:3,today:1,all:1},pagination:{page:1,totalPages:1,total:orders.length}}});
      }
      if(live)return route.continue();
      if(u.pathname==='/api/admin/state')return route.fulfill({json:{data:state,sha:'synthetic',csrfToken:'synthetic'}});
      if(u.pathname.startsWith('/api/'))return route.fulfill({json:{items:[],settings:{},products:[],orders:[],methods:[]}});
      if(!/^\/[a-z0-9.-]+$/i.test(u.pathname))return route.fulfill({status:404});
      try{return route.fulfill({body:await readFile(new URL(u.pathname.slice(1),publicDir)),contentType:types[u.pathname.split('.').at(-1)]});}
      catch{return route.fulfill({status:404});}
    });
    const page=await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(origin+'/admin.html');
    await page.waitForURL('**/admin.html#dashboard');
    if(live){
      assert.equal(await page.locator('script[src="payment-admin.js?v=order-created-time-1"]').count(),1);
      for(const asset of ['payment-admin.js','admin.css']){
        const response=await page.request.get(origin+'/'+asset+'?v=order-created-time-1');
        assert.equal(response.status(),200);
        assert.equal((await response.text()).replaceAll('\r\n','\n'),(await readFile(new URL(asset,publicDir),'utf8')).replaceAll('\r\n','\n'));
      }
    }
    if(width<650)await page.locator('.mobileMenuToggle').click();
    await page.locator('.navBtn[data-view="paymentOrders"]').click();
    for(const tab of ['pending','all']){
      if(tab==='all')await page.locator('[data-payment-order-tab="all"]').click();
      await page.waitForFunction(()=>document.querySelector('[data-payment-order-tab].active')||document.querySelector('[data-payment-order-id]'));
      await page.locator('[data-payment-order-id]').first().waitFor();
      const orders=batches.get(tab);
      assert(orders?.length,tab+' orders available');
      const order=tab==='all' ? orders.find(o=>o.createdAt && (o.completedAt||o.approvedAt) && Date.parse(o.createdAt)!==Date.parse(o.completedAt||o.approvedAt)) : orders.find(o=>o.createdAt);
      assert(order,tab+' order available for comparison');
      const card=page.locator('[data-payment-order-id="'+order.id+'"]');
      const toggle=card.locator('[data-order-toggle]'),time=card.locator('time.paymentOrderCreatedAt');
      const expected=live ? new Date(order.createdAt).toLocaleString('en-GB',{timeZone:'Asia/Baku',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).replaceAll('/','.') : tab==='pending'?'09.11.2026, 21:39':'10.11.2026, 00:02';
      for(const expanded of ['false','true']){
        if(await toggle.getAttribute('aria-expanded')!==expanded)await toggle.click();
        assert.equal(await toggle.getAttribute('aria-expanded'),expanded);
        assert.equal(await time.innerText(),expected);
        assert.equal(await time.getAttribute('datetime'),new Date(order.createdAt).toISOString());
        assert(await time.evaluate(n=>{
          const r=n.getBoundingClientRect(),p=n.previousElementSibling.getBoundingClientRect(),box=n.closest('[data-order-toggle]').getBoundingClientRect();
          return r.width>0&&r.right<=box.right&&n.querySelector('svg')&&(r.top>=p.bottom||r.left>=p.right);
        }));
        if(width!==320)await card.locator('.paymentOrderCardHeader').screenshot({path:path.join(output,`${live?'canli':'yerli'}-${width}-${tab}-${expanded}.png`)});
      }
    }
    if(!live){
      await page.locator('[data-payment-order-tab="pending"]').click();
      for(const id of ['missing-date','invalid-date']){
        const card=page.locator('[data-payment-order-id="'+id+'"]');
        assert.equal(await card.locator('.paymentOrderCreatedAt').innerText(),'Sifariş vaxtı məlum deyil');
        assert.equal(await card.locator('time').count(),0);
      }
    }
    console.log(`${live?'LIVE':'LOCAL'} ${width}px: creation time and layout verified on open and closed cards, including completed orders`);
    await context.close();
  }
}finally{
  await browser.close();
  if(cookie&&csrf)await fetch(origin+'/api/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':csrf}});
}
