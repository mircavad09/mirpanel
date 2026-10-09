import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";
import { activeProductsWithSlugs, generateProductPageFiles } from "../mirpanel-admin/product-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const live = process.env.MIRPANEL_TEST_LIVE === "1";
const source = live ? await (await fetch("https://mirpanel.com/app.js", { cache: "no-store" })).text() : fs.readFileSync(path.join(root, "app.js"), "utf8");
const state = extractAdminState(source);
const active = activeProductsWithSlugs(state.products);
const generated = new Map([...generateProductPageFiles(state.products, state.siteSections, state.cms, state.content)].map(([file, html]) => ["/" + file.replace(/\.page$/, ""), html]));
const { chromium } = await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES, "playwright", "index.mjs")));
const server = live ? null : http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (generated.has(pathname)) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return response.end(generated.get(pathname));
  }
  const file = path.resolve(root, "." + pathname);
  if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const type = file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".png") ? "image/png" : "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    return response.end(fs.readFileSync(file));
  }
  response.writeHead(404); response.end();
});
if (server) await new Promise(resolve => server.listen(10091, "127.0.0.1", resolve));
const origin = live ? "https://mirpanel.com" : "http://127.0.0.1:10091";
const browser = await chromium.launch({ headless: true, executablePath: process.env.MIRPANEL_BROWSER_PATH });
const errors = [], forbidden = [], checks = [];
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }];
try {
  const context = await browser.newContext();
  // No test can contact a mutation, payment API, receipt endpoint or WhatsApp.
  await context.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    // Keep the real SRI-protected beacon script, but never send analytics.
    if (url.pathname === "/cdn-cgi/rum") return route.fulfill({ status: 204 });
    if (req.method() === "GET" && url.hostname === "static.cloudflareinsights.com") return route.continue();
    if (!["GET", "HEAD"].includes(req.method()) || /\/api\/(payments|orders|receipts)|wa\.me|script\.google/.test(req.url())) {
      forbidden.push({ method: req.method(), path: url.pathname });
      return route.fulfill({ status: 403, body: "Test safety guard" });
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    if (url.origin !== origin && !/\.supabase\.co$/.test(url.hostname)) return route.fulfill({ status: 200, body: "" });
    return route.continue();
  });
  const page = await context.newPage();
  async function ready() {
    await page.waitForFunction(() => {
      const splash = document.getElementById("newSplashScreen");
      return !splash || splash.hidden || getComputedStyle(splash).display === "none";
    });
    await page.waitForTimeout(100);
  }
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", msg => { if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource:")) errors.push(msg.text()); });
  async function layout(label) {
    const metrics = await page.evaluate(() => {
      const card = document.querySelector("#modal .modalCard");
      const buttons = [...document.querySelectorAll("#mForm button")].filter(el => el.offsetParent && el.type !== "button" || el.offsetParent && /Cancel/.test(el.id));
      return { overflow: document.documentElement.scrollWidth > innerWidth, scale: visualViewport?.scale ?? 1,
        buttons: buttons.map(el => { const r = el.getBoundingClientRect(); return { id: el.id, top: r.top, bottom: r.bottom, height: r.height }; }),
        card: card && { height: card.clientHeight, scroll: card.scrollHeight, top: card.getBoundingClientRect().top, bottom: card.getBoundingClientRect().bottom },
        fonts: [...document.querySelectorAll("#universalOrderForm input:not([type=hidden])")].map(el => parseFloat(getComputedStyle(el).fontSize)) };
    });
    assert.equal(metrics.overflow, false, label + " horizontal overflow");
    for (const btn of metrics.buttons) { assert.ok(btn.top >= Math.max(0, metrics.card.top) && btn.bottom <= Math.min(page.viewportSize().height, metrics.card.bottom) + 1, `${label} ${btn.id} not visible: ${JSON.stringify(metrics)}`); }
    if (label.endsWith(" form")) assert.ok(metrics.card.scroll <= metrics.card.height + 1, label + " modal overflow: " + JSON.stringify(metrics));
    if (page.viewportSize().width < 768) for (const font of metrics.fonts) assert.ok(font >= 16, `${label} input font ${font}px`);
    return metrics;
  }
  async function open(product, planIndex = 0) {
    await page.evaluate(id => window.openProductPage(id), product.id);
    await page.waitForTimeout(20);
    await page.locator(".pp-plan-label").nth(planIndex).click();
    const button = page.locator("#pp-order-btn");
    if (product.soldOut || product.flow === "out_of_stock" || Number(product.plans[planIndex].price) <= 0) {
      assert.equal(await button.isDisabled(), true, product.id + " unavailable product");
      return false;
    }
    await button.click();
    assert.equal(await page.locator("#mTitle").textContent(), product.title.replace(/\s+almaq\s*$/i, "").trim());
    const plan = product.plans[planIndex];
    const info = await page.locator("#mInfo").textContent();
    assert.ok(info.includes(Number(plan.price).toFixed(2)), product.id + " price");
    assert.ok(info.includes(plan.label?.trim() || `${plan.months} aylıq`), product.id + " plan");
    await layout(product.id + " confirmation");
    const fields = (product.formFields || []).filter(field => field.enabled !== false);
    if (fields.length) {
      await page.check("#orderTermsAgreement"); await page.click("#orderConfirmationConfirm");
      assert.equal(await page.locator("#universalOrderForm").getAttribute("data-product-id"), product.id);
      assert.equal(await page.locator("#spotifyEmail").count(), product.id === "spotify" ? 1 : 0);
      assert.equal(await page.locator(".netflixPinDigit").count(), product.id === "netflix" ? 4 : 0);
      if (product.id !== "spotify") assert.equal(await page.locator(".spotifyPasswordReset, #spotifyPassword, #spotifyPasswordConfirm").count(), 0);
      if (product.id === "google_ai") {
        assert.equal(await page.locator('#universalOrderForm input[type="password"]').count(), 0);
        assert.equal(await page.locator('#universalOrderForm input[type="email"]').count(), 1);
        assert.doesNotMatch(await page.locator("#mForm").textContent(), /Spotify|Netflix/);
        assert.ok((await page.locator("#mForm").textContent()).includes(product.title));
      }
      const actualNames = await page.locator('#universalOrderForm input[name], #universalOrderForm select[name], #universalOrderForm textarea[name]').evaluateAll(els => els.map(el => el.name));
      for (const field of fields) if (field.key !== "password_confirm") assert.ok(actualNames.includes(field.key), product.id + " missing configured " + field.key);
      const metrics = await layout(product.id + " form");
      for (const input of await page.locator('#universalOrderForm input:not([type="hidden"])').all()) {
        const before = await page.evaluate(() => visualViewport?.scale ?? 1);
        await input.focus();
        assert.equal(await page.evaluate(() => visualViewport?.scale ?? 1), before, product.id + " focus zoom");
      }
      if (process.env.MIRPANEL_VISUAL_DIR && ["google_ai", "spotify", "netflix", "capcut"].includes(product.id) && planIndex === 0) {
        fs.mkdirSync(process.env.MIRPANEL_VISUAL_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.MIRPANEL_VISUAL_DIR, `${live ? "live" : "local"}-${product.id}-${page.viewportSize().width}.png`) });
      }
      checks.push({ product: product.id, plan: planIndex, width: page.viewportSize().width, metrics });
    } else {
      assert.equal(await page.locator("#universalOrderForm, #spotifyEmail, .netflixPinDigit").count(), 0);
      if (process.env.MIRPANEL_VISUAL_DIR && product.id === "capcut" && planIndex === 0) {
        fs.mkdirSync(process.env.MIRPANEL_VISUAL_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.MIRPANEL_VISUAL_DIR, `${live ? "live" : "local"}-capcut-${page.viewportSize().width}.png`) });
      }
      checks.push({ product: product.id, plan: planIndex, width: page.viewportSize().width, standard: true });
    }
    return true;
  }
  async function close() { await page.click("#closeModal"); assert.equal(await page.locator("#mForm input").count(), 0, "Closed modal retained inputs"); }
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(origin + "/mehsul/capcut-pro", { waitUntil: "networkidle" });
    await ready();
    const list = live ? active.filter(({ product }) => ["spotify", "google_ai", "netflix", "capcut"].includes(product.id)) : active;
    for (const { product } of list) {
      if (live) { await page.goto(origin + "/mehsul/" + product.seoSlug, { waitUntil: "networkidle" }); await ready(); }
      for (let i = 0; i < product.plans.length; i++) {
        if (product.plans[i].active === false) continue;
        if (await open(product, i)) await close();
      }
    }
    for (const id of ["spotify", "google_ai", "spotify", "google_ai"]) {
      const p = state.products.find(p => p.id === id);
      assert.equal(await open(p), true);
      if (id === "spotify") {
        await page.fill("#spotifyEmail", "invalid-email");
        await page.fill("#spotifyPassword", "test-only");
        await page.fill("#spotifyPasswordConfirm", "test-only");
        assert.equal(await page.locator("#spotifyContinueButton").isDisabled(), true);
        await page.fill("#spotifyEmail", "isolated@example.com");
        await page.fill("#spotifyPassword", "test-only");
        await page.fill("#spotifyPasswordConfirm", "different");
        assert.equal(await page.locator("#spotifyContinueButton").isDisabled(), true);
        assert.equal(await page.locator("#spotifyPasswordError").isVisible(), true);
        await page.fill("#spotifyPasswordConfirm", "test-only");
        assert.equal(await page.locator("#spotifyContinueButton").isEnabled(), true);
        for (const id of ["spotifyPassword", "spotifyPasswordConfirm"]) {
          await page.locator(`[data-password-toggle="${id}"]`).click();
          assert.equal(await page.locator("#" + id).getAttribute("type"), "text");
          await page.locator(`[data-password-toggle="${id}"]`).click();
          assert.equal(await page.locator("#" + id).getAttribute("type"), "password");
        }
        assert.equal(await page.locator(".spotifyPasswordReset a").getAttribute("href"), spotifyResetUrl());
      }
      await close();
    }
  }
  function spotifyResetUrl() { return state.products.find(p => p.id === "spotify").spotifyPasswordResetUrl || "https://accounts.spotify.com/az/password-reset"; }
  if (!live) {
    // A misleading legacy flow/title is never a special-form selector.
    const unknown = { id: "unknown_order_fixture", title: "Spotify HBO test", flow: "spotify", active: true, formFields: [], plans: [{ months: 1, price: 1 }] };
    await page.evaluate(p => DATA.products.push(p), unknown);
    assert.equal(await open(unknown), true); await close();
    await page.evaluate(() => {
      openProductPage("google_ai");
      currentProduct = { ...currentProduct, plans: [DATA.products.find(p => p.id === "spotify").plans[0]] };
    });
    await page.click("#pp-order-btn");
    assert.equal(await page.locator("#modal").evaluate(el => el.classList.contains("show")), false, "Foreign product plan accepted");
    const spotify = state.products.find(p => p.id === "spotify");
    await page.evaluate(id => openProductPage(id), spotify.id);
    await page.click("#pp-order-btn");
    await page.check("#orderTermsAgreement");
    await page.evaluate(() => window.detachedConsentForm = document.getElementById("orderConfirmationConsentForm"));
    await close();
    await open(state.products.find(p => p.id === "google_ai"));
    await page.evaluate(() => window.detachedConsentForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(await page.locator("#spotifyEmail").count(), 0, "Detached Spotify modal handler ran");
    await close();
  }
  assert.deepEqual(forbidden, [], "Order/reservation/upload/WhatsApp must not start");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, live, activeProducts: active.length, activePlans: active.reduce((n, {product}) => n + product.plans.filter(p => p.active !== false).length, 0), purchasableProducts: new Set(checks.filter(c => c.product !== "unknown_order_fixture").map(c => c.product)).size, purchasableChecks: checks.length, viewports, errors, forbidden, focusScale: [...new Set(checks.flatMap(c => c.metrics ? [c.metrics.scale] : []))], google: checks.filter(c => c.product === "google_ai" && c.metrics).map(c => ({ width: c.width, height: c.metrics.card.height, scroll: c.metrics.card.scroll })) }, null, 2));
} finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
