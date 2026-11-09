import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractAdminState} from '../mirpanel-admin/core.mjs';

const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT || 'playwright');
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_CHROME});
const live=Boolean(process.env.MIRPANEL_ORDER_COPY_ORIGIN);
const origin=process.env.MIRPANEL_ORDER_COPY_ORIGIN || 'http://mirpanel.test';
const publicDir=new URL('../mirpanel-admin/public/',import.meta.url);
const state=extractAdminState(await readFile(new URL('../app.js',import.meta.url),'utf8'));
const endpoint='/api/admin/payment-orders';
const netflix=[{label:'Ad',value:'Sintetik ad'},{label:'Otaq kodu',value:'0012',sensitive:true}];
const spotify=[{label:'Hesab e-poçtu',value:'spotify@example.test'},{label:'Şifrə',value:'Test<&42',sensitive:true}];
const extra={label:'Yeni sahə',value:'Əlavə dəyər'};
const ids=Array.from({length:3},(_,i)=>'12345678-1234-4234-8234-00000000000'+(i+1));
const details=new Map([[ids[0],[netflix]],[ids[1],[spotify]],[ids[2],[[...netflix,extra],spotify]]]);
const items=[{title:'Netflix',planName:'Test',unitCents:100,quantity:1},
  {title:'Spotify',planName:'Test',unitCents:100,quantity:1}];
const orders=ids.map((id,i)=>({id,orderCode:'MP-00000'+(i+1),items:i===2?items:[items[i]],
  status:'reviewing',reservationStatus:'reviewing',amount:i===2?2:1,currency:'AZN',
  createdAt:'2026-11-09T08:00:00.000Z',auditHistory:[]}));
const types={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css'};
try {
  for (const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
    if(live) await context.addCookies([{name:'mirpanel_session',value:process.env.MIRPANEL_ORDER_COPY_SESSION,
      url:origin,httpOnly:true,secure:true,sameSite:'Strict'}]);
    await context.addInitScript(()=>{
      window.clipboardWrites=[];
      Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.clipboardWrites.push(text)}});
    });
    await context.route('**/*',async route=>{
      const u=new URL(route.request().url());
      if(u.origin!==origin)return route.abort();
      if(u.pathname===endpoint)return route.fulfill({json:{orders,permissions:{fields:true},
        counts:{pending:3},pagination:{page:1,totalPages:1,total:3}}});
      if(u.pathname.startsWith(endpoint+'/')&&u.pathname.endsWith('/details')){
        assert.equal(route.request().method(),'GET');
        const lines=details.get(u.pathname.split('/').at(-2)).map((fields,index)=>({index,fields}));
        return route.fulfill({json:{lines},headers:{'Cache-Control':'private, no-store'}});
      }
      if(live)return route.continue();
      if(u.pathname==='/api/admin/state')return route.fulfill({json:{data:state,sha:'synthetic',csrfToken:'synthetic'}});
      if(u.pathname.startsWith('/api/'))return route.fulfill({json:{items:[],settings:{},products:[],orders:[],methods:[]}});
      if(!/^\/[a-z0-9.-]+$/i.test(u.pathname))return route.fulfill({status:404});
      try {
        const body=await readFile(new URL(u.pathname.slice(1),publicDir));
        return route.fulfill({body,contentType:types[u.pathname.split('.').at(-1)]});
      } catch { return route.fulfill({status:404}); }
    });
    const page=await context.newPage();
    await page.goto(origin+'/admin.html');
    await page.waitForURL('**/admin.html#dashboard');
    if(width===390)await page.locator('.mobileMenuToggle').click();
    await page.locator('.navBtn[data-view="paymentOrders"]').click();
    const writes=[];
    for(const [i,id] of ids.entries()){
      const card=page.locator('[data-payment-order-id="'+id+'"]');
      const toggle=card.locator('[data-order-toggle]');
      if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
      const blocks=card.locator('[data-order-line-fields]');
      for(const [j,fields] of details.get(id).entries()){
        const block=blocks.nth(j);
        const button=block.getByRole('button',{name:'Müştəri məlumatlarını kopyala'});
        await button.waitFor();
        assert.equal(await block.getByRole('button').count(),1);
        assert.deepEqual(await block.locator('[data-order-field-value]').allTextContents(),fields.map(f=>f.value));
        const icon=await button.boundingBox(),bounds=await block.locator('.paymentOrderFieldValues').boundingBox();
        assert.ok(icon.x>=bounds.x+bounds.width && icon.x-(bounds.x+bounds.width)<=14 && icon.y<bounds.y+bounds.height);
        await button.click();
        writes.push(fields.map(f=>f.label+': '+f.value).join('\n'));
        assert.deepEqual(await page.evaluate(()=>window.clipboardWrites),writes);
      }
      assert.equal(await card.getByRole('button',{name:'Göstər',exact:true}).count(),0);
      await card.locator('[data-copy-order-id]').click();
      writes.push(orders[i].orderCode);
      assert.deepEqual(await page.evaluate(()=>window.clipboardWrites),writes);
      await card.locator('[data-order-toggle]').click();
      assert.equal(await card.locator('[data-order-field-value]').count(),0);
    }
    await context.close();
    console.log('PASS '+width+'px: Netflix, Spotify, per-product copying, leading zeroes, order number.');
  }
} finally { await browser.close(); }
