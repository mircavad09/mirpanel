import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "mirpanel-admin", "public");
const playwrightPath = process.env.MIRPANEL_PLAYWRIGHT_PATH;
if (!playwrightPath) throw new Error("MIRPANEL_PLAYWRIGHT_PATH təyin edilməyib.");
const { chromium } = await import(pathToFileURL(playwrightPath));
const originalState = extractAdminState(fs.readFileSync(path.join(root, "app.js"), "utf8"));
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

const server = http.createServer(async (request, response) => {
  if (request.url === "/favicon.ico") { response.writeHead(204); return response.end(); }
  if (request.url === "/api/admin/state") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ data: originalState, sha: "local-test-sha", csrfToken: "test", loadedAt: new Date().toISOString() }));
  }
  if (request.url === "/api/admin/preview" && request.method === "POST") {
    for await (const _chunk of request) { /* consume request safely */ }
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ previewDigest: "local-preview", productCount: 30, activeProductCount: 21, pageCount: 26, warnings: [] }));
  }
  if (request.url === "/api/admin/save" && request.method === "POST") {
    for await (const _chunk of request) { /* consume request safely */ }
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ error: "Sınaq publish xətası" }));
  }
  if (request.url?.startsWith("/api/")) {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ items: [] }));
  }
  const requested = request.url === "/" ? "/admin.html" : request.url.split("?")[0];
  const file = path.resolve(publicDir, `.${requested}`);
  if (!file.startsWith(publicDir) || !fs.existsSync(file)) { response.writeHead(404); return response.end("Not found"); }
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
  response.end(fs.readFileSync(file));
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
  await page.getByText("Əsas idarəetmə", { exact: true }).waitFor();
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
  await page.locator("#modalConfirm").click();
  await page.getByText("Sınaq publish xətası", { exact: true }).waitFor();
  await page.locator("#modalCancel").click();
  assert.equal(await kicker.inputValue(), `${originalKicker} sınaq`, "Publish xətasında admin state-i itdi");
  assert.ok((await page.locator("#changeStatus").innerText()).includes("Yadda saxlanmamış"));
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
  console.log(`PASS: real admin brauzer testi, publish failure state, UTF-8 və responsive görünüş. Screenshots: ${screenshotDir}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
