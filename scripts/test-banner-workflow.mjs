import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAdminState, normalizeAdminPayload } from "../mirpanel-admin/core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const state = extractAdminState(read("app.js"));
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const commercialBefore = hash(state.products.map((product) => ({
  id: product.id,
  slug: product.seoSlug,
  plans: product.plans,
  order: product.order,
  stock: product.stock,
  stockEnabled: product.stockEnabled,
  active: product.active
})));
const otherCmsBefore = hash({
  about: state.siteSections.haqqimizda,
  contact: state.siteSections.elaqe,
  terms: state.siteSections.sertler,
  seo: state.cms.seo,
  orders: state.cms.orderSettings
});

const cleared = structuredClone(state);
cleared.products[0].banner.desktopImage = "";
const normalizedCleared = normalizeAdminPayload(cleared);
assert.equal(normalizedCleared.products[0].banner.desktopImage, "", "Silinmiş əsas banner serverdə köhnə şəkillə bərpa edildi");
assert.equal(normalizedCleared.products[0].banner.mobileImage, cleared.products[0].banner.mobileImage, "Mobil override dəyişdi");

const isolated = structuredClone(state);
const untouchedBanners = hash(isolated.products.slice(1).map((product) => product.banner));
isolated.products[0].banner.alt = "Banner workflow test";
const normalizedIsolated = normalizeAdminPayload(isolated);
assert.equal(hash(normalizedIsolated.products.slice(1).map((product) => product.banner)), untouchedBanners, "Bir banner dəyişikliyi başqa bannerləri dəyişdi");

const future = structuredClone(state);
const futureProduct = structuredClone(future.products[0]);
futureProduct.id = "future_banner_test";
futureProduct.seoSlug = "future-banner-test";
futureProduct.title = "Future Banner Test";
futureProduct.order = future.products.length + 1;
delete futureProduct.banner;
future.products.push(futureProduct);
const normalizedFuture = normalizeAdminPayload(future).products.find((product) => product.id === futureProduct.id);
assert.equal(normalizedFuture.banner.enabled, false, "Yeni məhsul banneri standart deaktiv yaranmadı");
assert.equal(normalizedFuture.banner.desktopImage, normalizedFuture.image, "Yeni məhsul banneri əsas məhsul şəklini almadı");

const admin = read("mirpanel-admin/public/cms-admin.js");
const server = read("mirpanel-admin/server.mjs");
const site = read("cms-site.js");
assert.ok(admin.includes("Banner şəkli") && admin.includes("Mobil üçün ayrıca şəkil"), "Sadə əsas banner və mobil override UI-si yoxdur");
assert.ok(admin.includes("Şəkil kitabxanasından seç") && admin.includes("Kitabxanadan şəkil seçilməyib"), "Şəkil kitabxanası mətni aydın deyil");
assert.ok(admin.includes("saveBannerDraft") && admin.includes("/api/admin/banner-draft"), "Banner Yadda saxla real draft endpoint-inə bağlı deyil");
assert.ok(server.includes("session.draft") && server.includes("draftConflict"), "Draft və SHA konflikt qoruması yoxdur");
assert.ok(server.includes("session.pendingUploads") && server.includes("files.set(filePath, buffer)"), "Şəkil və generator nəticəsi atomik commit-ə daxil edilmir");
assert.ok(server.includes("crypto.randomBytes(4)") && server.includes("const stamp = Date.now()"), "Eyni adlı şəkillər üçün unikal fayl yolu yoxdur");
assert.ok(server.includes("bannerImage") && server.includes("contentType") && server.includes("imageLive"), "Canlı banner şəkli status/MIME yoxlaması yoxdur");
assert.ok(site.includes("safeImage(banner.desktopImage) || safeImage(product.image)"), "Əsas banner silindikdə məhsul şəkli fallback-i yoxdur");
assert.ok(site.includes("if (mobileImage)"), "Mobil override yalnız seçildikdə işləmir");

assert.equal(commercialBefore, hash(state.products.map((product) => ({
  id: product.id,
  slug: product.seoSlug,
  plans: product.plans,
  order: product.order,
  stock: product.stock,
  stockEnabled: product.stockEnabled,
  active: product.active
}))), "Kommersiya snapshot-ı dəyişdi");
assert.equal(otherCmsBefore, hash({
  about: state.siteSections.haqqimizda,
  contact: state.siteSections.elaqe,
  terms: state.siteSections.sertler,
  seo: state.cms.seo,
  orders: state.cms.orderSettings
}), "Əlaqəsiz CMS snapshot-ı dəyişdi");

console.log("PASS: banner fallback, mobil override, yeni məhsul, atomik upload/publish, SHA konflikt və kommersiya snapshot yoxlamaları.");
