import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractAdminState, normalizeAdminPayload } from "../mirpanel-admin/core.mjs";
import { generateProductPageFiles } from "../mirpanel-admin/product-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = process.env.MIRPANEL_NODE_MODULES;
const browserPath = process.env.MIRPANEL_BROWSER_PATH;
if (!nodeModules || !browserPath) throw new Error("Browser test runtime paths are required.");
const { chromium } = await import(pathToFileURL(path.join(nodeModules, "playwright", "index.mjs")));

const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const state = extractAdminState(appSource);
const spotify = state.products.find((product) => product.id === "spotify");
assert.ok(spotify, "Spotify məhsulu tapılmadı");
assert.equal(spotify.spotifyPasswordResetUrl, "https://accounts.spotify.com/az/password-reset");
assert.equal(spotify.formFields.filter((field) => field.type === "password").length, 2);

const custom = structuredClone(state);
custom.products.find((product) => product.id === "spotify").spotifyPasswordResetUrl = "https://example.com/spotify-reset";
assert.equal(normalizeAdminPayload(custom).products.find((product) => product.id === "spotify").spotifyPasswordResetUrl, "https://example.com/spotify-reset");
const invalid = structuredClone(state);
invalid.products.find((product) => product.id === "spotify").spotifyPasswordResetUrl = "http://example.com/reset";
assert.throws(() => normalizeAdminPayload(invalid), /https:\/\/ URL/);

const generated = generateProductPageFiles(state.products, state.siteSections, state.cms, state.content);
const htmlByPath = new Map();
for (const [file, html] of generated) {
  htmlByPath.set(`/${file.replace(/\.page$/, "")}`, html.replace("</head>", "<script>window.MIRPANEL_PAYMENT_API=location.origin</script></head>"));
}
let reservationRequests = 0;
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/api/payments/methods") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ methods: [], anyAvailable: false }));
  }
  if (pathname === "/api/payments/reservations") {
    reservationRequests += 1;
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ error: "Rezerv yaradılmamalıdır." }));
  }
  if (htmlByPath.has(pathname)) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return response.end(htmlByPath.get(pathname));
  }
  const file = path.join(root, pathname.replace(/^\/+/, ""));
  if (file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const type = file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "application/octet-stream";
    response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
    return response.end(fs.readFileSync(file));
  }
  response.writeHead(404); response.end();
});

await new Promise((resolve) => server.listen(10084, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const consoleErrors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) consoleErrors.push(message.text()); });

  for (const viewport of [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto("http://127.0.0.1:10084/mehsul/spotify-premium", { waitUntil: "networkidle" });
    if (viewport.width === 1440) {
      await page.evaluate(() => {
        DATA.products.find((product) => product.id === "spotify").spotifyPasswordResetUrl = "https://example.com/spotify-reset";
      });
    }
    await page.click("#pp-order-btn");
    await page.check("#orderTermsAgreement");
    await page.click("#orderConfirmationConfirm");
    assert.equal(await page.locator('#spotifyEmail[type="email"]').count(), 1);
    assert.equal(await page.locator('#spotifyPassword[type="password"]').count(), 1);
    assert.equal(await page.locator('#spotifyPasswordConfirm[type="password"]').count(), 1);
    assert.equal(await page.locator(".spotifyPasswordToggle").count(), 2);
    assert.equal(await page.locator("#spotifyContinueButton").isDisabled(), true);
    const reset = page.locator(".spotifyPasswordReset a");
    assert.equal(await reset.textContent(), "Şifrənizi sıfırlayın.");
    assert.equal(await reset.getAttribute("href"), viewport.width === 1440 ? "https://example.com/spotify-reset" : "https://accounts.spotify.com/az/password-reset");
    assert.equal(await reset.getAttribute("target"), "_blank");
    assert.equal(await reset.getAttribute("rel"), "noopener noreferrer");

    await page.fill("#spotifyEmail", "səhv-email");
    await page.fill("#spotifyPassword", "birinci");
    await page.fill("#spotifyPasswordConfirm", "ikinci");
    assert.equal(await page.locator("#spotifyContinueButton").isDisabled(), true);
    assert.equal(await page.locator("#spotifyPasswordError").isVisible(), true);
    assert.match(await page.locator("#spotifyPasswordError").textContent(), /Şifrələr eyni deyil/);

    await page.locator('[data-password-toggle="spotifyPassword"]').click();
    assert.equal(await page.locator("#spotifyPassword").getAttribute("type"), "text");
    assert.equal(await page.locator('[data-password-toggle="spotifyPassword"]').getAttribute("aria-label"), "Şifrəni gizlət");
    await page.locator('[data-password-toggle="spotifyPassword"]').click();
    assert.equal(await page.locator("#spotifyPassword").getAttribute("type"), "password");
    await page.locator('[data-password-toggle="spotifyPasswordConfirm"]').click();
    assert.equal(await page.locator("#spotifyPasswordConfirm").getAttribute("type"), "text");

    await page.fill("#spotifyEmail", "spotify@example.com");
    await page.fill("#spotifyPasswordConfirm", "birinci");
    assert.equal(await page.locator("#spotifyContinueButton").isEnabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `${viewport.width}px üfüqi daşma`);
    if (viewport.width === 390) {
      await page.click("#spotifyContinueButton");
      await page.locator(".paymentFlow").waitFor({ state: "visible" });
      assert.match(await page.locator("#paymentFlowTitle").textContent(), /Ödəniş üsulunu seçin/);
    } else {
      await page.click("#universalFormCancel");
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:10084/mehsul/capcut-pro", { waitUntil: "networkidle" });
  await page.click("#pp-order-btn"); await page.check("#orderTermsAgreement"); await page.click("#orderConfirmationConfirm");
  assert.equal(await page.locator("#spotifyEmail").count(), 0, "Spotify sahələri başqa məhsulda göründü");
  assert.equal(await page.locator(".spotifyPasswordReset").count(), 0, "Spotify reset linki başqa məhsulda göründü");

  assert.equal(reservationRequests, 0, "Test zamanı real rezerv axınına keçildi");
  assert.deepEqual(consoleErrors, []);
  console.log(JSON.stringify({ ok: true, viewports: [320, 390, 768, 1440], passwordToggles: 2, resetUrl: spotify.spotifyPasswordResetUrl, reservationRequests, consoleErrors: 0 }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
