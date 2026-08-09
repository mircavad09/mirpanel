import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";
import {
  activeProductsWithSlugs,
  generateProductPageFiles,
  generateProductPageHtml
} from "../mirpanel-admin/product-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const state = extractAdminState(fs.readFileSync(path.join(root, "app.js"), "utf8"));
const active = activeProductsWithSlugs(state.products);
const pages = generateProductPageFiles(
  state.products,
  state.siteSections,
  state.cms,
  state.content
);

assert.equal(active.length, 22, "Aktiv məhsul sayı dəyişib");
assert.equal(pages.size, active.length, "Bütün aktiv məhsul səhifələri generasiya edilməyib");

for (const { product, slug } of active) {
  const file = `mehsul/${slug}.page`;
  const html = pages.get(file);
  assert.ok(html, `${file} yaranmadı`);
  assert.match(html, /class="product-page-layout"/, `${file}: ortaq desktop layout yoxdur`);
  assert.match(html, /class="product-page-similar-card"/, `${file}: oxşar məhsul kartı yoxdur`);
  assert.match(html, /role="tab"[^>]+aria-controls="product-panel-about"/, `${file}: tab əlaqəsi yoxdur`);
  assert.match(html, /role="tabpanel"[^>]+aria-labelledby="product-tab-about"/, `${file}: tab paneli əlaqəsi yoxdur`);
  assert.doesNotMatch(
    html,
    new RegExp(`class="product-page-similar-card"[^>]+href="/mehsul/${slug}"`),
    `${file}: cari məhsul oxşar məhsullara düşüb`
  );
  assert.match(html, /product-page\.css\?v=20260804-desktop-layout-1/, `${file}: yeni CSS keş açarı yoxdur`);
  assert.match(html, /product-page\.js\?v=20260804-desktop-layout-1/, `${file}: yeni tab davranışı yoxdur`);
  assert.ok(product.id, `${file}: məhsul ID-si boşdur`);
}

const future = {
  ...active[0].product,
  id: "future-layout-test",
  title: "Gələcək məhsul",
  seoSlug: "gelecek-mehsul",
  active: true
};
const futureHtml = generateProductPageHtml(
  future,
  "gelecek-mehsul",
  [...active, { product: future, slug: "gelecek-mehsul" }],
  state.siteSections,
  state.cms,
  {}
);
assert.match(futureHtml, /class="product-page-layout"/, "Gələcək məhsul ortaq layout almır");
assert.match(futureHtml, /class="product-page-similar-card"/, "Gələcək məhsul oxşar məhsul komponenti almır");

console.log(`Desktop product layout tests passed for ${active.length} active products and one future product.`);
