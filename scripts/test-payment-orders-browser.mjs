import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = process.env.MIRPANEL_NODE_MODULES;
const browserPath = process.env.MIRPANEL_BROWSER_PATH;
if (!nodeModules || !browserPath) throw new Error("Browser test runtime paths are required.");
const { chromium } = await import(pathToFileURL(path.join(nodeModules, "playwright", "index.mjs")));
const fixture = spawn(process.execPath, [path.join(root, "scripts/payment-orders-browser-fixture.mjs")], { cwd: root, env: { ...process.env, PORT: "10081" }, stdio: ["ignore", "pipe", "pipe"] });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Fixture başlamadı")), 10000);
  fixture.stdout.on("data", (chunk) => { if (String(chunk).includes("Payment orders fixture")) { clearTimeout(timer); resolve(); } });
  fixture.once("exit", (code) => reject(new Error(`Fixture dayandı: ${code}`)));
});

const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const errors = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width < 500 ? 844 : 900 } });
    page.on("pageerror", (error) => errors.push(`${width}: ${error.message}`));
    await page.goto("http://127.0.0.1:10081", { waitUntil: "networkidle" });
    await page.click('.navBtn[data-view="paymentOrders"]');
    await page.waitForSelector(".paymentOrderAdminCard");
    const audit = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      tabs: [...document.querySelectorAll("[data-payment-order-tab]")].map((item) => item.dataset.paymentOrderTab),
      pendingCards: document.querySelectorAll(".paymentOrderAdminCard").length,
      noteFields: document.querySelectorAll("textarea[data-payment-order-note]").length,
      monthlyHidden: document.querySelector("#paymentMonthlyReports")?.hidden
    }));
    assert.ok(audit.overflow <= 0, `${width}px üfüqi daşma: ${audit.overflow}`);
    assert.deepEqual(audit.tabs, ["pending", "today", "all", "expiring"]);
    assert.equal(audit.pendingCards, 2);
    assert.equal(audit.noteFields, 0);
    assert.equal(audit.monthlyHidden, true);
    await page.click('.navBtn[data-view="paymentCosts"]');
    await page.waitForSelector(".paymentCostRow");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, `${width}px maya bölməsində üfüqi daşma var`);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:10081", { waitUntil: "networkidle" });
  await page.click('.navBtn[data-view="paymentOrders"]');
  await page.waitForSelector(".paymentOrderAdminCard");
  await page.locator("[data-approve-payment]").first().click();
  await page.locator('.paymentActionDialog button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll(".paymentOrderAdminCard").length === 1);
  await page.locator("[data-reject-payment]").first().click();
  await page.locator('.paymentActionDialog button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll(".paymentOrderAdminCard").length === 0);
  await page.click('[data-payment-order-tab="all"]');
  await page.waitForFunction(() => document.querySelectorAll(".paymentOrderAdminCard").length === 20);
  await page.waitForFunction(() => !document.getElementById("paymentMonthlyReports").hidden);
  await page.waitForFunction(() => document.querySelector("#paymentCurrentMonthReport")?.textContent.includes("Ümumi satış"));
  assert.match(await page.textContent("#paymentCurrentMonthReport"), /31\.96/);
  assert.equal(await page.locator("#paymentCurrentMonthDetails").getAttribute("open"), null);
  assert.equal(await page.locator("#paymentMonthlyArchivePanel").getAttribute("open"), null);
  await page.click("#paymentMonthlyArchivePanel > summary");
  assert.match(await page.textContent("#paymentMonthlyArchiveReport"), /180\.00/);
  assert.ok(await page.locator(".paymentOrderDay").count() >= 1, "Tamamlanmış sifarişlər gün üzrə accordion-da qruplaşmalıdır");
  assert.match(await page.textContent("#paymentOrdersPageInfo"), /1 \/ 2/);
  await page.click("#paymentOrdersNext");
  await page.waitForFunction(() => document.querySelectorAll(".paymentOrderAdminCard").length === 7);
  await page.click('[data-payment-order-tab="today"]');
  await page.waitForFunction(() => document.querySelectorAll(".paymentOrderAdminCard").length === 3);
  assert.equal(await page.locator("#paymentMonthlyReports").isHidden(), true);
  await page.selectOption("#paymentOrderPeriod", "custom");
  assert.equal(await page.locator(".paymentCustomDate.isActive").count(), 2);
  await page.click('[data-payment-order-tab="expiring"]');
  await page.waitForFunction(() => document.querySelectorAll(".paymentOrderAdminCard").length === 2);
  await page.locator("[data-contacted-payment]").first().click();
  await page.locator('.paymentActionDialog button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll(".paymentOrderAdminCard").length === 1);

  await page.evaluate(() => { document.querySelector('.navBtn[data-view="paymentMethods"]').click(); document.getElementById("paymentMethodsView").classList.remove("hidden"); });
  await page.waitForFunction(() => document.querySelectorAll("[data-edit-payment-method]").length === 1);
  await page.evaluate(() => document.querySelector("[data-edit-payment-method]").click());
  const numberInput = page.locator('#paymentMethodForm input[name="fullNumber"]');
  assert.equal(await numberInput.getAttribute("type"), "text");
  assert.equal(await numberInput.inputValue(), "");
  await numberInput.fill("4098584499374419");
  assert.equal(await numberInput.inputValue(), "4098 5844 9937 4419");
  await page.locator("[data-close-payment-editor]").click();
  await page.locator("[data-toggle-payment-method]").click();
  await page.waitForFunction(() => document.querySelector("[data-toggle-payment-method]")?.textContent.includes("Aktiv et"));
  await page.locator("[data-toggle-payment-method]").click();
  await page.waitForFunction(() => document.querySelector("[data-toggle-payment-method]")?.textContent.includes("Deaktiv et"));
  await page.locator("[data-delete-payment-method]").click();
  await page.locator('.paymentActionDialog button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll(".paymentMethodAdminCard").length === 0);
  assert.equal(await page.locator("[data-restore-payment-method]").count(), 0);
  await page.click('.navBtn[data-view="paymentCosts"]');
  await page.waitForSelector(".paymentCostRow");
  const missingCost = page.locator('[data-payment-cost-key="netflix:0"] [data-payment-cost-input]');
  await missingCost.fill("4,25");
  assert.equal(await page.locator("#paymentCostsSaveAll").isDisabled(), false);
  assert.match(await page.textContent('[data-payment-cost-key="netflix:0"] [data-cost-profit]'), /3\.74/);
  await page.click("#paymentCostsSaveAll");
  await page.waitForFunction(() => document.getElementById("paymentCostsStatus")?.textContent.includes("Bütün dəyişikliklər"));
  assert.equal(await missingCost.inputValue(), "4.25");
  await page.click(".paymentBackfillPanel > summary");
  await page.click("#paymentCostBackfillPreview");
  await page.waitForFunction(() => document.getElementById("paymentCostBackfillResult")?.textContent.includes("Dəqiq uyğunlaşdı"));
  assert.match(await page.textContent("#paymentCostBackfillResult"), /Uyğunlaşmadı: 1/);
  assert.equal(await page.locator("#paymentCostBackfillApply").isDisabled(), false);
  assert.equal(errors.length, 0, `Konsol xətaları: ${errors.join(" | ")}`);
  await page.close();
  console.log(JSON.stringify({ ok: true, viewports: [320, 390, 768, 1440], tabs: ["pending", "today", "all", "expiring"], monthlyReportOnlyInAll: true, pagination: "20 + 7 after isolated approval", dayGrouping: true, approveAndRejectMoveRows: true, contactedRemovesRow: true, visibleCardInput: true, profitEditor: true, backfillPreview: true, consoleErrors: 0 }, null, 2));
} finally {
  await browser.close();
  fixture.kill();
}
