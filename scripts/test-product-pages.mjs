import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractAdminState,
  normalizeAdminPayload,
  patchAppSource
} from "../mirpanel-admin/core.mjs";
import {
  activeProductsWithSlugs,
  generateInfoPageFiles,
  generateProductPageFiles,
  generateRedirects,
  generateSitemap,
  removedInfoPagePaths,
  removedProductPagePaths
} from "../mirpanel-admin/product-pages.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = fs.readFileSync(path.join(projectRoot, "app.js"), "utf8");
const productPageCss = fs.readFileSync(path.join(projectRoot, "product-page.css"), "utf8");
const adminSource = fs.readFileSync(path.join(projectRoot, "mirpanel-admin", "public", "admin.js"), "utf8");
const state = extractAdminState(appSource);
const active = activeProductsWithSlugs(state.products);
const pages = generateProductPageFiles(state.products, state.siteSections);
const infoPages = generateInfoPageFiles(state.siteSections, state.ui);
const sitemap = generateSitemap(state.products, state.siteSections, new Date("2026-07-24T00:00:00Z"));
const redirects = generateRedirects(state.products, state.siteSections);

assert.equal(appSource.includes(`tokens ${"truncated"}`), false);
assert.equal(appSource.includes(`${408}${77}`), false);
assert.equal(active.length, 21);
assert.equal(pages.size, active.length);

for (const { product, slug } of active) {
  const filePath = `${slug}/index.html`;
  const html = pages.get(filePath);
  const expectedTitle = String(product.seoTitle || "").trim() || `${String(product.title || "").trim()} | Mirpanel`;
  const expectedDescription =
    String(product.seoDescription || "").trim() ||
    String(product.desc || "").trim() ||
    `${String(product.title || "").trim()} üçün mövcud planları və qiymətləri Mirpanel-də yoxlayın.`;
  assert.ok(html, `${filePath} yaradılmayıb`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${filePath}: H1 sayı`);
  assert.ok(html.includes(`<title>${escapeHtml(expectedTitle)}</title>`), `${filePath}: title`);
  assert.ok(html.includes(`name="description" content="${escapeAttribute(expectedDescription)}"`), `${filePath}: description`);
  assert.ok(html.includes(`rel="canonical" href="https://mirpanel.com/${slug}/"`), `${filePath}: canonical`);
  assert.ok(html.includes(`name="robots" content="index, follow"`), `${filePath}: robots`);
  assert.ok(html.includes(`name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"`), `${filePath}: viewport`);
  assert.ok(html.includes(`/product-page.css?v=20260724-mobile-pricing-1`), `${filePath}: scoped CSS`);
  assert.ok(html.includes(`/app.js?v=product-pages-20260724-refine-1`), `${filePath}: product data cache version`);
  assert.ok(html.includes(`property="og:url" content="https://mirpanel.com/${slug}/"`), `${filePath}: Open Graph`);
  assert.ok(html.includes(`alt="${escapeAttribute(product.title)}"`), `${filePath}: image alt`);
  assert.ok(html.includes(`data-product-id="${escapeAttribute(product.id)}"`), `${filePath}: product id`);
  assert.ok(html.includes(`id="pp-order-btn"`), `${filePath}: order button`);
  assert.ok(html.includes(`>Məhsul haqqında</a>`), `${filePath}: about scroll button`);
  assert.ok(html.includes(`>Sifariş et</button>`), `${filePath}: order button text`);
  assert.ok(html.includes(`>Müddət seçin</h2>`), `${filePath}: plan heading`);
  assert.ok(html.includes(`7/24 anında təqdim edilir`), `${filePath}: delivery text`);
  assert.equal(html.includes(`class="product-page-back"`), false, `${filePath}: back link removed`);
  assert.equal((html.match(/<svg aria-hidden="true"/g) || []).length, 5, `${filePath}: menu icons`);
  assert.ok(html.includes(`href="/haqqimizda/"`), `${filePath}: about link`);
  assert.ok(html.includes(`href="/sertler/"`), `${filePath}: terms link`);
  assert.ok(html.includes(`href="/elaqe/"`), `${filePath}: contact link`);
  assert.ok(html.includes(`id="product-about"`), `${filePath}: stable about target`);
  assert.ok(html.includes(`data-product-tab="about"`), `${filePath}: about tab`);
  assert.ok(html.includes(`data-product-tab="rules"`), `${filePath}: rules tab`);
  assert.ok(html.includes(`class="product-page-layout"`), `${filePath}: two-column layout`);
  assert.ok(html.includes(`class="product-page-similar-list"`), `${filePath}: similar products`);
  assert.ok(html.includes(`class="product-page-similar-more"`), `${filePath}: mobile more-products link`);
  assert.ok(html.includes(`src="${escapeAttribute(rootRelativeUrl(product.image))}"`), `${filePath}: root-relative image`);
  assert.ok(html.includes(`href="/"`), `${filePath}: home link`);
  assert.equal(html.includes('target="_blank"'), false, `${filePath}: yeni tab`);
  assert.equal(html.includes("Səbətə At"), false, `${filePath}: səbət mətni`);

  for (const plan of product.plans) {
    const price = Number(plan.price) || 0;
    const regularPrice = Number(plan.regularPrice) || 0;
    const discount = regularPrice > price && price > 0
      ? Math.round((regularPrice - price) / regularPrice * 100)
      : 0;
    if (discount > 0) {
      assert.ok(html.includes(`${regularPrice.toFixed(2)} ${product.currency}`), `${filePath}: regularPrice`);
      assert.ok(html.includes(`-${discount}%`), `${filePath}: calculated discount`);
    }
  }

  const jsonLdText = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(jsonLdText, `${filePath}: JSON-LD`);
  const graph = JSON.parse(jsonLdText)["@graph"];
  const productSchema = graph.find((item) => item["@type"] === "Product");
  const breadcrumb = graph.find((item) => item["@type"] === "BreadcrumbList");
  assert.equal(productSchema.name, product.title, `${filePath}: schema name`);
  assert.equal(productSchema.image[0], absoluteUrl(product.image), `${filePath}: schema image`);
  assert.ok(Array.isArray(productSchema.offers), `${filePath}: offers`);
  assert.equal(productSchema.offers.length, product.plans.length, `${filePath}: offer count`);
  assert.ok(productSchema.offers.every((offer) => offer["@type"] === "Offer"), `${filePath}: Offer type`);
  assert.ok(productSchema.offers.every((offer) => offer.priceCurrency === "AZN"), `${filePath}: currency`);
  assert.ok(breadcrumb, `${filePath}: BreadcrumbList`);

  const sitemapUrl = `https://mirpanel.com/${slug}/`;
  assert.equal(count(sitemap, sitemapUrl), 1, `${filePath}: sitemap təkrarı`);
  assert.ok(
    redirects.includes(`/${slug} /${slug}/index.html 200`),
    `${filePath}: redirects`
  );
  assert.ok(fs.existsSync(path.join(projectRoot, filePath)), `${filePath}: disk`);
}

assert.ok(productPageCss.includes(".product-page-layout"), "Scoped desktop product layout CSS");
assert.ok(productPageCss.includes("object-fit: contain"), "Product images use contain");
assert.ok(productPageCss.includes("@media (max-width: 1040px)"), "Tablet CSS");
assert.ok(productPageCss.includes("@media (max-width: 768px)"), "Mobile CSS");
assert.ok(productPageCss.includes("overflow-x: hidden"), "Horizontal overflow protection");
assert.ok(productPageCss.includes("100dvh"), "Dynamic viewport height");
assert.ok(productPageCss.includes("env(safe-area-inset-top"), "iPhone top safe area");
assert.ok(productPageCss.includes("env(safe-area-inset-bottom"), "iPhone bottom safe area");
assert.ok(productPageCss.includes(".product-page-similar-card:nth-child(n + 5)"), "Mobile similar-product limit");
assert.ok(productPageCss.includes("stroke: currentColor"), "Menu icons follow text color");
assert.ok(productPageCss.includes("scroll-margin-top"), "About scroll target clears sticky header");
assert.ok(productPageCss.includes("height: clamp(170px, 50vw, 200px)"), "Mobile media is compact");
assert.ok(productPageCss.includes("transform: none !important"), "Mobile product image is not scaled");
assert.ok(productPageCss.includes(".product-page-variant {\n    display: none;"), "Mobile variant badge is hidden");
assert.ok(adminSource.includes('aria-label="Əvvəlki qiymət"'), "Admin regularPrice label");
assert.ok(adminSource.includes('data-field="regularPrice" type="number" min="0"'), "Admin regularPrice rejects negatives");

for (const product of state.products.filter((item) => item.active === false)) {
  if (!product.seoSlug) continue;
  assert.equal(
    sitemap.includes(`https://mirpanel.com/${product.seoSlug}/`),
    false,
    `${product.id}: deaktiv məhsul sitemap-da`
  );
}

for (const line of redirects.trim().split(/\r?\n/)) {
  const [source, destination, status] = line.split(/\s+/);
  if (status === "301") assert.notEqual(source, destination, `Redirect loop: ${line}`);
}

const orderSnapshot = state.products.map(({ id, order }) => ({ id, order }));
generateProductPageFiles(state.products, state.siteSections);
assert.deepEqual(
  state.products.map(({ id, order }) => ({ id, order })),
  orderSnapshot,
  "Generator məhsul sırasını dəyişdi"
);

const normalized = normalizeAdminPayload(structuredClone(state));
const patchedSource = patchAppSource(appSource, normalized);
const simulatedState = extractAdminState(patchedSource);
const simulatedProjection = simulatedState.products.map(
  ({ id, order, title, image, currency, plans, active, soldOut }) => ({
    id,
    order,
    title,
    image,
    currency,
    plans,
    active,
    soldOut
  })
);
const originalProjection = state.products.map(
  ({ id, order, title, image, currency, plans, active, soldOut }) => ({
    id,
    order,
    title,
    image,
    currency,
    plans,
    active,
    soldOut
  })
);
assert.equal(
  JSON.stringify(simulatedProjection),
  JSON.stringify(originalProjection),
  "Admin no-change simulyasiyası məhsul məlumatını dəyişdi"
);

const deactivated = structuredClone(state.products);
const deactivatedProduct = deactivated.find((product) => product.active !== false);
deactivatedProduct.active = false;
assert.equal(
  removedProductPagePaths(state.products, deactivated).length,
  1,
  "Deaktiv məhsul səhifəsinin çıxarılması"
);

const expectedInfoPages = {
  haqqimizda: {
    title: "Mirpanel haqqında | Premium hesablar Azərbaycan",
    description: "Mirpanel, təqdim etdiyi premium hesab xidmətləri və sifariş prosesi haqqında məlumat.",
    h1: "Mirpanel haqqında"
  },
  elaqe: {
    title: "Mirpanel ilə əlaqə | WhatsApp dəstək",
    description: "Mirpanel dəstək komandası ilə WhatsApp vasitəsilə əlaqə saxlayın.",
    h1: "Mirpanel ilə əlaqə"
  },
  sertler: {
    title: "İstifadə və sifariş şərtləri | Mirpanel",
    description: "Mirpanel sifariş, istifadə və hesab təhlükəsizliyi şərtləri ilə tanış olun.",
    h1: "İstifadə və sifariş şərtləri"
  }
};

assert.equal(infoPages.size, 3, "Information page count");
for (const [key, expected] of Object.entries(expectedInfoPages)) {
  const html = infoPages.get(`${key}/index.html`);
  assert.ok(html, `${key}: information page`);
  assert.ok(html.includes(`<title>${expected.title}</title>`), `${key}: title`);
  assert.ok(html.includes(`name="description" content="${expected.description}"`), `${key}: description`);
  assert.ok(html.includes(`<h1>${expected.h1}</h1>`), `${key}: h1`);
  assert.ok(html.includes(`rel="canonical" href="https://mirpanel.com/${key}/"`), `${key}: canonical`);
  assert.ok(html.includes(`property="og:url" content="https://mirpanel.com/${key}/"`), `${key}: Open Graph URL`);
  assert.ok(html.includes(`name="robots" content="index, follow"`), `${key}: robots`);
  assert.ok(html.includes(`"@type":"BreadcrumbList"`), `${key}: BreadcrumbList`);
  assert.equal(html.includes('target="_blank"'), false, `${key}: no new tab`);
  assert.ok(sitemap.includes(`https://mirpanel.com/${key}/`), `${key}: sitemap`);
  assert.equal(sitemap.includes(`https://mirpanel.com/${key}<`), false, `${key}: redirect URL absent from sitemap`);
  assert.ok(redirects.includes(`/${key} /${key}/ 301`), `${key}: permanent redirect`);
  assert.ok(redirects.includes(`/${key}/ /${key}/index.html 200`), `${key}: final route`);
}
assert.ok(sitemap.includes("https://mirpanel.com/netflix-almaq/"), "Netflix final URL in sitemap");
assert.equal(sitemap.includes("https://mirpanel.com/netflix-almaq<"), false, "Netflix redirect URL absent from sitemap");

const disabledSections = structuredClone(state.siteSections);
disabledSections.haqqimizda.enabled = false;
assert.equal(
  generateInfoPageFiles(disabledSections, state.ui).has("haqqimizda/index.html"),
  false,
  "Disabled information page generated"
);
assert.equal(
  generateSitemap(state.products, disabledSections).includes("https://mirpanel.com/haqqimizda/"),
  false,
  "Disabled information page remained in sitemap"
);
assert.deepEqual(
  removedInfoPagePaths(state.siteSections, disabledSections),
  ["haqqimizda/index.html"],
  "Disabled information page removal"
);

const updatedSections = structuredClone(state.siteSections);
updatedSections.haqqimizda.body = "Admin məlumat səhifəsi yeniləmə testi.";
assert.ok(
  generateInfoPageFiles(updatedSections, state.ui)
    .get("haqqimizda/index.html")
    .includes("Admin məlumat səhifəsi yeniləmə testi."),
  "Admin information text did not regenerate the page"
);

assert.equal(
  generateSitemap(deactivated, state.siteSections).includes(
    `https://mirpanel.com/${deactivatedProduct.seoSlug}/`
  ),
  false,
  "Inactive product remained in sitemap"
);

const addedProducts = structuredClone(state.products);
const addedProduct = structuredClone(active[0].product);
addedProduct.id = "seo-generator-test-product";
addedProduct.title = "SEO Generator Test Product";
addedProduct.seoSlug = "seo-generator-test-product-almaq";
addedProduct.plans = [{ months: 1, price: 10, regularPrice: 20 }];
addedProducts.push(addedProduct);
const addedHtml = generateProductPageFiles(addedProducts).get("seo-generator-test-product-almaq/index.html");
assert.ok(
  addedHtml,
  "New active product page was not generated"
);
assert.ok(addedHtml.includes("20.00 ₼"), "New product regularPrice was not rendered");
assert.ok(addedHtml.includes("-50%"), "New product discount was not calculated");

const adminRegularPriceState = structuredClone(state);
adminRegularPriceState.products[0].plans[0].regularPrice = 12.34;
const adminRegularPriceSource = patchAppSource(
  appSource,
  normalizeAdminPayload(adminRegularPriceState)
);
assert.equal(
  extractAdminState(adminRegularPriceSource).products[0].plans[0].regularPrice,
  12.34,
  "Admin regularPrice saxlayıb yenidən oxumadı"
);

const updatedProducts = structuredClone(state.products);
const updatedProduct = updatedProducts.find((product) => product.id === active[0].product.id);
updatedProduct.seoTitle = "Generator update test title";
const updatedHtml = generateProductPageFiles(updatedProducts).get(`${active[0].slug}/index.html`);
assert.ok(
  updatedHtml.includes("<title>Generator update test title</title>"),
  "Product page did not reflect an admin metadata update"
);

console.log(`PASS: ${active.length} active product pages, SEO, schema, sitemap, redirects, order preservation and admin simulation.`);

function count(text, value) {
  return text.split(value).length - 1;
}

function absoluteUrl(value) {
  const source = String(value || "").replace(/^https?:\/\/mirpanel\.com/i, "");
  return new URL(source.startsWith("/") ? source : `/${source}`, "https://mirpanel.com").href;
}

function rootRelativeUrl(value) {
  const source = String(value || "").replace(/^https?:\/\/mirpanel\.com/i, "");
  return source.startsWith("/") ? source : `/${source}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
