import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";
import {execFileSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "mirpanel-admin", "public");
const playwrightPath = process.env.MIRPANEL_PLAYWRIGHT_PATH;
if (!playwrightPath) throw new Error("MIRPANEL_PLAYWRIGHT_PATH təyin edilməyib.");
const { chromium } = await import(pathToFileURL(playwrightPath));
const originalState = extractAdminState(fs.readFileSync(path.join(root, "app.js"), "utf8"));
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
let bannerCount=7, renderLive=false, saveCalls=0, saveMode=500, savedData=originalState, saveReceipt;
let dashboardSummary={users:24,online:2,orders:60,pendingOrders:3,walletCents:"10505"}, pendingTopups=4;
const publication={commitSha:"a".repeat(40),sha:"b".repeat(40),version:"admin-123"};

const server = http.createServer(async (request, response) => {
  const json=(value,status=200)=>{response.writeHead(status,{"Content-Type":"application/json; charset=utf-8"});return response.end(JSON.stringify(value));};
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
  response.end(process.argv.includes('--baseline')&&requested==='/admin.js'?execFileSync('git',['show','1d18654:mirpanel-admin/public/admin.js']):fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const browser = await chromium.launch({ headless: true, executablePath: process.env.MIRPANEL_BROWSER_PATH });
const screenshotDir = process.env.MIRPANEL_SCREENSHOT_DIR || path.join(root, "test-output");
fs.mkdirSync(screenshotDir, { recursive: true });
const consoleErrors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route("https://mirpanel.com/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname.replace(/^\/+/, "");
    const localFile = path.resolve(root, pathname);
    if (localFile.startsWith(root) && fs.existsSync(localFile) && fs.statSync(localFile).isFile()) return route.fulfill({ path: localFile });
    return route.fulfill({ status: 204, body: "" });
  });
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/admin.html`, { waitUntil: "networkidle" });
  await page.getByText("Tez istifadə olunanlar", { exact: true }).waitFor();
  const audit = [];
  for (const width of [1440,390]) {
    const check = await browser.newPage({ viewport: {width,height:900} });
    await check.clock.install();
    await check.route("https://mirpanel.com/**", route=>route.fulfill({status:204,body:""}));
    await check.goto(`http://127.0.0.1:${address.port}/admin.html`);
    const nav=check.locator(".nav .navBtn");
    await nav.filter({hasText:"Stories"}).waitFor();
    const views=await nav.evaluateAll(nodes=>nodes.map(x=>[x.dataset.view||"",x.getAttribute("href")]));
    assert.equal(views.length,26);
    assert.deepEqual(views.slice(1,10).map(([v,h])=>v||h),["products","communityUsers","communityGroup","/admin/employee-stock","paymentOrders","readyStock","communityShop","paymentCosts","paymentMethods"]);
    const banner=check.locator('.dashboardCard[data-dashboard-view="banners"] strong');
    bannerCount=7; await check.locator("[data-dashboard-refresh]").click(); await banner.getByText("7",{exact:true}).waitFor();
    const metric = name => check.locator(`[data-dashboard-card="${name}"] strong`);
    for (const [name, value] of Object.entries({users:"24",online:"2",totalOrders:"60",orders:"3",wallet:"105,05 ₼"})) {
      await metric(name).getByText(value,{exact:true}).waitFor();
    }
    assert.equal(await banner.evaluate(node => getComputedStyle(node).color),"rgb(244, 245, 246)");
    for (const card of ["orders","topups"]) assert.equal(await metric(card).evaluate(node => getComputedStyle(node).color),"rgb(244, 245, 246)");
    pendingTopups=0; await check.locator("[data-dashboard-refresh]").click(); await metric("topups").getByText("0",{exact:true}).waitFor();
    pendingTopups=null; await check.locator("[data-dashboard-refresh]").click(); await metric("topups").getByText("Məlumat alınmadı",{exact:true}).waitFor({timeout:3500});
    pendingTopups=4; await check.locator("[data-dashboard-refresh]").click(); await metric("topups").getByText("4",{exact:true}).waitFor();
    pendingTopups=null; await check.locator("[data-dashboard-refresh]").click(); await metric("topups").getByText("Məlumat alınmadı",{exact:true}).waitFor();
    assert.equal(await check.locator('.nav .navBtn[data-view="communityShop"]').getAttribute('data-pending-count'),"4");
    pendingTopups=4;
    const originalSummary=dashboardSummary;
    dashboardSummary=null;
    await check.locator("[data-dashboard-refresh]").click();
    await metric("wallet").getByText("Məlumat alınmadı",{exact:true}).waitFor();
    dashboardSummary={...originalSummary,online:0,walletCents:"0"};
    await check.locator("[data-dashboard-refresh]").click();
    await metric("wallet").getByText("0,00 ₼",{exact:true}).waitFor();
    await metric("online").getByText("0",{exact:true}).waitFor();
    dashboardSummary=originalSummary;
    dashboardSummary={...originalSummary,online:5};
    await check.clock.fastForward(31000);
    await metric("online").getByText("5",{exact:true}).waitFor();
    dashboardSummary=originalSummary;
    bannerCount=-1; await check.locator("[data-dashboard-refresh]").click(); await banner.getByText("Məlumat alınmadı",{exact:true}).waitFor();
    bannerCount=0; await check.locator("[data-dashboard-refresh]").click(); await banner.getByText("0",{exact:true}).waitFor();
    bannerCount=7;
    for (const [card, view] of Object.entries({banners:"banners",orders:"paymentOrders",topups:"communityShop",users:"communityUsers"})) {
      await check.locator(`[data-dashboard-card="${card}"]`).click();
      await check.locator(`#${view}View`).waitFor();
      assert.equal(await check.locator('#cmsDashboardCards').isVisible(),false);
      assert.equal(await check.locator(`#${view}View [data-dashboard-card]`).count(),0);
      await check.locator('.nav .navBtn[data-view="dashboard"]').click();
    }
    for(const [view,href] of views){
      if(href){const result=await check.request.get(`http://127.0.0.1:${address.port}${href}`);assert.equal(result.status(),200);continue;}
      await nav.locator(`xpath=self::*[@data-view="${view}"]`).click();
      await check.locator(`#${view}View`).waitFor();
    }
    await check.locator('.navBtn[data-view="history"]').click();
    await check.getByText("Gözlənilən versiya təsdiqlənməyib",{exact:false}).waitFor();
    assert.equal(await check.locator("[data-history-commit]").innerText(),"GitHub-a göndərilib · canlı yayım təsdiqlənməyib");
    renderLive=true;
    await check.locator("#recheckPublish").click();
    await check.locator("[data-history-commit]").getByText("Canlıda təsdiqləndi",{exact:true}).waitFor();
    renderLive=false;
    audit.push({width,sections:views.length,bannerFailure:true,topupFailure:true,realZero:true,pollRefresh:true,cardLinks:true,splitDeploy:true});
    await check.close();
  }
  console.log(JSON.stringify({adminNavigation:audit}));
  assert.equal(await page.getByRole("button", { name: "Footer", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Önizləmə və yayımlama", exact: true }).count(), 0);
  assert.equal((await page.locator("body").innerText()).includes("É™"), false, "Admin görünüşündə mojibake var");

  await page.evaluate(() => document.querySelector('.navBtn[data-view="about"]')?.click());
  const kicker = page.locator('#aboutView [data-site="haqqimizda.kicker"]');
  assert.equal(await page.locator("#aboutView").evaluate((element) => element.classList.contains("hidden")), false, "Haqqımızda menyusu görünüşü açmadı");
  const originalKicker = await kicker.inputValue();
  await kicker.fill(`${originalKicker} sınaq`);
  await page.evaluate(() => document.querySelector('.navBtn[data-view="banners"]')?.click());
  await page.evaluate(() => document.querySelector('.navBtn[data-view="about"]')?.click());
  assert.equal(await kicker.inputValue(), `${originalKicker} sınaq`, "Bölmə keçidində Haqqımızda state-i sıfırlandı");

  await page.locator("#saveBtn").click();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator("#modal").evaluate((element) => element.classList.contains("hidden")), false, `Publish modalı açılmadı: ${consoleErrors.join(" | ")} / ${await page.locator("#toasts").innerText()}`);
  await page.getByRole("heading", { name: "Dəyişiklikləri yoxlayın" }).waitFor();
  assert.ok((await page.locator("#modalBody").innerText()).includes("Haqqımızda"));
  await page.locator("#modalConfirm").evaluate(button=>{button.click();button.click();});
  await page.getByText("Sınaq publish xətası", { exact: true }).waitFor();
  await page.locator("#modalCancel").click();
  assert.equal(await kicker.inputValue(), `${originalKicker} sınaq`, "Publish xətasında admin state-i itdi");
  assert.equal(await page.locator('#changeStatus').getAttribute('data-status'),'failed');
  assert.equal(saveCalls,1,"double click must not create a second operation");
  assert.ok((await page.locator("#changeStatus").innerText()).includes("dəyişiklikləriniz qorunub"));
  await page.screenshot({ path: path.join(screenshotDir, "admin-desktop.png"), fullPage: true });

  await page.evaluate(() => document.querySelector('.navBtn[data-view="products"]')?.click());
  await page.locator('.productItem[data-id="netflix"]').click();
  assert.equal(await page.locator(".productGroup").count(), 4);
  assert.equal(await page.locator("#productOrderFlow").isDisabled(), true);
  assert.equal(await page.locator("#productOrderFlow").inputValue(), "form_confirm_whatsapp");
  await page.locator(".productGroup").nth(2).evaluate((element) => { element.open = true; });
  assert.ok((await page.locator("#formFields").innerText()).includes("Canlı önizləmə"));

  for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const offenders = overflow > 1 ? await page.evaluate(() => [...document.querySelectorAll("body *")].filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 8).map((element) => `${element.tagName}.${element.className} right=${Math.round(element.getBoundingClientRect().right)}`)) : [];
    assert.ok(overflow <= 1, `${viewport.width}px görünüşdə ${overflow}px üfüqi daşma var: ${offenders.join(", ")}`);
    if (viewport.width === 390) await page.screenshot({ path: path.join(screenshotDir, "admin-mobile-390.png"), fullPage: true });
    if (viewport.width === 320) await page.screenshot({ path: path.join(screenshotDir, "admin-mobile-320.png"), fullPage: true });
  }
  const unexpectedErrors = consoleErrors.filter((message) => !message.includes("favicon") && !message.includes("status of 500"));
  assert.deepEqual(unexpectedErrors, [], `Brauzer xətaları: ${consoleErrors.join(" | ")}`);
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.navBtn[data-view="homepage"]').click();
  const announcement=page.locator('#homepageView [data-cms="homepage.announcement.text"]');
  await announcement.fill("Sınaq ana səhifə");
  await page.locator('.navBtn[data-view="products"]').click();
  await page.locator("#productTitle").fill("Sınaq məhsul adı");
  await page.route("**/api/admin/save",async route=>{
    if(saveMode!==0&&saveMode!==202)return route.continue();
    if(saveMode===202)assert.equal((await route.fetch()).status(),200);
    await route.abort("failed");
  });
  for (const [status,message] of [[0,"Admin xidməti hazırda cavab vermir"],[401,"Sınaq sessiyası bitib"],[409,"Sınaq paralel redaktə"],[202,"Commit GitHub-a göndərildi"]]) {
    saveMode=status;
    await page.locator("#saveBtn").click();await page.locator("#modalConfirm").click();
    await page.getByText(message,{exact:false}).first().waitFor();
    await page.locator("#modalCancel").click();
    assert.equal(await page.locator("#productTitle").inputValue(),"Sınaq məhsul adı");
  }
  assert.equal(saveCalls,4,"the committed operation must not repeat after losing its response");
  await page.locator('.navBtn[data-view="homepage"]').click();
  await announcement.fill("İkinci yayım");
  await page.locator("#saveBtn").click();await page.locator("#modalConfirm").waitFor({state:"visible"});
  await page.locator("#modalCancel").click();
  await page.reload();
  await page.locator('#homepageView').waitFor();
  await page.locator('.navBtn[data-view="products"]').click();
  await page.locator('.productItem[data-id="netflix"]').click();
  assert.equal(await page.locator("#productTitle").inputValue(),"Sınaq məhsul adı");
  await page.locator('.navBtn[data-view="homepage"]').click();
  assert.equal(await announcement.inputValue(),"Sınaq ana səhifə");
  console.log("PASS: product and homepage save/reopen; network, expired session and conflict preserve edits; delayed release is not shown as confirmed.");
  console.log(`PASS: real admin brauzer testi, publish failure state, UTF-8 və responsive görünüş. Screenshots: ${screenshotDir}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
