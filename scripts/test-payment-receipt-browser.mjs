import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = process.env.MIRPANEL_NODE_MODULES;
const browserPath = process.env.MIRPANEL_BROWSER_PATH;
if (!nodeModules || !browserPath) throw new Error("Browser test runtime paths are required.");
const { chromium } = await import(pathToFileURL(path.join(nodeModules, "playwright", "index.mjs")));
const sharp = createRequire(import.meta.url)(path.join(nodeModules, "sharp"));
const port = 10082;
const fixture = spawn(process.execPath, [path.join(root, "scripts/payment-flow-browser-fixture.mjs"), String(port)], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Fixture başlamadı")), 10_000);
  fixture.stdout.on("data", (chunk) => { if (String(chunk).includes("payment fixture")) { clearTimeout(timer); resolve(); } });
  fixture.once("exit", (code) => reject(new Error(`Fixture dayandı: ${code}`)));
});

const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const image = sharp({create:{width:10,height:10,channels:3,background:"#dddddd"}});
const jpeg = await image.clone().jpeg().toBuffer();
const additionalReceipts = [
  { name: "receipt.png", mimeType: "image/png", buffer: await image.clone().png().toBuffer() },
  { name: "receipt.webp", mimeType: "image/webp", buffer: await image.clone().webp().toBuffer() },
  { name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n%%EOF", "ascii") }
];
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "FileReader", { value: undefined, configurable: true });
    globalThis.__receiptUrls = { created: 0, revoked: 0 };
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (...args) => { globalThis.__receiptUrls.created += 1; return create(...args); };
    URL.revokeObjectURL = (...args) => { globalThis.__receiptUrls.revoked += 1; return revoke(...args); };
  });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.click("[data-payment-method]");
  await page.waitForSelector("#paymentReceiptInput", {state:"attached"});
  await page.reload({waitUntil:"networkidle"});
  await page.waitForSelector("#paymentReceiptInput", {state:"attached"});
  assert.equal(await page.locator("[data-payment-method]").count(),0,"Reload must resume without reserving again");
  await page.setInputFiles("#paymentReceiptInput", { name: "camera-receipt.jpg", mimeType: "image/jpeg", buffer: jpeg });
  assert.match(await page.getAttribute("#paymentReceiptPreview img", "src"), /^blob:/);
  await page.evaluate(() => { document.getElementById("paymentSubmit").click(); document.getElementById("paymentSubmit").click(); });
  await page.waitForFunction(() => window.__paymentOrder?.orderCode === "971");
  const state = await (await fetch(`http://127.0.0.1:${port}/test/state`)).json();
  assert.equal(state.orderCalls, 1);
  assert.equal(state.reservationCalls, 1);
  assert.match(state.lastUpload.contentType, /^multipart\/form-data; boundary=/i);
  assert.match(state.lastUpload.idempotencyKey, /^[0-9a-f-]{36}$/);
  assert.equal(state.lastUpload.receiptType, "image/jpeg");
  assert.equal(state.lastUpload.receiptSize, jpeg.length);
  assert.equal(state.lastUpload.productId, "test");
  assert.equal(await page.evaluate(() => globalThis.FileReader), undefined);
  assert.deepEqual(await page.evaluate(() => globalThis.__receiptUrls), { created: 1, revoked: 1 });
  await page.reload({waitUntil:"networkidle"});
  await page.waitForFunction(() => window.__paymentOrder?.orderCode === "971");
  assert.equal((await (await fetch(`http://127.0.0.1:${port}/test/state`)).json()).orderCalls,1);
  assert.equal(errors.length, 0, `Konsol xətaları: ${errors.join(" | ")}`);

  for (const receipt of additionalReceipts) {
    const formatPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    formatPage.on("pageerror", (error) => errors.push(`${receipt.mimeType}: ${error.message}`));
    await formatPage.addInitScript(() => Object.defineProperty(globalThis, "FileReader", { value: undefined, configurable: true }));
    await formatPage.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    await formatPage.click("[data-payment-method]");
    await formatPage.setInputFiles("#paymentReceiptInput", receipt);
    await formatPage.click("#paymentSubmit");
    await formatPage.waitForFunction(() => /^\d+$/.test(window.__paymentOrder?.orderCode || ""));
    const formatState = await (await fetch(`http://127.0.0.1:${port}/test/state`)).json();
    assert.equal(formatState.lastUpload.receiptType, receipt.mimeType);
    assert.equal(formatState.lastUpload.receiptSize, receipt.buffer.length);
    await formatPage.close();
  }

  const retryPage = await browser.newPage({ viewport: { width: 320, height: 568 } });
  retryPage.on("pageerror", (error) => errors.push(error.message));
  await retryPage.addInitScript(() => Object.defineProperty(globalThis, "FileReader", { value: undefined, configurable: true }));
  await retryPage.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await retryPage.click("[data-payment-method]");
  await retryPage.setInputFiles("#paymentReceiptInput", { name: "retry.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await fetch(`http://127.0.0.1:${port}/test/fail-next-order`, { method: "POST" });
  await retryPage.click("#paymentSubmit");
  await retryPage.waitForFunction(() => !document.getElementById("paymentReceiptError").hidden);
  assert.equal(await retryPage.textContent("#paymentReceiptError"), "Sınaq upload xətası");
  assert.equal(await retryPage.textContent("#paymentSubmit"), "Yenidən cəhd et");
  assert.equal(await retryPage.locator("#paymentReceiptPreview img").count(), 1, "Xətadan sonra seçilmiş çek qorunmalıdır");
  await retryPage.click("#paymentSubmit");
  await retryPage.waitForFunction(() => /^\d+$/.test(window.__paymentOrder?.orderCode || ""));
  const retryState = await (await fetch(`http://127.0.0.1:${port}/test/state`)).json();
  assert.equal(retryState.orderCalls, 7);
  assert.equal(new Set(retryState.keys.slice(-3)).size,1,"Automatic and manual retries keep the same key");
  assert.equal(retryState.uniqueOrders,5);
  assert.equal(retryState.completedUses,0,"Uploading never confirms a payment");
  assert.equal(retryState.reservationCalls, 5, "Retry əlavə rezerv yaratmamalıdır");

  const boundaryPage = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await boundaryPage.addInitScript(() => Object.defineProperty(globalThis, "FileReader", { value: undefined, configurable: true }));
  await boundaryPage.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await boundaryPage.click("[data-payment-method]");
  await boundaryPage.setInputFiles("#paymentReceiptInput", { name: "limit.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(5 * 1024 * 1024) });
  assert.equal(await boundaryPage.isEnabled("#paymentSubmit"), true, "5 MB sərhədi qəbul edilməlidir");
  await boundaryPage.setInputFiles("#paymentReceiptInput", { name: "too-large.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  assert.equal(await boundaryPage.isEnabled("#paymentSubmit"), false, "5 MB-dan böyük fayl bloklanmalıdır");
  assert.match(await boundaryPage.textContent("#paymentReceiptError"), /maksimum 5 MB/);
  await boundaryPage.setInputFiles("#paymentReceiptInput", { name: "fake.html", mimeType: "text/html", buffer: Buffer.from("<script>alert(1)</script>") });
  assert.equal(await boundaryPage.isEnabled("#paymentSubmit"), false, "İcazəsiz MIME brauzerdə bloklanmalıdır");
  assert.match(await boundaryPage.textContent("#paymentReceiptError"), /Yalnız JPG, PNG, WEBP və PDF/);
  await boundaryPage.setInputFiles("#paymentReceiptInput",{name:"damaged.jpg",mimeType:"image/jpeg",buffer:Buffer.from("not an image")});
  await boundaryPage.click("#paymentSubmit");
  await boundaryPage.waitForFunction(() => !document.getElementById("paymentReceiptError").hidden);
  assert.match(await boundaryPage.textContent("#paymentReceiptError"), /real format/);
  for (const width of [320,390,768,1440]) {
    await boundaryPage.setViewportSize({width,height:900});
    assert.ok(await boundaryPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`overflow ${width}`);
  }
  for (const mode of ["offline", "timeout"]) {
    const networkPage = await browser.newPage({viewport:{width:390,height:844}});
    networkPage.on("pageerror",error=>errors.push(error.message));
    if(mode === "timeout") await networkPage.addInitScript(()=>{
      const Base=XMLHttpRequest;
      window.XMLHttpRequest=class extends Base {
        set timeout(value){super.timeout=value===60000?100:value}
        get timeout(){return super.timeout}
      };
    });
    await networkPage.goto(`http://127.0.0.1:${port}`,{waitUntil:"networkidle"});
    await networkPage.click("[data-payment-method]");
    await networkPage.setInputFiles("#paymentReceiptInput",{name:"network.jpg",mimeType:"image/jpeg",buffer:jpeg});
    const before=await (await fetch(`http://127.0.0.1:${port}/test/state`)).json();
    if(mode==="offline") await networkPage.context().setOffline(true);
    else await networkPage.route("**/api/payments/orders",async route=>{
      await new Promise(resolve=>setTimeout(resolve,300));await route.abort().catch(()=>{});
    });
    await networkPage.click("#paymentSubmit");
    await networkPage.waitForFunction(()=>!document.getElementById("paymentReceiptError").hidden);
    assert.equal(await networkPage.isEnabled("#paymentSubmit"),true);
    assert.equal(await networkPage.locator("#paymentReceiptPreview img").count(),1);
    assert.equal((await (await fetch(`http://127.0.0.1:${port}/test/state`)).json()).uniqueOrders,before.uniqueOrders);
    if(mode==="offline") await networkPage.context().setOffline(false);
    else await networkPage.unroute("**/api/payments/orders");
    await networkPage.click("#paymentSubmit");
    await networkPage.waitForFunction(()=>/^\d+$/.test(window.__paymentOrder?.orderCode||""));
    const after=await (await fetch(`http://127.0.0.1:${port}/test/state`)).json();
    assert.equal(after.uniqueOrders,before.uniqueOrders+1);assert.equal(after.reservationCalls,before.reservationCalls);
    await networkPage.close();
  }
  assert.equal(errors.length, 0, `Konsol xətaları: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, fileReaderUndefined: true, multipart: true, receiptTypes: ["JPG", "PNG", "WEBP", "PDF"], fiveMegabyteBoundary: true, fakeMimeBlocked: true, retryPreservesReceipt: true, offlineRetry:true, timeoutRetry:true, refreshRecovery:true, duplicateOrders: 0, objectUrlsRevoked: true, viewports: [320, 390, 768, 1440], consoleErrors: 0 }, null, 2));
} finally {
  await browser.close();
  fixture.kill();
}
