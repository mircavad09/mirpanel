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
  if(request.url==='/api/admin/home-featured'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);const input=JSON.parse(Buffer.concat(chunks));if(input.operation==='move'){assert.deepEqual(Object.keys(input).sort(),['after','anchorId','operation','productId']);if(saveMode===500)return json({error:'Saxlama xətası'},503);await new Promise(r=>setTimeout(r,100));const ordered=[...savedData.products].sort((a,b)=>a.order-b.order),p=ordered.find(x=>x.id===input.productId),rest=ordered.filter(x=>x!==p),anchor=rest.find(x=>x.id===input.anchorId);rest.splice(anchor?rest.indexOf(anchor)+(input.after?1:0):rest.length,0,p);rest.forEach((x,i)=>x.order=i+1);savedData.products=rest;return json({orders:rest.map(x=>({id:x.id,order:x.order}))});}assert.deepEqual(Object.keys(input).sort(),['productId','selected']);if(saveMode===500)return json({error:'Saxlama xətası'},503);const p=savedData.products.find(p=>p.id===input.productId);p.bestSeller=input.selected;return json({...input,version:'saved'});
  }
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
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.MIRPANEL_BROWSER_PATH}:{})});
try{for(const width of [390,1440]){const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://mirpanel.com/**',r=>r.fulfill({status:204,body:''}));await page.goto('http://127.0.0.1:'+server.address().port+'/admin.html');await page.waitForFunction(()=>!!state.data);await page.locator('.navBtn[data-view="products"]').dispatchEvent('click');const id=await page.evaluate(()=>state.data.products[0].id);const button=page.locator('[data-feature-id="'+id+'"]');const before=await button.getAttribute('aria-pressed');await page.evaluate(id=>{state.selectedId=id;renderProductForm();state.data.products[0].desc='UNPUBLISHED DRAFT';},id);saveMode=200;await button.click();await page.waitForFunction(id=>!featuredWrites.has(id),id);assert.notEqual(await button.getAttribute('aria-pressed'),before);assert.notEqual(savedData.products[0].desc,'UNPUBLISHED DRAFT');assert.equal(await page.evaluate(()=>state.data.products[0].desc),'UNPUBLISHED DRAFT');const saved=await button.getAttribute('aria-pressed');saveMode=500;await button.click();await page.waitForFunction(id=>!featuredWrites.has(id),id);assert.equal(await button.getAttribute('aria-pressed'),saved);assert.equal(saveCalls,0);saveMode=200;const ids=await page.evaluate(()=>state.data.products.slice(0,3).map(p=>p.id));await page.evaluate(ids=>{queueProductPosition(ids[0],ids[2],true);queueProductPosition(ids[0],ids[1],false);},ids);await page.waitForFunction(()=>document.getElementById('productPositionStatus')?.textContent==='Saxlanıldı');assert.ok(savedData.products.find(p=>p.id===ids[0]).order<savedData.products.find(p=>p.id===ids[1]).order);assert.equal(await page.evaluate(()=>state.data.products.find(p=>p.desc==='UNPUBLISHED DRAFT')?.desc),'UNPUBLISHED DRAFT');assert.ok(!savedData.products.some(p=>p.desc==='UNPUBLISHED DRAFT'));saveMode=500;await page.evaluate(ids=>queueProductPosition(ids[0],ids[2],true),ids);await page.waitForFunction(()=>document.getElementById('productPositionStatus')?.textContent.startsWith('Sıra saxlanmadı'));assert.equal(saveCalls,0);await page.reload();await page.waitForFunction(()=>!!state.data);await page.locator('.navBtn[data-view="products"]').dispatchEvent('click');assert.equal(await button.getAttribute('aria-pressed'),saved);assert.deepEqual(errors.filter(e=>!e.includes('due to access control checks.')),[]);console.log('PASS admin',engine,width,'save/reload/failure/draft isolation');await page.close();}}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
