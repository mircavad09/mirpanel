import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = process.env.MIRPANEL_NODE_MODULES;
const browserPath = process.env.MIRPANEL_BROWSER_PATH;
if (!nodeModules || !browserPath) throw new Error("Browser test runtime paths are required.");
const { chromium } = await import(pathToFileURL(path.join(nodeModules, "playwright", "index.mjs")));
const port = 10082;
const fixture = spawn(process.execPath, [path.join(root, "scripts/payment-flow-browser-fixture.mjs"), String(port)], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Fixture başlamadı")), 10_000);
  fixture.stdout.on("data", (chunk) => { if (String(chunk).includes("payment fixture")) { clearTimeout(timer); resolve(); } });
  fixture.once("exit", (code) => reject(new Error(`Fixture dayandı: ${code}`)));
});

const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3, 4, 5, 6, 7]);
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
  await page.setInputFiles("#paymentReceiptInput", { name: "camera-receipt.jpg", mimeType: "image/jpeg", buffer: jpeg });
  assert.match(await page.getAttribute("#paymentReceiptPreview img", "src"), /^blob:/);
  await page.evaluate(() => document.getElementById("paymentSubmit").click());
  await page.waitForFunction(() => window.__paymentOrder?.orderCode === "MP-ABC123");
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
  assert.equal(errors.length, 0, `Konsol xətaları: ${errors.join(" | ")}`);

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
  await retryPage.waitForFunction(() => window.__paymentOrder?.orderCode === "MP-ABC123");
  const retryState = await (await fetch(`http://127.0.0.1:${port}/test/state`)).json();
  assert.equal(retryState.orderCalls, 3);
  assert.equal(retryState.reservationCalls, 2, "Retry əlavə rezerv yaratmamalıdır");
  assert.equal(errors.length, 0, `Konsol xətaları: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, fileReaderUndefined: true, multipart: true, binaryBytes: jpeg.length, retryPreservesReceipt: true, duplicateOrders: 0, objectUrlsRevoked: true, viewports: [320, 390], consoleErrors: 0 }, null, 2));
} finally {
  await browser.close();
  fixture.kill();
}
