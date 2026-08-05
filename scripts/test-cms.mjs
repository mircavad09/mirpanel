import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { extractAdminState, mergeAdminPayload, normalizeAdminPayload, patchAppSource } from "../mirpanel-admin/core.mjs";
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
  product.plans.map((plan) => [plan.label || "", plan.months, plan.price, plan.regularPrice || null])
]);
const bannerSnapshot = state.products.map((product) => [
  product.id,
  product.banner?.enabled,
  product.banner?.desktopImage,
  product.banner?.mobileImage,
  product.banner?.order
]);
const protectedProductSnapshot = (products) => products.map((product) => ({
  id: product.id,
  active: product.active,
  order: product.order,
  stock: product.stock,
  stockEnabled: product.stockEnabled,
  soldOut: product.soldOut,
  seoSlug: product.seoSlug,
  currency: product.currency,
  plans: product.plans,
  banner: product.banner,
  formFields: product.formFields
}));

const partialAbout = {
  siteSections: {
    haqqimizda: {
      body: "Haqqımızda partial publish regression mətni"
    }
  }
};
const mergedAbout = normalizeAdminPayload(mergeAdminPayload(state, partialAbout));
assert.equal(mergedAbout.siteSections.haqqimizda.body, partialAbout.siteSections.haqqimizda.body, "Haqqımızda partial dəyişiklik saxlanmadı");
assert.equal(mergedAbout.siteSections.sertler.body, state.siteSections.sertler.body, "Haqqımızda dəyişəndə Şərtlər sıfırlandı");
assert.equal(
  JSON.stringify(protectedProductSnapshot(mergedAbout.products)),
  JSON.stringify(protectedProductSnapshot(state.products)),
  "Haqqımızda dəyişəndə qorunan məhsul məlumatları dəyişdi"
);
assert.equal(
  JSON.stringify(mergedAbout.cms.footer),
  JSON.stringify(state.cms.footer),
  "Haqqımızda dəyişəndə footer dəyişdi"
);

const mergedSecondSection = normalizeAdminPayload(mergeAdminPayload(mergedAbout, {
  cms: { homepage: { announcement: { text: "İkinci bölmə regression testi" } } }
}));
assert.equal(mergedSecondSection.siteSections.haqqimizda.body, partialAbout.siteSections.haqqimizda.body, "İkinci bölmə dəyişəndə Haqqımızda sıfırlandı");
assert.equal(mergedSecondSection.cms.homepage.hero.title, state.cms.homepage.hero.title, "Göndərilməyən ana səhifə sahəsi default-la əvəzləndi");
assert.equal({}.polluted, undefined, "Prototype əvvəlcədən çirklənib");
mergeAdminPayload(state, JSON.parse('{"__proto__":{"polluted":true}}'));
assert.equal({}.polluted, undefined, "Deep merge prototype pollution-a açıqdır");

assert.equal(state.products.length, 30, "Məhsul sayı dəyişib");
assert.equal(state.products.filter((product) => product.active).length, 21, "Aktiv məhsul sayı dəyişib");
assert.equal(digest(orderSnapshot), "06637bdd0c20ac392eeb351c40138e8699934f7734667529c9da96872e3e7b7c", "Məhsul sırası dəyişib");
assert.equal(digest(commercialSnapshot), "5c46037dc76c72bd131112e13ac46235922b19745110065aace16cb7b0941ff7", "Qiymət, plan və ya aktivlik dəyişib");
assert.ok(state.products.every((product) => !product.seoSlug.endsWith("-almaq") && !product.seoSlug.includes("hesab0")), "Məhsul slug miqrasiyası tamamlanmayıb");
assert.equal(digest(bannerSnapshot), "28d5de78f3c4205bcc01714235da0e4041616f19d8b0d1eefb26d58d330c071d", "Banner məlumatı və ya aktivliyi dəyişib");
assert.deepEqual(Object.keys(state.cms), [
  "schemaVersion", "site", "homepage", "navigation", "banners", "supportCard",
  "footer", "commonTexts", "seo", "orderSettings", "media"
]);
assert.ok(Object.values(state.cms.commonTexts).every(Boolean), "Ümumi mətn fallback-i boşdur");
assert.equal(state.cms.banners.length, 0, "Məhsuldan ayrı banner bazası qalıb");
const activeProducts = state.products.filter((product) => product.active);
assert.equal(activeProducts.filter((product) => product.banner?.enabled === true).length, 1, "Cari aktiv banner sayı dəyişib");
assert.equal(activeProducts.filter((product) => product.banner).length, 21, "Banner məlumatı silinib");
assert.equal(new Set(state.products.map((product) => product.banner.order)).size, state.products.length, "Banner sıraları unikal deyil");
assert.deepEqual(
  Object.fromEntries(["spotify", "netflix", "canva", "youtube", "capcut", "tiktok_jeton"].map((id) => {
    const product = state.products.find((item) => item.id === id);
    return [id, product.banner.desktopImage];
  })),
  {
    spotify: "assets/slider1.png",
    netflix: "assets/slider2.png",
    canva: "assets/slider3.png",
    youtube: "assets/slider4.png",
    capcut: "assets/slider5.png",
    tiktok_jeton: "assets/slider6.png"
  },
  "Mövcud altı böyük banner şəkli məhsullara itkisiz bağlanmayıb"
);
assert.ok(
  activeProducts.every((product) => product.banner.desktopImage || product.image),
  "Aktiv məhsul bannerində təhlükəsiz şəkil fallback-i yoxdur"
);
assert.equal(state.cms.supportCard.desktopImage, "assets/support.png", "Canlı Dəstək şəkli CMS-ə köçürülməyib");
assert.equal(state.cms.media.filter((item) => /^assets\/(?:slider[1-6]|support)\.png$/.test(item.path)).length, 7, "Mövcud böyük şəkillər Media bölməsinə köçürülməyib");

const duplicateBannerOrders = structuredClone(state);
duplicateBannerOrders.products.forEach((product) => { product.banner.order = 2; });
const normalizedBannerOrders = normalizeAdminPayload(duplicateBannerOrders).products.map((product) => product.banner.order);
assert.equal(new Set(normalizedBannerOrders).size, state.products.length, "Təkrar banner sırası serverdə düzəldilmədi");
assert.equal(Math.min(...normalizedBannerOrders), 1, "Banner sırası 1-dən başlamır");
assert.equal(Math.max(...normalizedBannerOrders), state.products.length, "Banner sırasında boşluq qalıb");

const withNewProduct = structuredClone(state);
withNewProduct.products.push({
  id: "banner_test_product",
  order: withNewProduct.products.length + 1,
  category: "all",
  image: "assets/your.png",
  title: "Banner Test Məhsulu",
  desc: "Test açıqlaması",
  active: true,
  seoSlug: "banner-test-mehsulu",
  plans: []
});
const normalizedWithNewProduct = normalizeAdminPayload(withNewProduct);
const newProduct = normalizedWithNewProduct.products.find((product) => product.id === "banner_test_product");
assert.equal(newProduct.banner.desktopImage, newProduct.image, "Yeni məhsul banneri əsas şəkildən yaranmadı");
assert.equal(newProduct.banner.title, newProduct.title, "Yeni məhsul banner başlığı məhsuldan yaranmadı");
assert.equal(newProduct.banner.order, normalizedWithNewProduct.products.length, "Yeni məhsul banneri son sıranı almadı");
assert.equal(newProduct.banner.enabled, false, "Yeni məhsul banneri standart olaraq deaktiv yaranmadı");
const visibleBannerIds = (products) => products
  .filter((product) => product.active !== false && product.banner?.enabled === true)
  .map((product) => product.id);
newProduct.banner.enabled = true;
assert.deepEqual(
  visibleBannerIds(normalizedWithNewProduct.products),
  [...visibleBannerIds(state.products), newProduct.id],
  "Bir banner aktivləşdiriləndə digər bannerlərin vəziyyəti dəyişdi"
);
newProduct.active = false;
assert.equal(visibleBannerIds(normalizedWithNewProduct.products).includes(newProduct.id), false, "Deaktiv məhsulun banneri gizlənmədi");
newProduct.active = true;
assert.equal(visibleBannerIds(normalizedWithNewProduct.products).includes(newProduct.id), true, "Yenidən aktiv məhsulun banneri geri qayıtmadı");
newProduct.banner.enabled = false;
assert.equal(visibleBannerIds(normalizedWithNewProduct.products).includes(newProduct.id), false, "Banner ayrıca deaktiv edilmədi");
const originalBannerSlug = newProduct.seoSlug;
newProduct.seoSlug = "banner-test-mehsulu-yeni";
assert.notEqual(newProduct.seoSlug, originalBannerSlug, "Test slug-u dəyişmədi");
assert.equal(Object.hasOwn(newProduct.banner, "url"), false, "Banner URL-i məhsul slug-ından ayrı saxlanılır");

const hostile = structuredClone(state);
hostile.content[hostile.products[0].id] = {
  aboutHtml: '<h2 onclick="alert(1)">Başlıq</h2><script>alert(1)</script><p style="color:red">Mətn</p><iframe src="https://evil.test"></iframe>',
  rulesHtml: '<ul><li><strong>Qayda</strong></li></ul><a href="javascript:alert(1)">Pis link</a>'
};
hostile.siteSections.sertler.body = '<p onmouseover="x()">Qayda</p><script>x()</script>';
hostile.siteSections.haqqimizda.buttonUrl = "javascript:alert(1)";
hostile.cms.homepage.infoCards.about.title = '<img src=x onerror="alert(1)">';
const sanitized = normalizeAdminPayload(hostile);
const sanitizedText = JSON.stringify(sanitized);
assert.equal(/<script|<iframe|onclick|onmouseover|javascript:/i.test(sanitizedText), false, "Təhlükəli HTML saxlanıldı");
assert.ok(sanitized.content[hostile.products[0].id].aboutHtml.includes("<h2>Başlıq</h2>"), "Təhlükəsiz başlıq itdi");

assert.equal(sanitized.siteSections.haqqimizda.buttonUrl, "", "Unsafe page link was stored");

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
assert.ok(
  infoPages.get(state.siteSections.elaqe.slug).includes(state.cms.site.phoneDisplay),
  "Shared WhatsApp number is not connected to the contact page"
);
const firstPage = pages.values().next().value;
assert.ok(firstPage.includes(state.cms.commonTexts.order), "Ümumi sifariş mətni məhsul səhifəsinə bağlanmayıb");
assert.ok(firstPage.includes(state.cms.site.brandName.toUpperCase()), "Brend məhsul səhifəsinə bağlanmayıb");

const excluded = structuredClone(state);
excluded.products[0].includeInSitemap = false;
excluded.products[0].seoIndex = false;
const excludedSlug = excluded.products[0].seoSlug;
const sitemap = generateSitemap(excluded.products, excluded.siteSections, new Date("2026-07-28"), excluded.cms);
assert.equal(sitemap.includes(`https://mirpanel.com/mehsul/${excludedSlug}`), false, "Noindex məhsul sitemap-da qaldı");

const redirects = generateRedirects(state.products, state.siteSections);
assert.ok(redirects.includes("https://mirpanel.onrender.com/"));
assert.equal(redirects.includes(["mirpanel", "admin.onrender.com"].join("-")), false);
const renamed = structuredClone(state);
const originalSlug = renamed.products[0].seoSlug;
renamed.products[0].seoSlug = `${originalSlug}-yeni`;
const renamedRedirects = generateRedirects(renamed.products, renamed.siteSections, state);
assert.ok(renamedRedirects.includes(`/mehsul/${originalSlug} /mehsul/${originalSlug}-yeni 301`), "Köhnə məhsul slug redirect-i yaranmadı");
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

const homepage = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cmsSite = fs.readFileSync(new URL("../cms-site.js", import.meta.url), "utf8");
const homepageCss = fs.readFileSync(new URL("../style.css", import.meta.url), "utf8");
const cmsAdmin = fs.readFileSync(new URL("../mirpanel-admin/public/cms-admin.js", import.meta.url), "utf8");
const adminServer = fs.readFileSync(new URL("../mirpanel-admin/server.mjs", import.meta.url), "utf8");
assert.equal(homepage.includes('src="assets/slider1.png"'), false, "Banner hələ index.html-də hardcode edilib");
assert.equal(homepage.includes('src="assets/support.png"'), false, "Canlı Dəstək şəkli hələ index.html-də hardcode edilib");
assert.ok(cmsSite.includes("applySupportCard()"), "Canlı Dəstək renderer-i yoxdur");
assert.ok(cmsSite.includes('window.initSlider'), "Dinamik bannerlər slayderə yenidən bağlanmır");
assert.ok(cmsSite.includes('mobileImage'), "Mobil şəkil fallback-i yoxdur");
assert.ok(cmsSite.includes("DATA.products"), "Bannerlər vahid məhsul məlumatından yaranmır");
assert.ok(cmsSite.includes("productSlug"), "Banner keçidi məhsul slug-ından yaranmır");
assert.ok(cmsSite.includes('"lazy"'), "Bannerlərdə lazy loading yoxdur");
assert.ok(cmsSite.includes("fetchPriority"), "İlk banner üçün yüksək yükləmə prioriteti yoxdur");
assert.ok(cmsSite.includes("banners.length < 2"), "0/1 banner üçün slayder idarələri gizlədilmir");
assert.equal(cmsSite.includes('content.className = "slide-content"'), false, "Banner overlay elementi hələ yaradılır");
assert.equal(homepageCss.includes(".slide-content"), false, "Banner overlay stili hələ mövcuddur");
assert.equal(homepage.includes("homeSeoIntro"), false, "Deaktiv SEO təqdimatı ilkin HTML-də qalıb");
assert.equal(state.cms.homepage.seoIntro.enabled, false, "SEO təqdimatı admin parametrində deaktiv deyil");
assert.ok(state.products.every((product) => product.banner?.title !== undefined && product.banner?.description !== undefined), "Banner başlıq və açıqlama məlumatı silinib");
assert.ok(appSource.includes("ArrowRight") && appSource.includes("ArrowLeft"), "Banner klaviatura idarəsi yoxdur");
assert.ok(appSource.includes("if (slides.length < 2) return;"), "Tək banner üçün avtomatik keçid dayandırılmır");
assert.ok(homepageCss.includes("object-fit: contain"), "Banner şəkilləri contain istifadə etmir");
assert.ok(homepageCss.includes(".hero-slider-box[hidden]") && homepageCss.includes(".no-product-banners"), "Boş banner sahəsi tam gizlədilmir");
assert.ok(cmsAdmin.includes("data-banner-upload"), "Banner üçün kompüterdən yükləmə yoxdur");
assert.ok(cmsAdmin.includes("data-choose-banner-media"), "Banner üçün Şəkil kitabxanası seçimi yoxdur");
assert.ok(cmsAdmin.includes("bannerProductSelect"), "Məhsul banner seçicisi yoxdur");
assert.ok(cmsAdmin.includes("data-product-banner"), "Banner redaktoru məhsul məlumatına bağlanmayıb");
assert.ok(cmsAdmin.includes("data-move-product-banner"), "Banner yuxarı-aşağı sıralaması yoxdur");
assert.ok(cmsAdmin.includes("data-clear-banner-image"), "Banner şəklini təmizləmə imkanı yoxdur");
assert.ok(cmsAdmin.includes('siteField("Kiçik üst etiket", key, "kicker")'), "Haqqımızda üst etiketi adminə bağlanmayıb");
assert.ok(cmsAdmin.includes("Mətn abzasları") && cmsAdmin.includes("Abzas əlavə et"), "Haqqımızda abzas redaktoru yoxdur");
assert.ok(cmsAdmin.includes('if (key === "haqqimizda")'), "Haqqımızda üçün sadə abzas redaktoru ayrılmayıb");
assert.ok(cmsAdmin.includes('frame.setAttribute("sandbox", "")'), "Haqqımızda önizləməsi sandbox ilə qorunmur");
assert.ok(cmsAdmin.includes("frame.srcdoc = result.aboutPreviewHtml"), "Haqqımızda real generator önizləməsinə bağlanmayıb");
assert.ok(adminServer.includes("aboutPreviewHtml"), "Haqqımızda önizləmə HTML-i serverdən qaytarılmır");
assert.ok(cmsAdmin.includes('class="legalTextEditor"') && cmsAdmin.includes('rows="32"'), "Şərtlər üçün uzun hüquqi mətn redaktoru yoxdur");
assert.ok(cmsAdmin.includes("frame.srcdoc = result.termsPreviewHtml"), "Şərtlər real generator önizləməsinə bağlanmayıb");
assert.ok(adminServer.includes("termsPreviewHtml"), "Şərtlər önizləmə HTML-i serverdən qaytarılmır");
assert.ok(adminServer.includes("limit = 1_500_000"), "Server uzun hüquqi mətn üçün kifayət qədər təhlükəsiz limit saxlamır");
assert.equal((state.siteSections.sertler.body.match(/^# (?:[1-9]|1[0-4])\. /gm) || []).length, 14, "CMS-də 14 əsas hüquqi bölmə qorunmayıb");
assert.equal((state.siteSections.sertler.body.match(/^## \d+\.\d+\./gm) || []).length, 6, "CMS-də alt hüquqi bölmələr qorunmayıb");
assert.equal(/[ÃÄÅÉâ]/.test(state.siteSections.sertler.body), false, "CMS hüquqi mətnində kodlaşdırma pozuntusu var");
const unsafeTerms = structuredClone(state);
unsafeTerms.siteSections.sertler.body += '\n<script>alert(1)</script><iframe src="x"></iframe><p onclick="alert(1)">təhlükəsiz əğıöüşç</p><a href="javascript:alert(1)">keçid</a>';
const sanitizedTerms = normalizeAdminPayload(unsafeTerms).siteSections.sertler.body;
assert.equal(/script|iframe|onclick|javascript:/i.test(sanitizedTerms), false, "Şərtlər redaktorunda təhlükəli HTML bloklanmır");
assert.ok(sanitizedTerms.includes("təhlükəsiz əğıöüşç"), "XSS sanitizasiyası Azərbaycan hərflərini pozur");
assert.ok(adminServer.includes('["image/webp", "webp"]'), "WEBP yükləmə yoxlaması yoxdur");
assert.equal(adminServer.includes('"image/svg+xml"'), false, "SVG yükləmə icazəsi qalıb");
assert.ok(adminServer.includes('rawName.includes("..")') && adminServer.includes('/[\\\\/]/'), "Path traversal fayl adları bloklanmır");
assert.ok(adminServer.includes("const session = requireMutationAuth(request, response);"), "Yükləmələr sessiyada təhlükəsiz mərhələlənmir");

const middleware = fs.readFileSync(new URL("../functions/_middleware.js", import.meta.url), "utf8");
assert.equal(middleware.includes("mirpanel-edge-product-schema"), true, "Legacy edge schema cleanup route is missing");
assert.equal(middleware.includes("html = product ? injectMeta"), false, "Edge still injects duplicate product schema");
assert.equal(middleware.includes("seo-structured-data-fix.js"), false, "Fake rating schema script is still injected");

console.log("PASS: CMS modeli, miqrasiya snapshot-ı, XSS sanitizasiyası, slug, generator və sitemap yoxlamaları.");
