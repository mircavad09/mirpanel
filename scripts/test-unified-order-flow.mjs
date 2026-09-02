import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";
import { activeProductsWithSlugs, generateProductPageFiles } from "../mirpanel-admin/product-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = process.env.MIRPANEL_NODE_MODULES;
const browserPath = process.env.MIRPANEL_BROWSER_PATH;
if (!nodeModules || !browserPath) throw new Error("Browser test runtime paths are required.");
const { chromium } = await import(pathToFileURL(path.join(nodeModules, "playwright", "index.mjs")));

const state = extractAdminState(fs.readFileSync(path.join(root, "app.js"), "utf8"));
const active = activeProductsWithSlugs(state.products);
const futureProduct = structuredClone(active.find(({ product }) => (product.plans || []).some((plan) => Number(plan.price) > 0)).product);
futureProduct.id = "future_unified_order_test";
futureProduct._stableId = futureProduct.id;
futureProduct.title = "Gələcək test məhsulu";
futureProduct.seoSlug = "future-unified-order-test";
futureProduct.flow = "name_code_5";
futureProduct.formFields = [
  { key: "name", type: "text", label: "Ad", required: true, enabled: true },
  { key: "code_5", type: "text", label: "5 rəqəmli kod / PIN", required: true, enabled: true }
];
futureProduct.plans = [{ label: "1 aylıq", months: 1, price: 1 }];
futureProduct.soldOut = false;
futureProduct.active = true;

const generated = generateProductPageFiles([...state.products, futureProduct], state.siteSections, state.cms, state.content);
const htmlByPath = new Map();
for (const [file, html] of generated) {
  const route = `/${file.replace(/\.page$/, "")}`;
  const withPaymentApi = html.replace("</head>", "<script>window.MIRPANEL_PAYMENT_API=location.origin</script></head>");
  const withPublishedProduct = route === "/mehsul/future-unified-order-test"
    ? withPaymentApi.replace(/(<script src="\/app\.js[^"]*"><\/script>)/, `$1<script>DATA.products.push(${JSON.stringify(futureProduct).replace(/</g, "\\u003c")})</script>`)
    : withPaymentApi;
  htmlByPath.set(route, withPublishedProduct);
}

let reservationRequests = 0;
const contentType = (file) => file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "application/javascript" : "application/octet-stream";
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/api/payments/methods") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
    return response.end(JSON.stringify({ methods: [], anyAvailable: false }));
  }
  if (pathname === "/api/payments/reservations") {
    reservationRequests += 1;
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ error: "Kart seçilmədən rezerv yaradılmamalıdır." }));
  }
  if (htmlByPath.has(pathname)) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return response.end(htmlByPath.get(pathname));
  }
  const file = path.join(root, pathname.replace(/^\/+/, ""));
  if (file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    response.writeHead(200, { "Content-Type": `${contentType(file)}; charset=utf-8` });
    return response.end(fs.readFileSync(file));
  }
  response.writeHead(404);
  response.end();
});

await new Promise((resolve) => server.listen(10082, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const pageErrors = [];

function purchasable(product) {
  const rawStock = product.stock ?? product.stockCount ?? product.stockQuantity;
  const stockEmpty = product.stockEnabled === true && rawStock !== null && rawStock !== "" && rawStock !== undefined && Number(rawStock) <= 0;
  return product.active !== false && product.soldOut !== true && product.flow !== "out_of_stock" && !stockEmpty && (product.plans || []).some((plan) => Number(plan.price) > 0);
}

async function fillCustomerForm(page) {
  const form = page.locator("#universalOrderForm");
  if (!await form.count()) return false;
  for (const control of await form.locator("input, textarea, select").all()) {
    const tag = await control.evaluate((element) => element.tagName.toLowerCase());
    if (tag === "select") {
      const values = await control.locator("option").evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
      if (values[0]) await control.selectOption(values[0]);
      continue;
    }
    const codeLength = Number(await control.getAttribute("data-code-length")) || 0;
    const type = await control.getAttribute("type");
    if (await control.getAttribute("readonly") !== null) continue;
    const value = codeLength ? "1".repeat(codeLength) : type === "email" ? "test@example.com" : type === "number" ? "1" : "Test məlumatı";
    await control.fill(value);
  }
  await form.locator('button[type="submit"]').click();
  return true;
}

async function verifyFlow(page, product, slug) {
  await page.goto(`http://127.0.0.1:10082/mehsul/${slug}`, { waitUntil: "networkidle" });
  const button = page.locator("#pp-order-btn");
  if (!purchasable(product)) {
    assert.equal(await button.isDisabled(), true, `${slug}: sifarişsiz məhsulun düyməsi deaktiv deyil`);
    assert.match(await button.textContent(), /Stokda yoxdur/);
    return "unavailable";
  }

  await button.click();
  assert.equal(await page.locator("#orderConfirmationConsentForm").count(), 1, `${slug}: təsdiq pəncərəsi açılmadı`);
  const checkbox = page.locator("#orderTermsAgreement");
  const confirm = page.locator("#orderConfirmationConfirm");
  assert.equal(await checkbox.isChecked(), false, `${slug}: checkbox ilkin olaraq seçilib`);
  assert.equal(await confirm.isDisabled(), true, `${slug}: təsdiq düyməsi checkbox-suz aktivdir`);
  await checkbox.check();
  assert.equal(await confirm.isEnabled(), true, `${slug}: checkbox təsdiq düyməsini aktivləşdirmədi`);
  await confirm.click();
  await fillCustomerForm(page);
  await page.waitForSelector(".paymentFlow", { state: "visible" });
  assert.equal(await page.locator(".paymentFlow").count(), 1, `${slug}: ödəniş pəncərəsi bir dəfədən çox açıldı`);
  assert.match(await page.locator("#paymentFlowTitle").textContent(), /Ödəniş üsulunu seçin/);
  return "payment";
}

try {
  const results = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) pageErrors.push(message.text());
  });
  for (const { product, slug } of active) results.push({ slug, result: await verifyFlow(page, product, slug) });
  results.push({ slug: futureProduct.seoSlug, result: await verifyFlow(page, futureProduct, futureProduct.seoSlug) });

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 720 : 900 });
    for (const slug of ["hbo-max", "amazon-prime-video", "capcut-pro"]) {
      const product = [...active, { product: futureProduct, slug: futureProduct.seoSlug }].find((entry) => entry.slug === slug).product;
      await verifyFlow(page, product, slug);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${slug}: ${width}px üfüqi daşma`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:10082/mehsul/tiktok-jeton", { waitUntil: "networkidle" });
  await page.click("#pp-order-btn"); await page.check("#orderTermsAgreement"); await page.click("#orderConfirmationConfirm");
  assert.equal(await page.locator('#universalOrderForm input[name="tiktok_username"]').count(), 1, "TikTok identifikator sahəsi yoxdur");
  assert.equal(await page.locator('#universalOrderForm input[name="jeton_quantity"]').inputValue(), "500", "TikTok jeton miqdarı cari 10 ₼ planına uyğun deyil");
  assert.equal(await page.locator('#universalOrderForm input[type="password"]').count(), 0, "TikTok formunda şifrə sahəsi qalıb");
  assert.equal((await page.locator("#universalOrderForm").innerText()).includes("Spotify"), false, "TikTok formunda Spotify mətni qalıb");

  await page.goto("http://127.0.0.1:10082/mehsul/hbo-max", { waitUntil: "networkidle" });
  await page.click("#pp-order-btn"); await page.check("#orderTermsAgreement"); await page.click("#orderConfirmationConfirm");
  assert.match(await page.locator("#universalOrderForm").innerText(), /HBO Max profil məlumatları/);
  assert.match(await page.locator("#universalOrderForm").innerText(), /HBO Max profil adı/);
  assert.match(await page.locator("#universalOrderForm").innerText(), /Profil kodu \/ PIN/);

  await page.goto("http://127.0.0.1:10082/mehsul/spotify-premium", { waitUntil: "networkidle" });
  await page.click("#pp-order-btn"); await page.check("#orderTermsAgreement"); await page.click("#orderConfirmationConfirm");
  assert.equal(await page.locator('#universalOrderForm input[type="email"]').count(), 1, "Spotify email sahəsi dəyişib");
  assert.equal(await page.locator('#universalOrderForm input[type="password"]').count(), 1, "Spotify şifrə sahəsi dəyişib");

  await page.goto("http://127.0.0.1:10082/mehsul/hbo-max", { waitUntil: "networkidle" });
  await page.dblclick("#pp-order-btn");
  assert.equal(await page.locator("#orderConfirmationConsentForm").count(), 1, "Təkrar klik iki təsdiq pəncərəsi yaratdı");
  assert.equal(await page.locator("#orderTermsAgreement").isChecked(), false);

  assert.equal(reservationRequests, 0, "Kart seçilmədən rezerv sorğusu yarandı");
  assert.deepEqual(pageErrors, [], `Konsol xətaları: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({
    ok: true,
    activeProducts: active.length,
    purchasableProducts: results.filter((item) => item.result === "payment").length - 1,
    unavailableProducts: results.filter((item) => item.result === "unavailable").length,
    futureProduct: "payment",
    viewports: [320, 390, 768, 1440],
    reservationRequests,
    consoleErrors: pageErrors.length
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
