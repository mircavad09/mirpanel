import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeAdminPayload, patchAppSource, extractAdminState } from "../mirpanel-admin/core.mjs";
import {execFileSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "mirpanel-admin", "public");
const playwrightPath = process.env.MIRPANEL_PLAYWRIGHT_PATH;
if (!playwrightPath) throw new Error("MIRPANEL_PLAYWRIGHT_PATH təyin edilməyib.");
const engines = await import(pathToFileURL(playwrightPath));
const engine = process.env.MIRPANEL_TEST_ENGINE || "chromium";
const originalState = extractAdminState(fs.readFileSync(path.join(root, "app.js"), "utf8"));
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
let bannerCount=7, renderLive=false, saveCalls=0, saveMode=500, savedData=structuredClone(originalState), saveReceipt;
let dashboardSummary={users:24,active30:2,orders:60,pendingOrders:3,walletCents:"10505"}, pendingTopups=4;
const publication={commitSha:"a".repeat(40),sha:"b".repeat(40),version:"admin-123"};

const server = http.createServer(async (request, response) => {
  const json=(value,status=200)=>{response.writeHead(status,{"Content-Type":"application/json; charset=utf-8"});return response.end(JSON.stringify(value));};
  if(request.url==='/api/admin/payment-inventory')return json({products:[]});
  if(request.url.includes('/api/admin/product-sales'))return json({products:[],total:0});
  if(request.url.startsWith('/community-assets/checkout-fields.js')){response.writeHead(200,{'Content-Type':'text/javascript'});return response.end(fs.readFileSync(path.join(root,'mirpanel-admin/community/public/checkout-fields.js')));}
  if(request.url.startsWith("/api/admin/save-status?"))return json(saveReceipt?{publication:saveReceipt}:{pending:false});
  if(request.url==="/api/admin/history?latest")return json({publication});
  if(request.url==="/api/admin/history")return json({items:[{sha:publication.commitSha,date:"2026-11-07T00:00:00Z",message:"Sınaq yayımı"}]});
  if(request.url.startsWith("/api/admin/deploy-status?")){
    const q=new URL(request.url,"http://localhost").searchParams;
    assert.equal(q.get("appSha"),publication.sha);assert.equal(q.get("commit"),publication.commitSha);assert.equal(q.get("version"),publication.version);
    return json({cloudflare:{live:true},render:{live:renderLive,commit:renderLive?publication.commitSha:"c".repeat(40)}});
  }
  if(request.url==="/api/admin/homepage-banners")return bannerCount<0?json({error:"Sınaq sorğusu alınmadı"},503):json({managed:true,banners:Array.from({length:bannerCount},(_,i)=>({active:true,id:String(i),order:i})),maxBytes:20*1024*1024});
  if(request.url.startsWith("/api/admin/payment-orders?"))return json({orders:[],counts:{pending:3},pagination:{total:0,totalPages:1}});
  if(request.url==="/api/admin/community/dashboard")return dashboardSummary ? json(dashboardSummary) : json({error:"Məlumat alınmadı"},503);
  if(request.url==="/api/admin/community/shop?only=topup-count")return pendingTopups===null ? json({error:"Məlumat alınmadı"},503) : json({pending:pendingTopups});
  if(request.url==="/api/admin/stories")return json({stories:[],activeStories:0,activeItems:0});
  if (request.url === "/favicon.ico") { response.writeHead(204); return response.end(); }
  if (request.url === "/api/admin/state") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ data: savedData, sha: "local-test-sha", csrfToken: "test", loadedAt: new Date().toISOString() }));
  }
  if (request.url === "/api/admin/preview" && request.method === "POST") {
    for await (const _chunk of request) { /* consume request safely */ }
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ previewDigest: "local-preview", productCount: 30, activeProductCount: 21, pageCount: 26, warnings: [] }));
  }
  if (request.url === "/api/admin/save" && request.method === "POST") {
    saveCalls++;
    const chunks=[];for await (const chunk of request) chunks.push(chunk);
    if(saveMode===200||saveMode===202){
      savedData=JSON.parse(Buffer.concat(chunks)).data;saveReceipt={...publication,committedAt:new Date().toISOString()};
      return json(saveReceipt);
    }
    if(saveMode===0){response.destroy();return;}
    return json({error:saveMode===401?"Sınaq sessiyası bitib":saveMode===409?"Sınaq paralel redaktə":"Sınaq publish xətası"},saveMode);
  }
  if (request.url?.startsWith("/api/")) {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ items: [] }));
  }
  const requested = ({"/":"/admin.html","/admin/employee-stock":"/manual-stock-admin.html","/admin/workforce":"/workforce-admin.html"})[request.url] || request.url.split("?")[0];
  const file = path.resolve(publicDir, `.${requested}`);
  if (!file.startsWith(publicDir) || !fs.existsSync(file)) { response.writeHead(404); return response.end("Not found"); }
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
  response.end(process.argv.includes('--baseline')&&requested==='/admin.js'?execFileSync('git',['show','1d18654:mirpanel-admin/public/admin.js']):fs.readFileSync(file,requested==='/admin.html'?'utf8':undefined).toString().replace('</head>','<script src="/admin-draft.js"></script></head>'));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const browser = await engines[engine].launch({ headless: true, ...(engine === "chromium" ? {executablePath: process.env.MIRPANEL_BROWSER_PATH} : {}) });
const screenshotDir = process.env.MIRPANEL_SCREENSHOT_DIR || path.join(root, "test-output");
fs.mkdirSync(screenshotDir, { recursive: true });
const consoleErrors = [];


try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://mirpanel.com/**', async route=>{
    const file=path.join(root,new URL(route.request().url()).pathname);
    return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:204,body:''});
  });
  await page.goto(`http://127.0.0.1:${address.port}/admin.html`);
  await page.locator('.navBtn[data-view="products"]').click();
  await page.waitForFunction(()=>Boolean(state.data));
  const ids=await page.evaluate(()=>['prime','spotify','pubg_mobile'].map(id=>state.data.products.find(p=>p.id===id)?.id).filter(Boolean));
  assert.equal(ids.length,3);
  const before=await page.evaluate(()=>structuredClone(state.data));
  for (const width of [1440,390]){ await page.setViewportSize({width,height:1000});
  for (const id of ids){
    await page.evaluate(id=>{state.selectedId=id;renderProductForm();},id);
    assert.equal(await page.locator('.productEditorNav [aria-pressed="true"]').innerText(),'Əsas məlumatlar');
    assert.equal(await page.locator('.productFormGroups > .productGroup:visible').count(),1);
    const description=await page.locator('#productDesc').inputValue();
    await page.locator('#productDesc').fill(description+' — saxlanmamış sınaq');
    for(const name of ['Qiymət və paketlər','Sifariş təsdiqi','Müştəridən alınan məlumatlar','Əsas məlumatlar']){
      await page.locator('.productEditorNav').getByRole('button',{name,exact:true}).click();
      assert.equal(await page.locator('.productFormGroups > .productGroup:visible').count(),1);
      assert.equal(await page.locator('.productEditorNav [aria-pressed="true"]').innerText(),name);
      assert.equal(await page.locator('#productDesc').inputValue(),description+' — saxlanmamış sınaq');
      for(const selector of ['.editorHero','#productActive','#saveProductDraft','#publishProduct'])assert(await page.locator(selector).isVisible());
    }
    await page.locator('#productDesc').fill(description);
    await page.locator('.productEditorNav').getByRole('button',{name:'Hamısı',exact:true}).click();
    assert.equal(await page.locator('.productFormGroups > .productGroup:visible').count(),4);
    await page.locator('.productEditorNav button').nth(1).click();
    const pkg=page.locator('#plans .planRow').first();await pkg.locator(':scope>summary').click();
    const price=pkg.locator('[data-field="price"]');const value=await price.inputValue();await price.fill('12.34');await price.fill(value);
    await page.locator('.productEditorNav button').nth(2).click();
    const confirmation=page.locator('#orderConfirmationEnabled'),enabled=await confirmation.isChecked();
    await confirmation.setChecked(!enabled);assert.equal(await page.locator('#orderConfirmationDescription').isDisabled(),enabled);
    await confirmation.setChecked(enabled);
    await page.locator('.productEditorNav button').nth(3).click();
    await page.locator('#formFieldScope').selectOption('0');
    await page.locator('#formFieldScope').selectOption('product');
    assert.equal(await page.locator('#productVariant').isVisible(),false);
    assert.equal(await page.locator('#productNote').isVisible(),false);
    assert.equal(await page.locator('#productBadge').isVisible(),false);
    await page.locator('#saveProductDraft').click();
    assert.equal(await page.evaluate(async()=>Boolean((await MirpanelAdminDraft.read())?.data.products.length)),true);
  }
  }
  // Roundtrip preserves every hidden value, package identity and stock linkage.
  const after=await page.evaluate(()=>structuredClone(state.data));
  for(const id of ids){const a=before.products.find(p=>p.id===id),b=after.products.find(p=>p.id===id);
    for(const key of ['variant','badge','note','flow','seoSlug','whatsapp','plans','image','stock','stockEnabled'])assert.deepEqual(b[key],a[key],id+':'+key);
  }
  const canonical=extractAdminState(patchAppSource(fs.readFileSync(path.join(root,'app.js'),'utf8'),after));
  const expected=normalizeAdminPayload(after);
  for(const id of ids)assert.deepEqual(JSON.parse(JSON.stringify(canonical.products.find(p=>p.id===id))),JSON.parse(JSON.stringify(expected.products.find(p=>p.id===id))));
  const {termsInfo}=await import('../mirpanel-admin/cart-drafts.mjs');
  const prime=canonical.products.find(p=>p.id==='prime');
  for(const enabled of [true,false]){prime.confirmationModal.enabled=enabled;prime.orderConfirmation.enabled=enabled;assert.equal(termsInfo(prime,prime.plans[0],0).confirmationEnabled,enabled);}
  await page.evaluate(()=>{state.selectedId='prime';renderProductForm();});
  await page.locator('.productEditorNav button').nth(0).click();
  await page.locator('#productOrder>summary').click();
  await page.getByRole('button',{name:'Sona yerləşdir',exact:true}).click();
  assert.equal(await page.evaluate(()=>[...state.data.products].sort((a,b)=>a.order-b.order).at(-1).id),'prime');
  await page.locator('.productEditorNav button').nth(1).click();
  await page.locator('#plans .planRow').first().evaluate(row=>row.open=true);
  page.once('dialog',d=>d.dismiss());const count=await page.locator('#plans .planRow').count();await page.locator('.removePlan').first().click();assert.equal(await page.locator('#plans .planRow').count(),count);
  // Reorder keeps package objects and their custom fields tied together.
  const originalPlans=await page.evaluate(()=>structuredClone(selectedProduct().plans));
  await page.locator('.movePlan[data-direction="1"]').first().click();
  assert.deepEqual(await page.evaluate(()=>selectedProduct().plans[1]),originalPlans[0]);
  await page.locator('#plans .planRow').nth(1).evaluate(row=>row.open=true);
  await page.locator('.movePlan[data-direction="-1"]').nth(1).click();
  assert.deepEqual(await page.evaluate(()=>selectedProduct().plans),originalPlans);
  await page.locator('.productEditorNav button').nth(3).click();
  await page.locator('#addFormFieldBtn').click();
  await page.locator('[data-form-field="label"]').first().fill('Oyunçu ID-si');
  await page.locator('[data-form-field="type"]').first().selectOption('text');
  page.once('dialog',d=>d.accept());await page.locator('#noCustomerFields').check();
  assert.equal(await page.locator('[data-form-field="enabled"]').first().isChecked(),false);
  await page.locator('#noCustomerFields').uncheck();
  assert.equal(await page.locator('[data-form-field="label"]').first().inputValue(),'Oyunçu ID-si');
  await page.waitForTimeout(300);
  await page.evaluate(()=>{document.querySelectorAll('.productGroup').forEach((g,i)=>g.open=i===0);document.querySelector('#productOrder').open=false;document.querySelector('#toasts').replaceChildren();});
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:1000});
    await page.locator('.productEditorNav button').nth(0).click();
    await page.locator('#productForm').screenshot({path:path.join(screenshotDir,'product-editor-'+width+'.png')});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);
  }
  // A native error in a hidden, collapsed package must reveal its full path.
  const priceInput=page.locator('#plans [data-field="price"]').first();
  await priceInput.evaluate(input=>input.setCustomValidity('İzolyasiya edilmiş paket xətası'));
  const callsBefore=saveCalls;
  await page.locator('#publishProduct').click();
  assert.equal(await page.locator('.productEditorNav [aria-pressed="true"]').innerText(),'Qiymət və paketlər');
  assert(await priceInput.isVisible());assert.equal(saveCalls,callsBefore);
  assert(await priceInput.evaluate(input=>document.activeElement===input));
  await priceInput.evaluate(input=>input.setCustomValidity(''));
  // A custom HTTPS error also opens its previously hidden parent.
  await page.evaluate(()=>{const c=ensureConfirmation(selectedProduct());c.enabled=true;c.helpLink={enabled:true,label:'Kömək',url:'http://example.test/help'};renderProductForm();});
  await page.locator('.productEditorNav button').nth(0).click();await page.locator('#publishProduct').click();
  assert.equal(await page.locator('.productEditorNav [aria-pressed="true"]').innerText(),'Sifariş təsdiqi');
  assert(await page.locator('#orderConfirmationHelpUrl').isVisible());assert.equal(saveCalls,callsBefore);
  await page.locator('#orderConfirmationHelpUrl').fill('https://example.test/help');
  await page.locator('#orderConfirmationDescription').fill('Gizli sifariş təsdiqi — yalnız sınaq');
  await page.locator('.productEditorNav button').nth(0).click();
  await page.locator('#productDesc').fill('Əsas məlumat — yalnız izolyasiya edilmiş sınaq');
  const hiddenExpected=await page.evaluate(()=>structuredClone(state.data));
  await page.locator('#saveProductDraft').click();
  const draft=await page.evaluate(async()=>structuredClone((await MirpanelAdminDraft.read()).data));
  assert.deepEqual(normalizeAdminPayload(draft).products,normalizeAdminPayload(hiddenExpected).products,'Draft preserves every persisted hidden field (excluding transient editor IDs)');
  saveMode=200;renderLive=true;
  await page.locator('#publishProduct').click();await page.locator('#modalConfirm').click();
  await page.waitForFunction(()=>!!state.lastPublishResult&&!state.dirty);
  assert.equal(saveCalls,callsBefore+1);
  const normalizedSaved=normalizeAdminPayload(savedData),normalizedExpected=normalizeAdminPayload(hiddenExpected);
  assert.deepEqual(normalizedSaved.products,normalizedExpected.products,'Published payload preserves hidden values and all package/stock fields');
  const roundtrip=extractAdminState(patchAppSource(fs.readFileSync(path.join(root,'app.js'),'utf8'),savedData));
  const withoutGeneratedTimestamp=products=>JSON.parse(JSON.stringify(products.map(({seoUpdatedAt,...product})=>product)));
  assert.deepEqual(withoutGeneratedTimestamp(roundtrip.products),withoutGeneratedTimestamp(normalizedExpected.products));
  assert.deepEqual(errors,[]);console.log('Product editor: source publish roundtrip, Prime terms on/off, field disable preserves values, package reorder, 3 products, hidden-data roundtrip, confirmation switch, package fields, ordering, deletion cancel, draft and 320/390/1440 passed');
}finally{await browser.close();server.close();}

