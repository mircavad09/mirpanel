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
  generateProductPageFiles,
  generateRedirects,
  generateSitemap,
  removedProductPagePaths
} from "../mirpanel-admin/product-pages.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = fs.readFileSync(path.join(projectRoot, "app.js"), "utf8");
const productPageCss = fs.readFileSync(path.join(projectRoot, "product-page.css"), "utf8");
const state = extractAdminState(appSource);
const active = activeProductsWithSlugs(state.products);
const pages = generateProductPageFiles(state.products);
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
  assert.ok(html.includes(`/product-page.css?v=20260724-mobile-compact-2`), `${filePath}: scoped CSS`);
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
  assert.equal((html.match(/<svg aria-hidden="true"/g) || []).length, 4, `${filePath}: menu icons`);
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
generateProductPageFiles(state.products);
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
