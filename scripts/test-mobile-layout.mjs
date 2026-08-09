import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";
import { activeProductsWithSlugs, generateProductPageFiles, generateProductPageHtml } from "../mirpanel-admin/product-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const index = read("index.html");
const style = read("style.css");
const compact = read("premium-compact-glow.css");
const productCss = read("product-page.css");
const headerCss = read("site-header.css");
const headerJs = read("site-header.js");
const admin = read("mirpanel-admin/public/admin.js");
const state = extractAdminState(app);
const active = activeProductsWithSlugs(state.products);
const pages = generateProductPageFiles(state.products, state.siteSections, state.cms, state.content);

function assertPremiumNavigation(html, activeHref) {
  const nav = html.match(/<nav class="product-page-nav site-header-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || "";
  assert.ok(nav, "Ortaq premium naviqasiya tapılmadı");
  assert.equal((nav.match(/<a /g) || []).length, 5, "Naviqasiyada beş keçid olmalıdır");
  assert.equal((nav.match(/<svg /g) || []).length, 5, "Hər keçidin SVG ikonu olmalıdır");
  for (const href of ["/", "/mehsul", "/haqqimizda", "/sertler", "/elaqe"]) {
    assert.ok(nav.includes(`href="${href}"`), `${href} keçidi çatışmır`);
  }
  assert.ok(new RegExp(`href="${activeHref.replace("/", "\\/")}"[^>]*aria-current="page"`).test(nav), `${activeHref} aktiv deyil`);
  assert.equal(nav.includes('target="_blank"'), false, "Daxili naviqasiya yeni tab açmamalıdır");
}

assert.equal(state.products.length, 31);
assert.equal(active.length, 22);
assert.match(style, /\.side-menu-links li a svg\s*\{[\s\S]*?width:\s*22px;[\s\S]*?height:\s*22px;/);
assert.match(style, /\.side-menu\s*\{[\s\S]*?height:\s*100dvh;[\s\S]*?overflow-y:\s*auto;/);
assert.match(app, /event\.key === "Escape"/);
assert.match(app, /document\.body\.classList\.add\("side-menu-open"\)/);
assert.equal((index.match(/menuOpenBtn\.addEventListener/g) || []).length, 0, "Inline təkrar menyu idarəsi qalıb");
assert.match(compact, /#products-section > main\.wrap\s*\{\s*padding-top:\s*10px;/);
assert.match(productCss, /\.product-page-media \.product-page-media-backdrop/);
assert.match(headerCss, /\.site-header-nav a\[aria-current="page"\]/);
assert.match(headerCss, /\.site-header-drawer-nav/);
assert.match(headerJs, /site-header-menu-open/);
assert.match(headerJs, /event\.key === "Escape"/);
assert.match(productCss, /font-size:\s*clamp\(24px,\s*7vw,\s*28px\)/);
assert.match(admin, /İctimai başlıq/);
assertPremiumNavigation(index, "/");
assertPremiumNavigation(read("mehsul.page"), "/mehsul");
assertPremiumNavigation(read("haqqimizda"), "/haqqimizda");
assertPremiumNavigation(read("sertler"), "/sertler");
assertPremiumNavigation(read("elaqe"), "/elaqe");

for (const { product, slug } of active) {
  const html = pages.get(`mehsul/${slug}.page`);
  assert.ok(html, `${slug} səhifəsi yaradılmadı`);
  assert.match(html, /class="product-page-media-backdrop"/);
  const h1 = html.match(/<h1 id="pp-main-title" class="product-page-title">([^<]+)<\/h1>/)?.[1] || "";
  assert.ok(h1);
  assert.equal(/\salmaq\s*$/i.test(h1), false, `${slug} H1 sonunda almaq qalıb`);
  assert.match(html, /href="\/mehsul"[^>]*aria-current="page"/);
  assertPremiumNavigation(html, "/mehsul");
}

const future = {
  ...structuredClone(active[0].product),
  id: "future-mobile-template",
  title: "Gələcək məhsul almaq",
  seoH1: "Gələcək məhsul almaq",
  seoSlug: "future-mobile-template"
};
const futureHtml = generateProductPageHtml(future, future.seoSlug, [...active, { product: future, slug: future.seoSlug }], state.siteSections, state.cms, state.content);
assert.match(futureHtml, /<h1 id="pp-main-title" class="product-page-title">Gələcək məhsul<\/h1>/);
assert.equal(futureHtml.includes("Gələcək məhsul almaq</h1>"), false);

console.log("PASS: ortaq mobil menyu, məsafə, məhsul şəkli, başlıq, naviqasiya və gələcək məhsul şablonu.");
