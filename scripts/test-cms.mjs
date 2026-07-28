import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { extractAdminState, normalizeAdminPayload, patchAppSource } from "../mirpanel-admin/core.mjs";
import {
  generateInfoPageFiles,
  generateProductPageFiles,
  generateRedirects,
  generateSitemap
} from "../mirpanel-admin/product-pages.mjs";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const state = extractAdminState(appSource);
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const orderSnapshot = state.products.map((product) => [product.id, product.order]);
const commercialSnapshot = state.products.map((product) => [
  product.id,
  product.active,
  product.seoSlug,
  product.plans.map((plan) => [plan.label || "", plan.months, plan.price, plan.regularPrice || null])
]);

assert.equal(state.products.length, 30, "Məhsul sayı dəyişib");
assert.equal(state.products.filter((product) => product.active).length, 21, "Aktiv məhsul sayı dəyişib");
assert.equal(digest(orderSnapshot), "b67de45e1f435af2ee6991e5d63063907e6fc410c207076a17cae56638231689", "Məhsul sırası dəyişib");
assert.equal(digest(commercialSnapshot), "c117ab5a7e0d54785f56b4dbb8bb4f8fab04e4d151fa24ab493d46a89d8c8d4d", "Qiymət, plan, slug və ya aktivlik dəyişib");
assert.deepEqual(Object.keys(state.cms), [
  "schemaVersion", "site", "homepage", "navigation", "banners", "footer",
  "commonTexts", "seo", "orderSettings", "media"
]);
assert.ok(Object.values(state.cms.commonTexts).every(Boolean), "Ümumi mətn fallback-i boşdur");

const hostile = structuredClone(state);
hostile.content[hostile.products[0].id] = {
  aboutHtml: '<h2 onclick="alert(1)">Başlıq</h2><script>alert(1)</script><p style="color:red">Mətn</p><iframe src="https://evil.test"></iframe>',
  rulesHtml: '<ul><li><strong>Qayda</strong></li></ul><a href="javascript:alert(1)">Pis link</a>'
};
hostile.siteSections.sertler.body = '<p onmouseover="x()">Qayda</p><script>x()</script>';
const sanitized = normalizeAdminPayload(hostile);
const sanitizedText = JSON.stringify(sanitized);
assert.equal(/<script|<iframe|onclick|onmouseover|javascript:/i.test(sanitizedText), false, "Təhlükəli HTML saxlanıldı");
assert.ok(sanitized.content[hostile.products[0].id].aboutHtml.includes("<h2>Başlıq</h2>"), "Təhlükəsiz başlıq itdi");

const collision = structuredClone(state);
collision.products[1].seoSlug = collision.products[0].seoSlug;
assert.throws(() => normalizeAdminPayload(collision), /slug/i, "Slug toqquşması bloklanmadı");

const patched = patchAppSource(appSource, state);
const roundTrip = extractAdminState(patched);
assert.equal(
  JSON.stringify(roundTrip.products.map((product) => [product.id, product.order])),
  JSON.stringify(orderSnapshot),
  "CMS round-trip məhsul sırasını dəyişdi"
);
assert.equal(
  JSON.stringify(roundTrip.products.map((product) => product.plans)),
  JSON.stringify(state.products.map((product) => product.plans)),
  "CMS round-trip planları dəyişdi"
);

const pages = generateProductPageFiles(state.products, state.siteSections, state.cms, state.content);
const infoPages = generateInfoPageFiles(state.siteSections, state.ui, state.cms);
assert.equal(pages.size, 21);
assert.equal(infoPages.size, 3);
const firstPage = pages.values().next().value;
assert.ok(firstPage.includes(state.cms.commonTexts.order), "Ümumi sifariş mətni məhsul səhifəsinə bağlanmayıb");
assert.ok(firstPage.includes(state.cms.site.brandName.toUpperCase()), "Brend məhsul səhifəsinə bağlanmayıb");

const excluded = structuredClone(state);
excluded.products[0].includeInSitemap = false;
excluded.products[0].seoIndex = false;
const excludedSlug = excluded.products[0].seoSlug;
const sitemap = generateSitemap(excluded.products, excluded.siteSections, new Date("2026-07-28"), excluded.cms);
assert.equal(sitemap.includes(`https://mirpanel.com/${excludedSlug}/`), false, "Noindex məhsul sitemap-da qaldı");

const redirects = generateRedirects(state.products, state.siteSections);
assert.ok(redirects.includes("https://mirpanel.onrender.com/"));
assert.equal(redirects.includes(["mirpanel", "admin.onrender.com"].join("-")), false);
const renamed = structuredClone(state);
const originalSlug = renamed.products[0].seoSlug;
renamed.products[0].seoSlug = `${originalSlug}-yeni`;
const renamedRedirects = generateRedirects(renamed.products, renamed.siteSections, state);
assert.ok(renamedRedirects.includes(`/${originalSlug} /${originalSlug}-yeni/ 301`), "Köhnə məhsul slug redirect-i yaranmadı");
for (const line of renamedRedirects.split(/\r?\n/).filter(Boolean)) {
  const [from, to, status] = line.trim().split(/\s+/);
  if (status === "301") assert.notEqual(from, to, `Redirect loop: ${line}`);
}

for (const file of [
  "../app.js",
  "../mirpanel-admin/product-pages.mjs",
  "../mirpanel-admin/server.mjs",
  "../mirpanel-admin/public/admin.js",
  "../mirpanel-admin/public/cms-admin.js"
]) {
  const text = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const residue = new RegExp([
    ["tokens", "truncated"].join(" "),
    ["Ran", "command"].join(" "),
    ["Stopped", "command"].join(" "),
    `^${["Exit", "code:"].join(" ")}`,
    `^${["Wall", "time:"].join(" ")}`,
    `^${"Out" + "put:"}`
  ].join("|"), "m");
  assert.equal(residue.test(text), false, `${file}: alət çıxışı qalığı`);
}

console.log("PASS: CMS modeli, miqrasiya snapshot-ı, XSS sanitizasiyası, slug, generator və sitemap yoxlamaları.");
