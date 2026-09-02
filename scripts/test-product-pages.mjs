import assert from "node:assert/strict";
import crypto from "node:crypto";
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
  generateProductListingPageFiles,
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
const cmsAdminSource = fs.readFileSync(path.join(projectRoot, "mirpanel-admin", "public", "cms-admin.js"), "utf8");
const confirmationSource = fs.readFileSync(path.join(projectRoot, "order-confirmation.js"), "utf8");
const homeHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const robotsText = fs.readFileSync(path.join(projectRoot, "robots.txt"), "utf8");
const state = extractAdminState(appSource);
const active = activeProductsWithSlugs(state.products);
const pages = generateProductPageFiles(state.products, state.siteSections, state.cms);
const infoPages = generateInfoPageFiles(state.siteSections, state.ui, state.cms);
const listingHtml = generateProductListingPageFiles(state.products, state.siteSections, state.cms).get("mehsul.page");
const sitemap = generateSitemap(state.products, state.siteSections, new Date("2026-07-24T00:00:00Z"), state.cms);
const redirects = generateRedirects(state.products, state.siteSections);
const activeTitles = [];
const activeDescriptions = [];
const legacyById = {
  capcut: "capcut-pro-almaq", hbomax: "hbo-max-almaq", netflix: "netflix-sexsi-almaq",
  netflix_umumi: "netflix-umumi-almaq", zoom: "zoom-pro-almaq", youtube: "youtube-premium-almaq",
  spotify: "spotify-premium-almaq", surfshark: "surfshark-vpn-almaq", tiktok_jeton: "tiktok-jeton-almaq",
  google_ai: "google-ai-pro-v3-almaq", google_ai_ultra: "google-ai-pro-ultra-almaq", captions: "captions-ai-almaq",
  grok_supergrok: "grok-ai-almaq", claude_ai: "cloud-ai-pro-almaq", prime: "amazon-prime-video-almaq",
  duolingo: "duolingo-super-almaq", canva: "canva-premium-almaq", chatgpt: "chatgpt-plus-almaq",
  adobecc: "adobe-creative-cloud-almaq", chatgpt_ortaq: "chatgpt-plus-ortaq-hesab0-almaq",
  youtube_sexsi: "youtube-eyni-hesab-almaq"
};

assert.equal(appSource.includes(`tokens ${"truncated"}`), false);
assert.equal(appSource.includes(`${408}${77}`), false);
assert.equal(active.length, 22);
assert.equal(pages.size, active.length);
assert.ok(cmsAdminSource.includes("Sosial paylaşım şəkli"), "Admin sosial paylaşım şəkli sahəsi yoxdur");
assert.ok(listingHtml.includes('rel="canonical" href="https://mirpanel.com/mehsul"'));
assert.ok(listingHtml.includes("<title>Premium rəqəmsal məhsullar | Mirpanel</title>"));
assert.ok(listingHtml.includes("<h1>Premium rəqəmsal məhsullar</h1>"));
assert.ok(listingHtml.includes('"@type":"ItemList"'), "Məhsul siyahısında ItemList yoxdur");
assert.ok(listingHtml.includes('"@type":"BreadcrumbList"'), "Məhsul siyahısında BreadcrumbList yoxdur");
assert.equal((listingHtml.match(/class="card"/g) || []).length, active.length, "Aktiv məhsulların hamısı siyahıda olmalıdır");
assert.deepEqual([...listingHtml.matchAll(/data-product-id="([^"]+)"/g)].map((match) => match[1]), active.map(({ product }) => product.id), "Məhsul sırası dəyişib");
const simulatedProducts = [...state.products, { ...structuredClone(state.products[0]), id: "future_product_test", title: "Future product test", seoSlug: "future-product-test", order: 999 }];
assert.ok(generateProductListingPageFiles(simulatedProducts, state.siteSections, state.cms).get("mehsul.page").includes('data-product-id="future_product_test"'), "Yeni aktiv məhsul avtomatik görünmədi");
simulatedProducts.at(-1).active = false;
assert.equal(generateProductListingPageFiles(simulatedProducts, state.siteSections, state.cms).get("mehsul.page").includes('data-product-id="future_product_test"'), false, "Deaktiv məhsul siyahıda qaldı");

const aboutHtml = infoPages.get("haqqimizda");
const aboutSection = state.siteSections.haqqimizda;
const migratedAboutSource = aboutSection.blocks.map((block) => block.text).join("\n\n");
assert.equal(aboutSection.blocks.length, 5, "Haqqımızda məzmun bloklarının sayı");
assert.ok(aboutSection.blocks.every((block) => block.text.trim()), "Haqqımızda boş məzmun bloku qalıb");
assert.equal(migratedAboutSource.length, 2743, "Haqqımızda məzmunu kəsilib");
assert.equal(crypto.createHash("sha256").update(migratedAboutSource).digest("hex"), "0aeef190f211da58e298ee829c467fd885881fd4a2afb18ba8c0b0fb6c940601", "Tarixi Haqqımızda məzmunu semantik olaraq dəyişib");
assert.ok(aboutSection.seoDescription.length >= 120 && aboutSection.seoDescription.length <= 160, "Haqqımızda SEO description 120–160 simvol deyil");
assert.equal(/\*\*|^\s*#{1,6}\s/m.test(aboutSection.seoDescription), false, "Haqqımızda SEO description Markdown saxlayır");
assert.ok(aboutHtml, "Haqqımızda səhifəsi yaradılmadı");
assert.equal((aboutHtml.match(/<h1\b/g) || []).length, 1, "Haqqımızda səhifəsində bir H1 olmalıdır");
assert.ok(aboutHtml.includes('info-page-document info-page-document--about'), "Haqqımızda səhifəsi ayrıca dizayn sinfini almadı");
assert.ok(aboutHtml.includes('class="info-page-card info-page-card--about"'), "Haqqımızda geniş məzmun sinfini almadı");
assert.ok(aboutHtml.includes('<p class="info-page-kicker">Haqqımızda</p>'), "Haqqımızda üst etiketi");
assert.equal(aboutHtml.includes("**MirPanel**"), false, "Haqqımızda səhifəsində Markdown qalığı var");
assert.equal(/<p>\s*#{1,6}\s/.test(aboutHtml), false, "Haqqımızda səhifəsində başlıq Markdown qalığı var");
assert.equal((aboutHtml.match(/<h2\b/g) || []).length, 0, "Haqqımızda səhifəsində böyük bölmə başlığı qalıb");
assert.equal(aboutHtml.includes("about-page-lead"), false, "Haqqımızda ortalanmış giriş mətni qalıb");
assert.equal(aboutHtml.includes("info-page-actions"), false, "Haqqımızda daxili düymələri qalıb");
assert.equal(aboutHtml.includes("about-page-sections"), false, "Haqqımızda məzmunu ayrıca dizayn bloklarına bölünüb");
assert.ok(aboutHtml.includes('rel="canonical" href="https://mirpanel.com/haqqimizda"'), "Haqqımızda canonical dəyişib");
const formattedSections = structuredClone(state.siteSections);
formattedSections.haqqimizda.blocks = [{ text: "**MirPanel** haqqında [Əlaqə səhifəsindən](/elaqe) məlumat alın.", order: 1 }];
const formattedAbout = generateInfoPageFiles(formattedSections, state.ui, state.cms).get("haqqimizda");
assert.ok(((formattedAbout.match(/<div class="info-page-copy about-page-copy">[\s\S]*?<\/div>/) || [""])[0].match(/<p>/g) || []).length >= 1, "Haqqımızda məzmunu ardıcıl abzaslarla göstərilmir");
assert.ok(formattedAbout.includes("<strong>MirPanel</strong>"), "Qalın Markdown real HTML-ə çevrilmədi");
assert.ok(formattedAbout.includes('<a href="/elaqe">Əlaqə səhifəsindən</a>'), "Admin daxili keçidi real HTML-ə çevrilmədi");

const editedState = structuredClone(state);
editedState.siteSections.haqqimizda.blocks[0].text += "\n\nMiqrasiya regression sınağı.";
const reloadedEditedState = extractAdminState(patchAppSource(appSource, normalizeAdminPayload(editedState)));
assert.equal(reloadedEditedState.siteSections.haqqimizda.blocks[0].text, editedState.siteSections.haqqimizda.blocks[0].text, "Admin redaktə → publish → reload zamanı Haqqımızda məzmunu sıfırlandı");
assert.equal(JSON.stringify(reloadedEditedState.siteSections.elaqe), JSON.stringify(state.siteSections.elaqe), "Haqqımızda publish Əlaqə məlumatını dəyişdi");
assert.equal(JSON.stringify(reloadedEditedState.siteSections.sertler), JSON.stringify(state.siteSections.sertler), "Haqqımızda publish Şərtlər məlumatını dəyişdi");

const unsafeState = structuredClone(state);
unsafeState.siteSections.haqqimizda.blocks[0].text += '\n\n<script>alert(1)</script><iframe src="https://example.com"></iframe>[təhlükəli](javascript:alert(1))';
const safeState = normalizeAdminPayload(unsafeState);
const safeAboutHtml = generateInfoPageFiles(safeState.siteSections, safeState.ui, safeState.cms).get("haqqimizda");
const safeAboutCopy = safeAboutHtml.match(/<div class="info-page-copy about-page-copy">([\s\S]*?)<\/div>/)?.[1] || "";
assert.equal(/<script|<iframe|href=["']javascript:/i.test(safeAboutCopy), false, "Haqqımızda XSS sanitizasiyası uğursuzdur");

const termsHtml = infoPages.get("sertler");
const termsBody = state.siteSections.sertler.body;
assert.ok(termsHtml, "Şərtlər səhifəsi yaradılmadı");
assert.equal((termsHtml.match(/<h1\b/g) || []).length, 1, "Şərtlər səhifəsində bir H1 olmalıdır");
assert.equal((termsHtml.match(/<h2 id="sertler-(?:[1-9]|1[0-4])">/g) || []).length, 14, "14 əsas hüquqi bölmə göstərilməlidir");
assert.equal((termsHtml.match(/<h3 id="sertler-\d+-\d+">/g) || []).length, 6, "Bütün alt bölmələr H3 kimi göstərilməlidir");
assert.equal((termsHtml.match(/<li><a href="#sertler-(?:[1-9]|1[0-4])">/g) || []).length, 14, "Mündəricatda 14 bölmə olmalıdır");
assert.ok(termsHtml.includes('info-page-document--terms'), "Şərtlər üçün ayrıca responsive dizayn sinfi yoxdur");
assert.ok(termsHtml.includes('<p class="info-page-kicker">Şərtlər</p>'), "Şərtlər üst etiketi yoxdur");
assert.ok(termsHtml.includes('<a href="https://mirpanel.com/">https://mirpanel.com/</a>'), "Canonical daxili sayt keçidi düzgün çevrilməyib");
assert.equal(/target=["']_blank/.test(termsHtml), false, "Şərtlər səhifəsində keçid yeni tab açır");
assert.equal(/[ÃÄÅÉâ]/.test(termsHtml), false, "Şərtlər səhifəsində kodlaşdırma pozuntusu var");
assert.equal(/\*\*/.test(termsHtml) || /^\s*#{1,6}\s/m.test(termsHtml), false, "Şərtlər səhifəsində Markdown işarəsi görünür");
assert.ok(/[əıöüşçğƏİÖÜŞÇĞ]/.test(termsHtml), "Azərbaycan hərfləri qorunmayıb");
assert.ok(termsHtml.includes('rel="canonical" href="https://mirpanel.com/sertler"'), "Şərtlər canonical dəyişib");
assert.ok(termsHtml.includes('name="robots" content="index, follow"'), "Şərtlər səhifəsi indekslənə bilmir");

const normalizeLegalText = (value) => String(value || "")
  .replace(/^#\s+MIRPANEL\.COM[^\n]*\n+/i, "")
  .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/^[-*+]\s+/gm, "")
  .replace(/\*\*|__/g, "")
  .replace(/\*([^*\n]+)\*/g, "$1")
  .replace(/\s+/g, " ")
  .trim();
const termsCopy = termsHtml.match(/<div class="info-page-copy terms-page-copy" id="terms-top">([\s\S]*?)<\/div>/)?.[1] || "";
const generatedLegalText = termsCopy
  .replace(/<\/(?:p|h2|h3|li|ul)>/g, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
  .replace(/\s+/g, " ")
  .trim();
assert.equal(generatedLegalText, normalizeLegalText(termsBody), "Hüquqi mətn HTML-ə çevrilərkən məzmun itirib və ya dəyişib");

for (const { product, slug } of active) {
  const filePath = `mehsul/${slug}.page`;
  const canonical = `https://mirpanel.com/mehsul/${slug}`;
  const html = pages.get(filePath);
  const expectedTitle = String(product.seoTitle || "").trim() || `${String(product.title || "").trim()} | Mirpanel`;
  const expectedDescription =
    String(product.seoDescription || "").trim() ||
    String(product.desc || "").trim() ||
    `${String(product.title || "").trim()} üçün mövcud planları və qiymətləri Mirpanel-də yoxlayın.`;
  activeTitles.push(expectedTitle);
  activeDescriptions.push(expectedDescription);
  assert.ok(html, `${filePath} yaradılmayıb`);
  assert.ok(fs.existsSync(path.join(projectRoot, String(product.image).split("?")[0].replace(/^\/+/, ""))), `${filePath}: məhsul şəkli tapılmadı`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${filePath}: H1 sayı`);
  assert.ok(html.includes(`<title>${escapeHtml(expectedTitle)}</title>`), `${filePath}: title`);
  assert.ok(html.includes(`name="description" content="${escapeAttribute(expectedDescription)}"`), `${filePath}: description`);
  assert.ok(html.includes(`rel="canonical" href="${canonical}"`), `${filePath}: canonical`);
  assert.ok(html.includes(`name="robots" content="index, follow"`), `${filePath}: robots`);
  assert.ok(html.includes(`name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"`), `${filePath}: viewport`);
  assert.ok(html.includes(`/product-page.css?v=20260724-mobile-pricing-1`), `${filePath}: scoped CSS`);
  assert.ok(html.includes(`/app.js?v=product-pages-20260724-refine-1`), `${filePath}: product data cache version`);
  assert.ok(html.includes(`/order-confirmation.js?v=checkout-recovery-20260902-1`), `${filePath}: shared confirmation component`);
  assert.ok(!html.includes("hbo-max-order-fix.js"), `${filePath}: legacy product-specific order handler must not override the shared flow`);
  assert.ok(html.includes(`property="og:url" content="${canonical}"`), `${filePath}: Open Graph`);
  const expectedSocialTitle = String(product.seoOgTitle || product.title || "").trim();
  const expectedSocialDescription = String(product.seoOgDescription || product.desc || expectedDescription).trim();
  const socialImage = html.match(/<meta property="og:image" content="([^"]+)">/)?.[1] || "";
  const expectedImageType = /\.jpe?g(?:[?#]|$)/i.test(product.seoOgImage || product.image)
    ? "image/jpeg"
    : /\.webp(?:[?#]|$)/i.test(product.seoOgImage || product.image) ? "image/webp" : "image/png";
  assert.ok(html.includes('<meta property="og:type" content="product">'), `${filePath}: og:type`);
  assert.ok(html.includes(`property="og:title" content="${escapeAttribute(expectedSocialTitle)}"`), `${filePath}: og:title`);
  assert.ok(html.includes(`property="og:description" content="${escapeAttribute(expectedSocialDescription)}"`), `${filePath}: og:description`);
  assert.match(socialImage, /^https:\/\/mirpanel\.com\/.+\?[^"\s]*social=/, `${filePath}: versioned absolute og:image`);
  assert.ok(html.includes(`property="og:image:secure_url" content="${socialImage}"`), `${filePath}: og:image:secure_url`);
  assert.ok(html.includes(`property="og:image:type" content="${expectedImageType}"`), `${filePath}: og:image:type`);
  assert.ok(html.includes('property="og:image:width" content="1200"'), `${filePath}: og:image:width`);
  assert.ok(html.includes('property="og:image:height" content="630"'), `${filePath}: og:image:height`);
  assert.ok(html.includes(`property="og:image:alt" content="${escapeAttribute(product.imageAlt || product.title)}"`), `${filePath}: og:image:alt`);
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'), `${filePath}: twitter:card`);
  assert.ok(html.includes(`name="twitter:title" content="${escapeAttribute(expectedSocialTitle)}"`), `${filePath}: twitter:title`);
  assert.ok(html.includes(`name="twitter:description" content="${escapeAttribute(expectedSocialDescription)}"`), `${filePath}: twitter:description`);
  assert.ok(html.includes(`name="twitter:image" content="${socialImage}"`), `${filePath}: twitter:image`);
  assert.ok(html.includes(`alt="${escapeAttribute(product.title)}"`), `${filePath}: image alt`);
  assert.ok(html.includes(`data-product-id="${escapeAttribute(product.id)}"`), `${filePath}: product id`);
  assert.ok(html.includes(`id="pp-order-btn"`), `${filePath}: order button`);
  assert.ok(html.includes(`>Məhsul haqqında</a>`), `${filePath}: about scroll button`);
  assert.ok(html.includes(`>Sifariş et</button>`), `${filePath}: order button text`);
  assert.ok(html.includes(`>Müddət seçin</h2>`), `${filePath}: plan heading`);
  assert.ok(html.includes(`7/24 anında təqdim edilir`), `${filePath}: delivery text`);
  assert.equal(html.includes(`class="product-page-back"`), false, `${filePath}: back link removed`);
  assert.equal((html.match(/<svg aria-hidden="true"/g) || []).length, 5, `${filePath}: menu icons`);
  assert.ok(html.includes(`href="/haqqimizda"`), `${filePath}: about link`);
  assert.ok(html.includes(`href="/sertler"`), `${filePath}: terms link`);
  assert.ok(html.includes(`href="/elaqe"`), `${filePath}: contact link`);
  assert.ok(html.includes(`id="product-about"`), `${filePath}: stable about target`);
  assert.ok(html.includes(`data-product-tab="about"`), `${filePath}: about tab`);
  assert.ok(html.includes(`data-product-tab="rules"`), `${filePath}: rules tab`);
  assert.ok(html.includes(`class="product-page-layout"`), `${filePath}: two-column layout`);
  assert.ok(html.includes(`class="product-page-similar-list"`), `${filePath}: similar products`);
  assert.ok(html.includes(`class="product-page-similar-more"`), `${filePath}: mobile more-products link`);
  assert.ok(html.includes(`src="${escapeAttribute(rootRelativeUrl(product.image))}"`), `${filePath}: root-relative image`);
  assert.ok(/id="pp-main-img"[^>]*width="1200"[^>]*height="1200"[^>]*fetchpriority="high"/.test(html), `${filePath}: main image dimensions/priority`);
  assert.equal(/id="pp-main-img"[^>]*loading="lazy"/.test(html), false, `${filePath}: main image must not be lazy`);
  assert.ok(html.includes(`class="product-page-breadcrumb"`), `${filePath}: visible breadcrumb`);
  assert.ok(html.includes(`class="product-page-faq"`), `${filePath}: FAQ`);
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
  assert.equal(productSchema.url, canonical, `${filePath}: schema URL`);
  assert.equal(productSchema.image[0], absoluteUrl(product.image), `${filePath}: schema image`);
  assert.ok(Array.isArray(productSchema.offers), `${filePath}: offers`);
  assert.equal(productSchema.offers.length, product.plans.length, `${filePath}: offer count`);
  assert.ok(productSchema.offers.every((offer) => offer["@type"] === "Offer"), `${filePath}: Offer type`);
  assert.ok(productSchema.offers.every((offer) => offer.priceCurrency === "AZN"), `${filePath}: currency`);
  assert.ok(productSchema.offers.every((offer) => offer.seller?.name === state.cms.site.brandName), `${filePath}: seller`);
  assert.ok(breadcrumb, `${filePath}: BreadcrumbList`);
  assert.equal(breadcrumb.itemListElement.length, 3, `${filePath}: breadcrumb depth`);
  assert.equal(html.includes("AggregateRating"), false, `${filePath}: fake aggregate rating`);
  assert.equal(html.includes('"@type":"Review"'), false, `${filePath}: fake review`);

  const sitemapUrl = canonical;
  assert.equal(count(sitemap, `<loc>${sitemapUrl}</loc>`), 1, `${filePath}: sitemap təkrarı`);
  assert.ok(
    !redirects.split(/\r?\n/).some((line) => line.startsWith(`/mehsul/${slug} `)),
    `${filePath}: canonical məhsul URL-i _redirects qaydasına düşməməlidir`
  );
  const legacySlug = legacyById[product.id];
  assert.ok(legacySlug, `${product.id}: legacy URL xəritəsi yoxdur`);
  assert.ok(redirects.includes(`/${legacySlug} /mehsul/${slug} 301`), `${filePath}: slash-sız köhnə URL 301`);
  assert.ok(redirects.includes(`/${legacySlug}/ /mehsul/${slug} 301`), `${filePath}: slash-lı köhnə URL 301`);
  assert.ok(html.includes(`item":"${canonical}`) || html.includes(`item":"${canonical}"`), `${filePath}: breadcrumb URL`);
  assert.ok(fs.existsSync(path.join(projectRoot, filePath)), `${filePath}: disk`);
}

assert.equal(new Set(activeTitles).size, activeTitles.length, "Aktiv məhsullarda təkrar title var");
assert.equal(new Set(activeDescriptions).size, activeDescriptions.length, "Aktiv məhsullarda təkrar description var");
assert.ok(active.every(({ product }) => product.seoH1 && product.seoPrimaryKeyword), "Admin SEO H1/açar ifadə fallback-i boşdur");
const sitemapLocs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(new Set(sitemapLocs).size, sitemapLocs.length, "Sitemap-da təkrar URL var");
assert.ok(sitemapLocs.every((url) => url.startsWith("https://mirpanel.com/")), "Sitemap HTTPS qaydasını pozur");
assert.equal(sitemapLocs.filter((url) => url.includes("/mehsul/")).length, 21, "Sitemap-da 21 məhsul URL-si olmalıdır");
assert.ok(sitemapLocs.filter((url) => url.includes("/mehsul/")).every((url) => !url.endsWith("/") && !url.includes("-almaq")), "Məhsul sitemap URL-ləri slash-sız və təmiz olmalıdır");
assert.ok(robotsText.includes("User-agent: *") && !robotsText.includes("Disallow: /\n"), "robots.txt ümumi saytı bloklayır");
assert.ok(robotsText.includes("Disallow: /admin") && robotsText.includes("Disallow: /api/"), "Texniki yollar robots.txt-də bloklanmayıb");
assert.ok(homeHtml.includes('rel="canonical" href="https://mirpanel.com/"'), "Home canonical yoxdur");
assert.equal((homeHtml.match(/<h1\b/g) || []).length, 1, "Ana səhifədə bir H1 olmalıdır");
assert.ok(homeHtml.includes('<h1 class="premium-brand-text">MIRPANEL</h1>'), "Ana səhifə MIRPANEL H1 yoxdur");
assert.equal(homeHtml.includes("homeSeoIntro"), false, "Deaktiv SEO təqdimatı ilkin HTML-də qalıb");
assert.equal(homeHtml.includes("Populyar seçimlər"), false, "Deaktiv SEO keçidləri ilkin HTML-də qalıb");
assert.ok(homeHtml.includes('href="/mehsul"'), "Ana səhifədə məhsullar siyahısına HTML keçidi yoxdur");
assert.ok(appSource.includes('href="/mehsul/${productSlug}"'), "Məhsul kartlarının birbaşa HTML keçidi yoxdur");
const homeSchemaText = homeHtml.match(/<script id="mirpanel-home-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
const homeGraph = JSON.parse(homeSchemaText)["@graph"];
assert.ok(homeGraph.some((item) => item["@type"] === "Organization"), "Organization schema yoxdur");
assert.ok(homeGraph.some((item) => item["@type"] === "WebSite"), "WebSite schema yoxdur");

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
assert.ok(confirmationSource.includes('class="orderConfirmationTitle"'), "Confirmation title component");
assert.ok(confirmationSource.includes('class="orderConfirmationTerms"'), "Scrollable confirmation terms block");
assert.ok(confirmationSource.includes('class="orderConfirmationWarningIcon"'), "Warning icon");
assert.ok(confirmationSource.includes('"Oxudum və təsdiqləyirəm"'), "Confirmation button label");
assert.ok(confirmationSource.includes("#modal.orderConfirmationModal .mBottom"), "Confirmation price/footer is hidden");
assert.equal(confirmationSource.includes("spotifyHelpCtaIcon\" aria-hidden=\"true\">🔐"), false, "Large Spotify password block remains");
assert.ok(confirmationSource.includes("formatConfirmationText(settings.description)"), "Confirmation text formatter");
assert.ok(confirmationSource.includes('consentForm.addEventListener("submit"') && confirmationSource.includes("onConfirm(formData);"), "Confirmation continues the existing order flow");
assert.ok(confirmationSource.includes('id="orderTermsAgreement"') && confirmationSource.includes("required"), "Mandatory terms consent is connected");
assert.ok(confirmationSource.includes('return fields.length ? "form_confirm_whatsapp" : "confirm_then_whatsapp";'), "Aktiv mÃ¼ÅŸtÉ™ri sahÉ™lÉ™ri sifariÅŸ axÄ±nÄ± avtomatik seÃ§mir");
assert.ok(confirmationSource.includes('window.open(url, "_blank", "noopener,noreferrer");'), "WhatsApp handoff remains connected");

for (const product of state.products.filter((item) => item.active === false)) {
  if (!product.seoSlug) continue;
  assert.equal(
    sitemap.includes(`https://mirpanel.com/mehsul/${product.seoSlug}`),
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

const legacyExpectedInfoPages = {
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

const expectedInfoPages = Object.fromEntries(
  Object.entries(state.siteSections).map(([key, section]) => [key, {
    title: section.seoTitle,
    description: section.seoDescription,
    h1: section.title
  }])
);
assert.equal(Object.keys(legacyExpectedInfoPages).length, 3, "Legacy information metadata fixture");
assert.equal(infoPages.size, 3, "Information page count");
for (const [key, expected] of Object.entries(expectedInfoPages)) {
  const html = infoPages.get(key);
  assert.ok(html, `${key}: information page`);
  assert.ok(html.includes(`<title>${expected.title}</title>`), `${key}: title`);
  const metaDescription = html.match(/<meta name="description" content="([^"]*)">/)?.[1] || "";
  assert.ok(metaDescription, `${key}: description`);
  assert.equal(/\*\*|^\s*#{1,6}\s/m.test(metaDescription), false, `${key}: description Markdown iÅŸarÉ™si saxlayÄ±r`);
  assert.ok(html.includes(`<h1>${expected.h1}</h1>`), `${key}: h1`);
  assert.ok(html.includes(`rel="canonical" href="https://mirpanel.com/${key}"`), `${key}: canonical`);
  assert.ok(html.includes(`property="og:url" content="https://mirpanel.com/${key}"`), `${key}: Open Graph URL`);
  assert.ok(html.includes(`name="robots" content="index, follow"`), `${key}: robots`);
  assert.ok(html.includes(`"@type":"BreadcrumbList"`), `${key}: BreadcrumbList`);
  assert.equal(html.includes('target="_blank"'), false, `${key}: no new tab`);
  assert.ok(sitemap.includes(`https://mirpanel.com/${key}<`), `${key}: sitemap`);
  assert.equal(sitemap.includes(`https://mirpanel.com/${key}/`), false, `${key}: slash URL absent from sitemap`);
  assert.equal(redirects.includes(`/${key}/ /${key} 301`), false, `${key}: external Cloudflare redirect ilə loop yaranmamalıdır`);
}
assert.equal(sitemap.includes("https://mirpanel.com/netflix-almaq/"), false, "Retired Netflix doorway URL remained in sitemap");
assert.ok(redirects.includes("/netflix-almaq /mehsul/netflix-sexsi 301"), "Netflix target redirect missing");
assert.ok(redirects.includes("/netflix-almaq/ /mehsul/netflix-sexsi 301"), "Netflix slash redirect missing");

const disabledSections = structuredClone(state.siteSections);
disabledSections.haqqimizda.enabled = false;
assert.equal(
  generateInfoPageFiles(disabledSections, state.ui).has("haqqimizda"),
  false,
  "Disabled information page generated"
);
assert.equal(
  generateSitemap(state.products, disabledSections).includes("https://mirpanel.com/haqqimizda"),
  false,
  "Disabled information page remained in sitemap"
);
assert.deepEqual(
  removedInfoPagePaths(state.siteSections, disabledSections),
  ["haqqimizda"],
  "Disabled information page removal"
);

const updatedSections = structuredClone(state.siteSections);
updatedSections.haqqimizda.body = "Admin məlumat səhifəsi yeniləmə testi.";
updatedSections.haqqimizda.blocks = [];
assert.ok(
  generateInfoPageFiles(updatedSections, state.ui)
    .get("haqqimizda")
    .includes("Admin məlumat səhifəsi yeniləmə testi."),
  "Admin information text did not regenerate the page"
);

const unsafeAboutState = structuredClone(state);
unsafeAboutState.siteSections.haqqimizda.blocks = [{
  title: "Təhlükəsiz bölmə",
  text: "## Alt başlıq\n\n**Qalın mətn** və [əlaqə](/elaqe/).<script>alert(1)</script><iframe src=x></iframe>[pis](javascript:alert(1))",
  order: 1
}];
const unsafeAboutHtml = generateInfoPageFiles(
  normalizeAdminPayload(unsafeAboutState).siteSections,
  state.ui,
  state.cms
).get("haqqimizda");
assert.equal(unsafeAboutHtml.includes("<script>alert"), false, "Haqqımızda script sanitizasiyası");
assert.equal(unsafeAboutHtml.includes("<iframe"), false, "Haqqımızda iframe sanitizasiyası");
assert.equal(unsafeAboutHtml.includes("javascript:"), false, "Haqqımızda təhlükəli URL sanitizasiyası");
assert.equal(unsafeAboutHtml.includes("<h2>"), false, "Haqqımızda mətnində böyük alt başlıq yaranmamalıdır");
assert.ok(unsafeAboutHtml.includes("<p><strong>Alt başlıq</strong></p>"), "Haqqımızda başlıq sintaksisi sadə vurğulu abzas olmadı");
assert.ok(unsafeAboutHtml.includes("<strong>Qalın mətn</strong>"), "Haqqımızda qalın mətn formatı");

assert.equal(
  generateSitemap(deactivated, state.siteSections).includes(
    `https://mirpanel.com/mehsul/${deactivatedProduct.seoSlug}`
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
const addedHtml = generateProductPageFiles(addedProducts).get("mehsul/seo-generator-test-product.page");
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
const updatedHtml = generateProductPageFiles(updatedProducts).get(`mehsul/${active[0].slug}.page`);
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
