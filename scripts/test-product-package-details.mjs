import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState, patchAppSource} from '../mirpanel-admin/core.mjs';

const live = process.argv.includes('--live');
const app = await fs.readFile('app.js','utf8');
const state = extractAdminState(app);
const product = state.products.find(p => p.id === 'capcut');
if (!live) {
  product.deliveryText = '2 saat';
  Object.assign(product.plans[0], {label:'1 Ay (endirimli şəxsi hesab və əlavə video redaktə imkanları)', warrantyMode:'guaranteed', warrantyDuration:27, warrantyUnit:'day'});
}
const fixtureApp = live ? app : patchAppSource(app,state);
const output = path.resolve('../../outputs/paket-melumatlari');
await fs.mkdir(output,{recursive:true});
const types = {'.page':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url,'http://localhost');
  let file = url.pathname.slice(1);
  if (file.startsWith('mehsul/') && !path.extname(file)) file += '.page';
  if (file.startsWith('community-assets/')) file = 'mirpanel-admin/community/public/'+file.slice('community-assets/'.length);
  try {
    const data = file==='app.js' ? fixtureApp : await fs.readFile(file);
    res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
if (!live) await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin = live ? 'https://mirpanel.com' : 'http://127.0.0.1:'+server.address().port;
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  for (const width of [320,390,1440]) {
    const mobile=width<768;
    const page=await browser.newPage({viewport:{width,height:mobile?900:1000},isMobile:mobile,hasTouch:mobile});
    page.setDefaultTimeout(12000);
    const quotes=[];
    let counts=[100,63,21];
    let inventoryError=false;
    if (!live) await page.route('**/*', route=>{
      const request=route.request(),url=new URL(request.url());
      if (url.pathname==='/api/payments/inventory') return route.fulfill(inventoryError ? {status:503,json:{}} : {json:{products:[{productId:product.id,scope:'plan',plans:counts.map((available,i)=>({planKey:String(i),tracked:true,available}))}]}});
      if (url.pathname==='/api/payments/shop/quote' && request.method()==='POST') {
        const items=request.postDataJSON().items.map(item=>{
          const plan=product.plans[item.planIndex];
          const unitCents=Math.round(plan.price*100);
          quotes.push({index:item.planIndex,unitCents});
          return {...item,unitCents,title:product.title,planName:plan.label,terms:'Sintetik şərtlər',termsVersion:'fixture',available:counts[item.planIndex],fields:[]};
        });
        return route.fulfill({json:{items,totalCents:items[0].unitCents}});
      }
      if (request.method()!=='GET'||url.origin!==origin) return route.abort();
      return route.continue();
    });
    await page.goto(origin+'/mehsul/capcut-pro',{waitUntil:'domcontentloaded'});
    const rows=page.locator('#pp-plans-container .pp-plan-label');
    await page.locator('.product-detail-summary').waitFor();
    if (live) {
      assert((await page.locator('link[href*="product-page.css"]').first().getAttribute('href')).includes('package-details-1'));
      await page.locator('#pp-order-btn:not([disabled])').waitFor();
    }
    for (const index of [0,2]) {
      const row=rows.nth(index);
      if (live && await row.getAttribute('aria-disabled')==='true') continue;
      await row.click();
      await row.locator('.product-detail-plan-notes').waitFor();
      const plan=product.plans[index], price=Number(plan.price).toFixed(2).replace('.',',')+' ₼';
      assert.equal(await page.locator('.product-detail-summary-prices strong').innerText(),price);
      assert.equal(await row.locator('.pp-new-price').innerText(),price);
      assert.equal(await rows.locator('.product-detail-plan-notes:visible').count(),1);
      assert.equal(await row.locator('.pp-plan-name .product-detail-best').count(),plan.bestValue?1:0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert(await row.evaluate(r=>r.querySelector('.pp-plan-name').getBoundingClientRect().right<=r.querySelector('.pp-plan-right').getBoundingClientRect().left));
      if (!live) {
        const stock=row.locator('[data-plan-stock]');
        await stock.waitFor();
        assert.equal(await stock.innerText(),counts[index]+' stokda');
        assert.equal(await row.locator('.plan-fact-delivery').innerText(),'2 saat');
        assert.equal(await row.locator('.plan-fact-warranty').count(),index===0?1:0);
        if(index===0) assert.equal(await row.locator('.plan-fact-warranty').innerText(),'27 gün zəmanət');
        assert.equal(await stock.evaluate(n=>getComputedStyle(n,'::after').animationName),'planStockShine');
        await page.emulateMedia({reducedMotion:'reduce'});
        assert.equal(await stock.evaluate(n=>getComputedStyle(n,'::after').animationName),'none');
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.locator('#cartAddProduct').click();
        const dialog=page.locator('dialog.cart-entry[open]');
        await dialog.getByText('Sintetik şərtlər').waitFor();
        assert.deepEqual(quotes.at(-1),{index,unitCents:Math.round(plan.price*100)});
        await page.keyboard.press('Escape');
        await dialog.waitFor({state:'hidden'});
      }
      if (live) {
        const expected = await page.evaluate(index=>MirpanelInventory.planState(currentProduct,index),index);
        const stock=row.locator('[data-plan-stock]');
        if(expected.tracked && plan.stockVisibility!=='hide') {
          await stock.waitFor();
          assert.equal(await stock.innerText(),expected.available+' stokda');
        }
      }
      if(width!==320){
        await page.mouse.move(0,0);
        await page.locator('.product-detail-summary').evaluate(n=>scrollBy(0,n.getBoundingClientRect().top-155));
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.screenshot({path:path.join(output,`${live?'canli':'yerli'}-${width}-${index}.png`)});
        await page.emulateMedia({reducedMotion:'no-preference'});
      }
    }
    if(!live){
      inventoryError=true;
      await page.evaluate(()=>MirpanelInventory.refresh());
      assert.equal(await rows.locator('[data-plan-stock]:visible').count(),0);
      inventoryError=false;counts=[0,0,0];
      await page.evaluate(()=>MirpanelInventory.refresh());
      assert.equal(await rows.locator('.active').count(),0);
      assert.equal(await page.locator('.product-detail-summary').innerText(),'Aktiv paket yoxdur.');
    }
    console.log(`${live?'LIVE':'LOCAL'} ${width}px: package rows, prices, inventory and metadata checked`);
    await page.close();
  }
} finally {
  await browser.close();
  if (!live) await new Promise(r=>server.close(r));
}
