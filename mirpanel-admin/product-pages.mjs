const SITE_URL = "https://mirpanel.com";
const DELIVERY_TEXT = "7/24 anında təqdim edilir";

const defaultSeoAliases = {
  netflix: ["netflix-almaq", "netflix-aile-almaq"],
  prime: ["prime-video-almaq"],
  google_ai: ["gemini-pro-almaq"],
  google_ai_ultra: ["gemini-ultra-almaq"],
  grok_supergrok: ["super-grok-ai-almaq"],
  claude_ai: ["cloud-ai-max-almaq", "claude-ai-almaq"],
  canva: ["canva-pro-almaq"],
  adobecc: ["adobe-cc-almaq"]
};

const defaultSitePageSlugs = {
  haqqimizda: "haqqimizda",
  sertler: "sertler",
  elaqe: "elaqe"
};

const infoPageMetadata = {
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

const adminRedirects = [
  "/admin https://mirpanel.onrender.com/ 302",
  "/admin.html https://mirpanel.onrender.com/ 302",
  "/admin/* https://mirpanel.onrender.com/:splat 302"
];

const legacyProductSlugs = {
  capcut: ["capcut-pro-almaq"],
  hbomax: ["hbo-max-almaq"],
  netflix: ["netflix-sexsi-almaq", "netflix-almaq", "netflix-aile-almaq"],
  netflix_umumi: ["netflix-umumi-almaq"],
  zoom: ["zoom-pro-almaq"],
  youtube: ["youtube-premium-almaq"],
  spotify: ["spotify-premium-almaq"],
  surfshark: ["surfshark-vpn-almaq"],
  tiktok_jeton: ["tiktok-jeton-almaq"],
  google_ai: ["google-ai-pro-v3-almaq", "gemini-pro-almaq"],
  google_ai_ultra: ["google-ai-pro-ultra-almaq", "gemini-ultra-almaq"],
  captions: ["captions-ai-almaq"],
  grok_supergrok: ["grok-ai-almaq", "super-grok-ai-almaq"],
  claude_ai: ["cloud-ai-pro-almaq", "cloud-ai-max-almaq", "claude-ai-almaq"],
  prime: ["amazon-prime-video-almaq", "prime-video-almaq"],
  duolingo: ["duolingo-super-almaq"],
  canva: ["canva-premium-almaq", "canva-pro-almaq"],
  chatgpt: ["chatgpt-plus-almaq"],
  adobecc: ["adobe-creative-cloud-almaq", "adobe-cc-almaq"],
  chatgpt_ortaq: ["chatgpt-plus-ortaq-hesab0-almaq", "chatgpt-plus-ortaq-hesab-almaq"],
  youtube_sexsi: ["youtube-eyni-hesab-almaq"]
};

export function seoSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[əƏ]/g, "e")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function productSeoSlug(product) {
  return cleanProductSlug(product?.seoSlug);
}

export function cleanProductSlug(value) {
  return seoSlug(value)
    .replace(/-almaq$/, "")
    .replace(/(^|-)hesab0(?=-|$)/g, "$1hesab")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function productCanonicalPath(slug) {
  return `/mehsul/${cleanProductSlug(slug)}`;
}

export function productPageFilePath(slug) {
  return `mehsul/${cleanProductSlug(slug)}.page`;
}

export function activeProductsWithSlugs(products = []) {
  const active = [];
  const owners = new Map();

  for (const product of products) {
    if (product?.active === false) continue;
    const slug = productSeoSlug(product);
    if (!slug) {
      throw new Error(`Aktiv məhsul üçün seoSlug boşdur: ${product?.id || product?.title || "naməlum"}`);
    }
    if (owners.has(slug)) {
      throw new Error(`Təkrarlanan seoSlug "${slug}": ${owners.get(slug)} və ${product.id}`);
    }
    owners.set(slug, product.id);
    active.push({ product, slug });
  }

  return active;
}

export function activeProductPageSlugs(products = []) {
  return activeProductsWithSlugs(products).map(({ slug }) => slug);
}

function activeSitePages(siteSections = {}) {
  const pages = [];
  const slugs = new Set();

  for (const [key, fallbackSlug] of Object.entries(defaultSitePageSlugs)) {
    const page = siteSections?.[key] || {};
    if (page.enabled === false) continue;
    const slug = seoSlug(page.slug || fallbackSlug);
    if (slug && !slugs.has(slug)) {
      slugs.add(slug);
      pages.push({ key, slug, section: page });
    }
  }

  return pages;
}

function activeSitePageSlugs(siteSections = {}) {
  return activeSitePages(siteSections).map(({ slug }) => slug);
}

export function removedProductPagePaths(previousProducts = [], nextProducts = []) {
  const previous = new Set(activeProductPageSlugs(previousProducts));
  const next = new Set(activeProductPageSlugs(nextProducts));
  return [...previous]
    .filter((slug) => !next.has(slug))
    .map((slug) => productPageFilePath(slug));
}

export function removedInfoPagePaths(previousSiteSections = {}, nextSiteSections = {}) {
  const previous = new Set(activeSitePageSlugs(previousSiteSections));
  const next = new Set(activeSitePageSlugs(nextSiteSections));
  return [...previous]
    .filter((slug) => !next.has(slug))
    .map((slug) => slug);
}

export function generateSitemap(products = [], siteSections = {}, date = new Date(), cms = {}) {
  const lastmod = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  const urls = new Map();
  const add = (path, changefreq, priority) => {
    const url = `${SITE_URL}${path}`;
    if (!urls.has(url)) urls.set(url, { changefreq, priority });
  };

  if (cms?.seo?.home?.includeInSitemap !== false && cms?.seo?.home?.index !== false) {
    add("/", "daily", "1.0");
  }
  add("/mehsul", "daily", "0.9");
  for (const { slug, section } of activeSitePages(siteSections)) {
    if (section.includeInSitemap !== false && section.index !== false) {
      add(`/${slug}`, "monthly", "0.7");
    }
  }
  for (const { product, slug } of activeProductsWithSlugs(products)) {
    if (product.includeInSitemap !== false && product.seoIndex !== false) {
      add(productCanonicalPath(slug), "weekly", "0.9");
    }
  }

  const entries = [...urls].map(([url, meta]) =>
    `  <url><loc>${escapeXml(url)}</loc><lastmod>${lastmod}</lastmod><changefreq>${meta.changefreq}</changefreq><priority>${meta.priority}</priority></url>`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

export function generateRedirects(products = [], siteSections = {}, previous = {}) {
  const lines = [...adminRedirects];
  const primaryById = new Map(
    activeProductsWithSlugs(products).map(({ product, slug }) => [product.id, slug])
  );

  lines.push("/mehsul /mehsul.page 200", "/mehsul/ /mehsul 301");

  for (const [productId, aliases] of Object.entries(defaultSeoAliases)) {
    const primary = primaryById.get(productId);
    if (!primary) continue;
    for (const aliasValue of aliases) {
      const alias = seoSlug(aliasValue);
      if (!alias) continue;
      const target = productCanonicalPath(primary);
      lines.push(`/${alias} ${target} 301`, `/${alias}/ ${target} 301`);
    }
  }

  for (const [productId, aliases] of Object.entries(legacyProductSlugs)) {
    const primary = primaryById.get(productId);
    if (!primary) continue;
    const target = productCanonicalPath(primary);
    for (const aliasValue of aliases) {
      const alias = seoSlug(aliasValue);
      if (alias) lines.push(`/${alias} ${target} 301`, `/${alias}/ ${target} 301`);
    }
  }

  const previousProducts = activeProductsWithSlugs(previous.products || []);
  for (const { product, slug: oldSlug } of previousProducts) {
    const newSlug = primaryById.get(product.id);
    if (newSlug && oldSlug !== newSlug) {
      const target = productCanonicalPath(newSlug);
      lines.push(`/mehsul/${oldSlug} ${target} 301`, `/mehsul/${oldSlug}/ ${target} 301`);
    }
  }
  const nextSiteByKey = new Map(activeSitePages(siteSections).map((page) => [page.key, page.slug]));
  for (const page of activeSitePages(previous.siteSections || {})) {
    const newSlug = nextSiteByKey.get(page.key);
    if (newSlug && page.slug !== newSlug) {
      lines.push(`/${page.slug} /${newSlug} 301`, `/${page.slug}/ /${newSlug} 301`);
    }
  }

  return `${[...new Set(lines)].join("\n")}\n`;
}

export function generateProductPageFiles(products = [], siteSections = {}, cms = {}, content = {}) {
  const active = activeProductsWithSlugs(products);
  const files = new Map();

  for (const { product, slug } of active) {
    files.set(productPageFilePath(slug), generateProductPageHtml(product, slug, active, siteSections, cms, content[product.id] || {}));
  }

  return files;
}

export function generateInfoPageFiles(siteSections = {}, ui = {}, cms = {}) {
  const files = new Map();

  for (const page of activeSitePages(siteSections)) {
    const effectivePage = page.key === "elaqe"
      ? {
          ...page,
          section: {
            ...page.section,
            whatsappNumber: cms.site?.phoneDisplay || cms.site?.whatsappNumber || page.section.whatsappNumber
          }
        }
      : page;
    files.set(page.slug, generateInfoPageHtml(effectivePage, siteSections, ui, cms));
  }

  return files;
}

export function generateProductListingPageFiles(products = [], siteSections = {}, cms = {}) {
  const active = activeProductsWithSlugs(products);
  const canonical = `${SITE_URL}/mehsul`;
  const cards = active.map(({ product, slug }, index) => {
    const prices = (Array.isArray(product.plans) ? product.plans : [])
      .map((plan) => Number(plan.price))
      .filter((price) => Number.isFinite(price) && price > 0);
    const shownPrice = product.id === "tiktok_jeton"
      ? `10.00 ${cleanText(product.currency)}`
      : prices.length ? `${Math.min(...prices).toFixed(2)} ${cleanText(product.currency)}` : "—";
    return `<a class="card" href="${productCanonicalPath(slug)}" data-product-id="${escapeAttribute(product.id)}" style="animation-delay:${Math.min(index * 0.03, 0.25)}s"><div class="imgWrap"><img class="img" src="${escapeAttribute(rootRelativeUrl(product.image))}" alt="${escapeAttribute(product.imageAlt || product.title)}"><div class="cornerPrice">${escapeHtml(shownPrice)}</div></div><div class="pad"><div class="topline"><h2 class="title">${escapeHtml(product.title)}</h2><div class="badge">${escapeHtml(product.badge)}</div></div><div class="meta">${escapeHtml(product.desc)}</div><div class="priceRow"><span class="btn primary">${escapeHtml(cms.commonTexts?.order || "Sifariş et")}</span></div></div></a>`;
  }).join("");
  const structuredData = safeJson({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Məhsullar | Mirpanel",
    url: canonical,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: active.map(({ product, slug }, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: cleanText(product.title),
        url: `${SITE_URL}${productCanonicalPath(slug)}`
      }))
    }
  });
  const html = `<!DOCTYPE html>
<html lang="az"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><title>Məhsullar | Mirpanel</title><meta name="description" content="Mirpanel-də mövcud rəqəmsal məhsullara və planlara baxın."><meta name="robots" content="index, follow"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="Məhsullar | Mirpanel"><meta property="og:description" content="Mirpanel-də mövcud rəqəmsal məhsullara və planlara baxın."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/assets/logo.png"><link rel="stylesheet" href="/style.css?v=final22"><link rel="stylesheet" href="/product-page.css?v=20260724-mobile-pricing-1"><link rel="icon" href="/assets/logo.png"><script type="application/ld+json">${structuredData}</script></head>
<body class="product-page-document"><header class="product-page-header"><div class="product-page-header-inner"><a class="product-page-brand" href="/"><img src="/assets/logo.png" alt="Mirpanel"><span>MIRPANEL</span></a><nav class="product-page-nav" aria-label="Əsas menyu">${renderSiteNav(siteSections, "products")}</nav></div></header><main class="wrap" role="main"><nav class="product-page-breadcrumb" aria-label="Breadcrumb"><a href="/">Ana səhifə</a><span aria-hidden="true">›</span><span aria-current="page">Məhsullar</span></nav><h1>Məhsullar</h1><div class="grid" aria-live="polite">${cards}</div></main><footer class="product-page-footer">${renderCmsFooter(cms)}</footer></body></html>`;
  return new Map([["mehsul.page", applyCmsBrandAndNav(html, cms, "products")]]);
}

export function generateProductPageHtml(product, slug, activeProducts, siteSections = {}, cms = {}, content = {}) {
  const canonical = `${SITE_URL}${productCanonicalPath(slug)}`;
  const title = cleanText(product.seoTitle) || `${cleanText(product.title)} | Mirpanel`;
  const h1 = cleanText(product.seoH1) || cleanText(product.title);
  const description =
    cleanText(product.seoDescription) ||
    cleanText(product.desc) ||
    `${cleanText(product.title)} üçün mövcud planları və qiymətləri Mirpanel-də yoxlayın.`;
  const imageUrl = absoluteUrl(product.image);
  const imageSrc = rootRelativeUrl(product.image);
  const availability = productAvailability(product);
  const currencyCode = schemaCurrency(product.currency);
  const sellerName = cleanText(cms.site?.brandName) || "Mirpanel";
  const offers = productOffers(product, canonical, availability, currencyCode, sellerName);
  const similar = similarProducts(product, activeProducts);
  const usageText =
    cleanText(product.confirmationModal?.description) ||
    cleanText(product.orderConfirmation?.description) ||
    cleanText(product.note);
  const aboutText = cleanText(product.seoContent) || cleanText(product.desc);
  const planMarkup = renderPlans(product);
  const similarMarkup = renderSimilar(similar);
  const structuredData = safeJson({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${canonical}#product`,
        url: canonical,
        name: cleanText(product.title),
        description,
        image: [imageUrl],
        sku: String(product.id || ""),
        brand: { "@type": "Brand", name: "Mirpanel" },
        offers
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Ana səhifə",
            item: `${SITE_URL}/`
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Məhsullar",
            item: `${SITE_URL}/mehsul`
          },
          {
            "@type": "ListItem",
            position: 3,
            name: cleanText(product.title),
            item: canonical
          }
        ]
      }
    ]
  });

  const html = `<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttribute(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="product">
  <meta property="og:title" content="${escapeAttribute(title)}">
  <meta property="og:description" content="${escapeAttribute(description)}">
  <meta property="og:image" content="${escapeAttribute(imageUrl)}">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttribute(title)}">
  <meta name="twitter:description" content="${escapeAttribute(description)}">
  <meta name="twitter:image" content="${escapeAttribute(imageUrl)}">
  <meta name="theme-color" content="#070707">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=final22">
  <link rel="stylesheet" href="/premium-compact-glow.css?v=20260705-detail-image-1">
  <link rel="stylesheet" href="/stock-display-fix.css?v=20260610-1">
  <link rel="stylesheet" href="/mobile-detail-unified.css?v=20260705-premium-layout-1">
  <link rel="stylesheet" href="/product-page.css?v=20260724-mobile-pricing-1">
  <link rel="icon" href="/assets/logo.png">
  <script type="application/ld+json">${structuredData}</script>
</head>
<body class="product-page-document" data-product-id="${escapeAttribute(product.id)}" data-product-slug="${escapeAttribute(slug)}">
  <header class="product-page-header">
    <div class="product-page-header-inner">
      <a class="product-page-brand" href="/" aria-label="Mirpanel ana səhifə">
        <img src="/assets/logo.png" alt="Mirpanel">
        <span>MIRPANEL</span>
      </a>
      <nav class="product-page-nav" aria-label="Əsas menyu">${renderSiteNav(siteSections)}</nav>
    </div>
  </header>

  <main id="productPageView" class="product-page-root">
    <nav class="product-page-breadcrumb" aria-label="Breadcrumb">
      <a href="/">Ana səhifə</a><span aria-hidden="true">›</span>
      <a href="/mehsul">Məhsullar</a><span aria-hidden="true">›</span>
      <span aria-current="page">${escapeHtml(product.title)}</span>
    </nav>
    <div class="product-page-layout">
      <article class="product-page-card">
        <div class="product-page-card-grid">
          <div class="product-page-media">
            <span class="product-page-availability-badge${availability.inStock ? "" : " is-out"}">${escapeHtml(availability.label)}</span>
            <img id="pp-main-img" src="${escapeAttribute(imageSrc)}" alt="${escapeAttribute(product.title)}" width="1200" height="1200" fetchpriority="high" decoding="async">
          </div>

          <div class="product-page-info">
            <div class="product-page-eyebrow">
              ${product.variant ? `<span class="product-page-variant">${escapeHtml(product.variant)}</span>` : ""}
              ${product.category ? `<span class="product-page-category">${escapeHtml(product.category)}</span>` : ""}
              <span class="product-page-status${availability.inStock ? "" : " is-out"}">${escapeHtml(availability.label)}</span>
            </div>
            <h1 id="pp-main-title" class="product-page-title">${escapeHtml(h1)}</h1>
            ${product.desc ? `<p class="product-page-description">${escapeHtml(product.desc)}</p>` : ""}
            <div class="product-page-delivery">
              <strong>${DELIVERY_TEXT}</strong>
            </div>

            <h2 class="product-page-section-title">Müddət seçin</h2>
            <div class="product-page-static-plans" data-static-product-plans>${planMarkup}</div>
            <div id="pp-plans-container" class="pp-plans-container" hidden></div>
          </div>
        </div>

        <div class="product-page-actions">
          <a class="product-page-action is-about" href="#product-about">Məhsul haqqında</a>
          <button class="product-page-action is-order" id="pp-order-btn" type="button">Sifariş et</button>
        </div>
      </article>

      <aside class="product-page-similar" aria-label="Oxşar məhsullar">
        <h2 class="product-page-similar-heading">Oxşar məhsullar</h2>
        <div id="pp-similar-list" class="product-page-similar-list">${similarMarkup}</div>
        <a class="product-page-similar-more" href="/mehsul">Daha çox məhsul</a>
      </aside>
    </div>

    <section class="product-page-content" id="product-about">
      <div class="product-page-tabs" role="tablist" aria-label="Məhsul məlumatı">
        <button class="product-page-tab is-active" type="button" role="tab" aria-selected="true" data-product-tab="about">Məhsul haqqında</button>
        <button class="product-page-tab" type="button" role="tab" aria-selected="false" data-product-tab="rules">İstifadə qaydaları</button>
      </div>
      <div class="product-page-content-card">
        <article class="product-page-panel" data-product-panel="about">
          <h2>${escapeHtml(product.title)} haqqında</h2>
          ${product.desc && product.desc !== aboutText ? `<p>${escapeHtml(product.desc)}</p>` : ""}
          <p>${escapeHtml(aboutText || `${product.title} üçün mövcud planları və qiymətləri bu səhifədə görə bilərsiniz.`)}</p>
        </article>
        <article class="product-page-panel" data-product-panel="rules" hidden>
          <h2>İstifadə qaydaları</h2>
          <p>${escapeHtml(usageText || product.note || product.desc || "")}</p>
        </article>
      </div>
    </section>

    ${renderProductFaq(product)}

    <section class="pp-bottom-section" hidden aria-hidden="true">
      <div id="pp-tabs-container"></div>
      <div id="pp-content-box"></div>
    </section>
  </main>

  <footer class="product-page-footer">©️ 2026 Mirpanel • Bütün hüquqlar qorunur</footer>

  <div class="modal" id="modal" aria-hidden="true">
    <div class="modalCard" role="dialog" aria-modal="true" style="max-width:500px">
      <button class="close" id="closeModal" type="button">Bağla ✕</button>
      <div class="mTop">
        <img src="${escapeAttribute(imageSrc)}" alt="${escapeAttribute(product.title)}" id="mImg" class="mImg">
        <div class="mTxt">
          <div class="mTitle" id="mTitle">${escapeHtml(product.title)}</div>
          <div class="mDesc" id="mDesc">${escapeHtml(product.desc || "")}</div>
        </div>
      </div>
      <div id="mInfoBox" class="mInfoBox"></div>
      <div class="mPlansTitle">Plan seçin</div>
      <div class="mPlans" id="mPlans"></div>
      <div class="mForm" id="mForm" style="margin-top:25px"></div>
      <div class="mBottom">
        <div class="mInfo" id="mInfo"></div>
        <div class="mSmall">Sifariş etdikdə WhatsApp avtomatik açılacaq.</div>
      </div>
    </div>
  </div>

  <script src="/app.js?v=product-pages-20260724-refine-1"></script>
  <script src="/hbo-max-order-fix.js?v=20260707-prime-video-1"></script>
  <script src="/order-confirmation.js?v=confirmation-dialog-20260728-1"></script>
  <script src="/stock-display-fix.js?v=20260610-1"></script>
  <script src="/product-page.js?v=20260724-refine-1"></script>
</body>
</html>
`.replace(/[ \t]+$/gm, "");
  return applyCmsToProductHtml(html, product, cms, content);
}

function generateInfoPageHtml(page, siteSections, ui, cms = {}) {
  const fallbackMetadata = infoPageMetadata[page.key];
  const metadata = page.key === "sertler" ? {
    title: cleanText(page.section.seoTitle) || fallbackMetadata.title,
    description: cleanText(page.section.seoDescription) || fallbackMetadata.description,
    h1: cleanText(page.section.title) || fallbackMetadata.h1
  } : fallbackMetadata;
  const canonical = `${SITE_URL}/${page.slug}`;
  const content = renderInfoPageContent(page.key, page.section, siteSections, ui);
  const structuredData = safeJson({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Ana səhifə",
        item: `${SITE_URL}/`
      },
      {
        "@type": "ListItem",
        position: 2,
        name: metadata.h1,
        item: canonical
      }
    ]
  });

  const html = `<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${escapeHtml(metadata.title)}</title>
  <meta name="description" content="${escapeAttribute(metadata.description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeAttribute(metadata.title)}">
  <meta property="og:description" content="${escapeAttribute(metadata.description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE_URL}/assets/logo.png">
  <meta name="theme-color" content="#070707">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=final22">
  <link rel="stylesheet" href="/product-page.css?v=20260724-mobile-pricing-1">
  <link rel="stylesheet" href="/info-page.css?v=${page.key === "haqqimizda" ? "20260731-about-2" : page.key === "sertler" ? "20260731-terms-2" : "20260728-1"}">
  <link rel="icon" href="/assets/logo.png">
  <script type="application/ld+json">${structuredData}</script>
</head>
<body class="product-page-document info-page-document${page.key === "haqqimizda" ? " info-page-document--about" : page.key === "sertler" ? " info-page-document--terms" : ""}">
  <header class="product-page-header">
    <div class="product-page-header-inner">
      <a class="product-page-brand" href="/" aria-label="Mirpanel ana səhifə">
        <img src="/assets/logo.png" alt="Mirpanel">
        <span>MIRPANEL</span>
      </a>
      <nav class="product-page-nav" aria-label="Əsas menyu">${renderSiteNav(siteSections, page.key)}</nav>
    </div>
  </header>

  <main class="info-page-root">
    <nav class="info-page-breadcrumb" aria-label="Səhifə yolu">
      <a href="/">Ana səhifə</a><span aria-hidden="true">/</span><span>${escapeHtml(metadata.h1)}</span>
    </nav>
    <article class="info-page-card${page.key === "haqqimizda" ? " info-page-card--about" : page.key === "sertler" ? " info-page-card--terms" : ""}">
      <p class="info-page-kicker">${escapeHtml(page.key === "haqqimizda" ? (cleanText(page.section.kicker) || "Haqqımızda") : page.key === "sertler" ? "Şərtlər" : "MIRPANEL")}</p>
      <h1>${escapeHtml(metadata.h1)}</h1>
      ${content}
    </article>
  </main>

  <footer class="product-page-footer">${escapeHtml(fixMojibake(ui.footRights) || "©️ 2026 Mirpanel • Bütün hüquqlar qorunur")}</footer>
</body>
</html>
`.replace(/[ \t]+$/gm, "");
  return applyCmsToInfoHtml(html, page, cms, ui);
}

function safeRichTextUrl(value) {
  const source = String(value || "").trim();
  if (/^(?:\/(?!\/)|#)/.test(source)) return source;
  try {
    const parsed = new URL(source);
    return /^(?:https?:)$/.test(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function richTextHtmlToMarkdown(value) {
  return String(value || "")
    .replace(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `[${label}](${href})`)
    .replace(/<(?:strong|b)>/gi, "**").replace(/<\/(?:strong|b)>/gi, "**")
    .replace(/<(?:em|i)>/gi, "*").replace(/<\/(?:em|i)>/gi, "*")
    .replace(/<h[1-4][^>]*>/gi, "\n## ").replace(/<\/h[1-4]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n")
    .replace(/<(?:p|ul|ol)[^>]*>/gi, "\n")
    .replace(/<\/(?:ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
}

function renderRichInline(value) {
  const links = [];
  let source = String(value || "").replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const safeHref = safeRichTextUrl(href);
    if (!safeHref) return label;
    const token = `RICH_LINK_${links.length}_TOKEN`;
    links.push(`<a href="${escapeAttribute(safeHref)}">${escapeHtml(label)}</a>`);
    return token;
  });
  source = escapeHtml(source)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  links.forEach((link, index) => { source = source.replace(`RICH_LINK_${index}_TOKEN`, link); });
  return source;
}

function renderSafeRichText(value) {
  const source = richTextHtmlToMarkdown(value).replace(/\r/g, "").trim();
  if (!source) return "";
  const output = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    if (text) output.push(`<p>${renderRichInline(text)}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) output.push(`<ul>${list.map((item) => `<li>${renderRichInline(item)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const text = heading[1].trim();
      if (text) output.push(`<h2>${renderRichInline(text)}</h2>`);
      continue;
    }
    const listItem = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (listItem) { flushParagraph(); list.push(listItem[1].trim()); continue; }
    flushList();
    paragraph.push(line);
  }
  flushParagraph(); flushList();
  return output.join("");
}

function renderAboutRichText(value) {
  return renderSafeRichText(value).replace(/<h2>([\s\S]*?)<\/h2>/g, "<p><strong>$1</strong></p>");
}

function termsAnchorId(value) {
  return `sertler-${String(value || "").replace(/\.+$/, "").replace(/\./g, "-")}`;
}

export function renderTermsMarkdown(value) {
  const source = richTextHtmlToMarkdown(value).replace(/\r/g, "").trim();
  if (!source) return "";

  const output = [];
  const toc = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    if (text) output.push(`<p>${renderRichInline(text)}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) output.push(`<ul>${list.map((item) => `<li>${renderRichInline(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    if (/^#\s+MIRPANEL\.COM\s+[–-]\s+İSTİFADƏÇİ QAYDALARI VƏ ŞƏRTLƏRİ\s*$/i.test(line)) {
      flushParagraph(); flushList();
      continue;
    }
    const mainHeading = line.match(/^#\s+(\d+)\.\s+(.+)$/);
    if (mainHeading) {
      flushParagraph(); flushList();
      const id = termsAnchorId(mainHeading[1]);
      const headingText = `${mainHeading[1]}. ${mainHeading[2].trim()}`;
      toc.push({ id, text: headingText });
      output.push(`<h2 id="${id}">${renderRichInline(headingText)}</h2>`);
      continue;
    }
    const subHeading = line.match(/^##\s+(\d+\.\d+)\.?\s+(.+)$/);
    if (subHeading) {
      flushParagraph(); flushList();
      const headingText = `${subHeading[1]}. ${subHeading[2].trim()}`;
      output.push(`<h3 id="${termsAnchorId(subHeading[1])}">${renderRichInline(headingText)}</h3>`);
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const text = heading[1].trim();
      if (text) output.push(`<h2 class="terms-warning-heading">${renderRichInline(text)}</h2>`);
      continue;
    }
    const listItem = line.match(/^(?:[-*+]\s+)(.+)$/);
    if (listItem) { flushParagraph(); list.push(listItem[1].trim()); continue; }
    flushList();
    paragraph.push(line);
  }
  flushParagraph(); flushList();

  const tocHtml = toc.length
    ? `<nav class="terms-toc" aria-label="Mündəricat"><details open><summary>Mündəricat</summary><ol>${toc.map((item) => `<li><a href="#${item.id}">${renderRichInline(item.text)}</a></li>`).join("")}</ol></details></nav>`
    : "";
  return `${tocHtml}<div class="info-page-copy terms-page-copy" id="terms-top">${output.join("")}</div><a class="terms-back-top" href="#terms-top">Yuxarı qayıt</a>`;
}

function renderInfoPageContent(key, section, siteSections, ui) {
  if (key === "haqqimizda") {
    const body = fixMojibake(section.body || section.text);
    const paragraphs = (Array.isArray(section.blocks) ? section.blocks : [])
      .slice()
      .sort((a, b) => Number(a.order) - Number(b.order))
      .map((block) => renderAboutRichText(fixMojibake(block.text)))
      .filter(Boolean)
      .join("");
    return `<div class="info-page-copy about-page-copy">${paragraphs || renderAboutRichText(body)}</div>`;
  }

  if (key === "elaqe") {
    const number = fixMojibake(section.whatsappNumber);
    const contactText = fixMojibake(section.body || section.text);
    const supportText = fixMojibake(section.workHours);
    const whatsappHref = whatsappHrefFromNumber(number);
    return `<div class="info-page-copy">
        ${contactText ? `<p>${escapeHtml(contactText)}</p>` : ""}
        ${supportText ? `<p>${escapeHtml(supportText)}</p>` : ""}
        ${number ? `<p class="info-page-contact"><strong>WhatsApp:</strong> <a href="${escapeAttribute(whatsappHref)}">${escapeHtml(number)}</a></p>` : ""}
      </div>
      <div class="info-page-actions">
        <a href="/">Ana səhifə</a>
        ${number ? `<a class="is-primary" href="${escapeAttribute(whatsappHref)}">${escapeHtml(fixMojibake(section.buttonText) || "WhatsApp ilə yaz")}</a>` : ""}
      </div>`;
  }

  if (key === "sertler" && cleanText(section.body)) {
    return renderTermsMarkdown(fixMojibake(section.body));
  }

  const items = (Array.isArray(section.items) ? section.items : [])
    .map(fixMojibake)
    .filter(Boolean);
  const groups = [
    ["Ümumi qaydalar", items[0] ? [items[0]] : []],
    ["Sifariş prosesi", [fixMojibake(ui.bannerText), fixMojibake(ui.heroHint)].filter(Boolean)],
    ["Hesabdan istifadə", items[1] ? [items[1]] : []],
    ["Müştərinin məsuliyyəti", items[2] ? [items[2]] : []],
    ["Dəstək və əlaqə", items[3] ? [items[3]] : []]
  ].filter(([, paragraphs]) => paragraphs.length);
  return `<div class="info-page-sections">${groups.map(([heading, paragraphs]) =>
    `<section><h2>${escapeHtml(heading)}</h2>${paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join("")}</section>`
  ).join("")}</div>
    <div class="info-page-actions">
      <a href="/">Ana səhifə</a>
      <a href="/mehsul">Məhsullara bax</a>
      ${siteSections?.elaqe?.enabled === false ? "" : `<a class="is-primary" href="/${seoSlug(siteSections?.elaqe?.slug || defaultSitePageSlugs.elaqe)}">Əlaqə</a>`}
    </div>`;
}

function cmsIcon(name) {
  const icons = {
    home: `<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/>`,
    products: `<path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/>`,
    search: `<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>`,
    info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>`,
    contact: `<path d="M6.5 3.5h3l1.5 4-2 1.5a15 15 0 0 0 6 6l1.5-2 4 1.5v3a3 3 0 0 1-3 3C9.8 20.5 3.5 14.2 3.5 6.5a3 3 0 0 1 3-3Z"/>`,
    terms: `<path d="M7 3.5h10a2 2 0 0 1 2 2v15l-7-3-7 3v-15a2 2 0 0 1 2-2Z"/>`,
    whatsapp: `<path d="M20 11.5a8 8 0 0 1-12 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z"/>`,
    image: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/>`,
    shield: `<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/>`,
    link: `<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/>`
  };
  return icons[name] || icons.link;
}

function renderCmsNav(cms = {}) {
  const items = Array.isArray(cms.navigation) ? cms.navigation : [];
  return items
    .filter((item) => item.enabled !== false && cleanText(item.label) && cleanText(item.url))
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((item) => {
      const url = canonicalSiteUrl(item.url);
      const external = /^https?:\/\//i.test(url);
      const newTab = item.newTab === true;
      return `<a href="${escapeAttribute(url)}"${newTab ? ` target="_blank" rel="noopener noreferrer"` : ""}><svg aria-hidden="true" viewBox="0 0 24 24">${cmsIcon(item.icon)}</svg><span>${escapeHtml(item.label)}</span></a>`;
    })
    .join("");
}

function renderCmsFooter(cms = {}, ui = {}) {
  const footer = cms.footer || {};
  const year = Number(footer.year) || new Date().getUTCFullYear();
  const brand = cleanText(footer.brandName || cms.site?.brandName) || "Mirpanel";
  const rights = cleanText(footer.copyrightText) || fixMojibake(ui.footRights) || "Bütün hüquqlar qorunur";
  const links = (Array.isArray(footer.links) ? footer.links : [])
    .filter((item) => item.enabled !== false && item.label && item.url)
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((item) => `<a href="${escapeAttribute(canonicalSiteUrl(item.url))}"${item.newTab ? ` target="_blank" rel="noopener noreferrer"` : ""}>${escapeHtml(item.label)}</a>`)
    .join(" · ");
  return `© ${year} ${escapeHtml(brand)} · ${escapeHtml(rights)}${links ? ` · ${links}` : ""}`;
}

function applyCmsBrandAndNav(html, cms, currentKey = null) {
  const brand = cleanText(cms.site?.brandName) || "Mirpanel";
  const logo = rootRelativeUrl(cms.site?.logo || "assets/logo.png");
  const navigation = renderCmsNav(cms);
  let next = html
    .replace(/(<a class="product-page-brand"[^>]*>[\s\S]*?<img )src="[^"]*" alt="[^"]*"/, `$1src="${escapeAttribute(logo)}" alt="${escapeAttribute(brand)}"`)
    .replace(/<span>MIRPANEL<\/span>/, `<span>${escapeHtml(brand.toUpperCase())}</span>`);
  if (navigation) {
    next = next.replace(/(<nav class="product-page-nav"[^>]*>)[\s\S]*?(<\/nav>)/, `$1${navigation}$2`);
  }
  return next;
}

function applyCmsToProductHtml(html, product, cms = {}, content = {}) {
  const texts = cms.commonTexts || {};
  const seoTitle = cleanText(product.seoOgTitle || product.seoTitle || product.title);
  const seoDescription = cleanText(product.seoOgDescription || product.seoDescription || product.desc);
  const seoImage = absoluteUrl(product.seoOgImage || product.image);
  const brand = cleanText(cms.site?.brandName) || "Mirpanel";
  const availability = productAvailability(product);
  const availabilityText = cleanText(product.availabilityText) ||
    (availability.inStock ? cleanText(texts.available) : cleanText(texts.outOfStock)) ||
    availability.label;
  const about = cleanText(content.aboutHtml || product.longDescription || product.seoContent || product.desc);
  const rules = cleanText(content.rulesHtml || product.usageRules || product.note || product.desc);
  let next = applyCmsBrandAndNav(html, cms)
    .replace(/<meta name="robots" content="index, follow">/, `<meta name="robots" content="${product.seoIndex === false ? "noindex, follow" : "index, follow"}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeAttribute(seoTitle)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeAttribute(seoDescription)}">`)
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escapeAttribute(seoImage)}">`)
    .replace(/"brand":\{"@type":"Brand","name":"Mirpanel"\}/, `"brand":{"@type":"Brand","name":${safeJson(brand)}}`)
    .replace(/(<img id="pp-main-img"[^>]* alt=")[^"]*(")/, `$1${escapeAttribute(product.imageAlt || product.title)}$2`)
    .replace(/(<span class="product-page-availability-badge[^"]*">)[\s\S]*?(<\/span>)/, `$1${escapeHtml(availabilityText)}$2`)
    .replace(/(<span class="product-page-status[^"]*">)[\s\S]*?(<\/span>)/, `$1${escapeHtml(availabilityText)}$2`)
    .replace(/(<div class="product-page-delivery">\s*<strong>)[\s\S]*?(<\/strong>)/, `$1${escapeHtml(product.deliveryText || texts.instantDelivery || DELIVERY_TEXT)}$2`)
    .replace(/(<h2 class="product-page-section-title">)[\s\S]*?(<\/h2>)/, `$1${escapeHtml(texts.selectDuration || "Müddət seçin")}$2`)
    .replace(/(<a class="product-page-action is-about"[^>]*>)[\s\S]*?(<\/a>)/, `$1${escapeHtml(texts.productAbout || "Məhsul haqqında")}$2`)
    .replace(/(<button class="product-page-action is-order"[^>]*>)[\s\S]*?(<\/button>)/, `$1${escapeHtml(texts.order || "Sifariş et")}$2`)
    .replace(/(<h2 class="product-page-similar-heading">)[\s\S]*?(<\/h2>)/, `$1${escapeHtml(texts.relatedProducts || "Oxşar məhsullar")}$2`)
    .replace(/(<a class="product-page-similar-more"[^>]*>)[\s\S]*?(<\/a>)/, `$1${escapeHtml(texts.moreProducts || "Daha çox məhsul")}$2`)
    .replace(/<footer class="product-page-footer">[\s\S]*?<\/footer>/, `<footer class="product-page-footer">${renderCmsFooter(cms)}</footer>`);
  if (about) {
    next = next.replace(/(<article class="product-page-panel" data-product-panel="about">)[\s\S]*?(<\/article>)/, `$1<h2>${escapeHtml(product.title)} ${escapeHtml(texts.productAbout || "haqqında")}</h2>${about}$2`);
  }
  if (rules) {
    next = next.replace(/(<article class="product-page-panel" data-product-panel="rules" hidden>)[\s\S]*?(<\/article>)/, `$1<h2>${escapeHtml(texts.usageRules || "İstifadə qaydaları")}</h2>${rules}$2`);
  }
  return next;
}

function applyCmsToInfoHtml(html, page, cms = {}, ui = {}) {
  const section = page.section || {};
  const fallback = infoPageMetadata[page.key];
  const title = cleanText(section.seoTitle) || fallback.title;
  const description = cleanText(section.seoDescription) || fallback.description;
  const h1 = cleanText(section.title) || fallback.h1;
  const buttonText = cleanText(section.buttonText);
  const buttonUrl = pageLinkUrl(section.buttonUrl);
  const blocks = (Array.isArray(section.blocks) ? section.blocks : [])
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((block) => `<section><h2>${escapeHtml(block.title)}</h2>${block.image ? `<img src="${escapeAttribute(rootRelativeUrl(block.image))}" alt="${escapeAttribute(block.title)}">` : ""}<div>${cleanText(block.text)}</div></section>`)
    .join("");
  let next = applyCmsBrandAndNav(html, cms, page.key)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeAttribute(description)}">`)
    .replace(/<meta name="robots" content="index, follow">/, `<meta name="robots" content="${section.index === false ? "noindex, follow" : "index, follow"}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeAttribute(section.ogTitle || title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeAttribute(section.ogDescription || description)}">`)
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escapeAttribute(absoluteUrl(section.ogImage || cms.seo?.home?.ogImage || "assets/logo.png"))}">`)
    .replace(/(<article class="info-page-card(?: info-page-card--(?:about|terms))?">[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/, `$1${escapeHtml(h1)}$2`)
    .replace(/<footer class="product-page-footer">[\s\S]*?<\/footer>/, `<footer class="product-page-footer">${renderCmsFooter(cms, ui)}</footer>`);
  if (buttonText && buttonUrl) {
    next = next.replace(/(<div class="info-page-actions">[\s\S]*?)(<\/div>)/, `$1<a class="is-primary" href="${escapeAttribute(buttonUrl)}">${escapeHtml(buttonText)}</a>$2`);
  }
  if (page.key !== "haqqimizda" && blocks) next = next.replace(/(<\/article>\s*<\/main>)/, `<div class="info-page-sections">${blocks}</div>$1`);
  return next;
}

function renderSiteNav(siteSections = {}, currentKey = null) {
  const links = [
    ["", "/", "Ana səhifə", `<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>`],
    ["products", "/mehsul", "Məhsullar", `<path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/>`]
  ];
  const labels = { haqqimizda: "Haqqımızda", sertler: "Şərtlər", elaqe: "Əlaqə" };
  const icons = {
    haqqimizda: `<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>`,
    sertler: `<path d="M7 3.5h10a2 2 0 0 1 2 2v15l-7-3-7 3v-15a2 2 0 0 1 2-2Z"/><path d="M9 8h6M9 12h6"/>`,
    elaqe: `<path d="M6.5 3.5h3l1.5 4-2 1.5a15 15 0 0 0 6 6l1.5-2 4 1.5v3a3 3 0 0 1-3 3C9.8 20.5 3.5 14.2 3.5 6.5a3 3 0 0 1 3-3Z"/>`
  };

  for (const { key, slug } of activeSitePages(siteSections)) {
    links.push([key, `/${slug}`, labels[key], icons[key]]);
  }

  return links.map(([key, href, label, icon]) =>
    `<a href="${href}"${currentKey && key === currentKey ? ` aria-current="page"` : ""}><svg aria-hidden="true" viewBox="0 0 24 24">${icon}</svg><span>${label}</span></a>`
  ).join("");
}

function whatsappHrefFromNumber(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `994${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

function fixMojibake(value) {
  const replacements = {
    "Д±": "ı",
    "Д°": "İ",
    "Гј": "ü",
    "Гњ": "Ü",
    "Й™": "ə",
    "ЖЏ": "Ə",
    "Еџ": "ş",
    "Ећ": "Ş",
    "Г§": "ç",
    "Г‡": "Ç",
    "Г¶": "ö",
    "Г–": "Ö",
    "Дџ": "ğ",
    "Дћ": "Ğ"
  };
  return Object.entries(replacements).reduce(
    (text, [broken, correct]) => text.split(broken).join(correct),
    cleanText(value)
  );
}

function renderPlans(product) {
  const plans = Array.isArray(product.plans) ? product.plans : [];
  if (!plans.length) return `<p>Mövcud plan yoxdur.</p>`;
  return plans.map((plan, index) => {
    const label = cleanText(plan.label) || `${Number(plan.months) || 1} aylıq`;
    const price = Number(plan.price);
    const regularPrice = Number(plan.regularPrice);
    const discount = regularPrice > price && price > 0
      ? Math.round((regularPrice - price) / regularPrice * 100)
      : 0;
    const priceText = price > 0
      ? `${price.toFixed(2)} ${cleanText(product.currency)}`
      : (cleanText(plan.label) || "Stokda yoxdur");
    const priceMarkup = discount > 0
      ? `<span class="product-page-plan-prices"><span class="product-page-regular-price">${escapeHtml(`${regularPrice.toFixed(2)} ${cleanText(product.currency)}`)}</span><strong>${escapeHtml(priceText)}</strong><span class="product-page-discount">-${discount}%</span></span>`
      : `<span class="product-page-plan-prices"><strong>${escapeHtml(priceText)}</strong></span>`;
    return `<div class="product-page-static-plan${index === 0 ? " is-selected" : ""}"><span class="product-page-static-plan-name"><span class="product-page-static-radio" aria-hidden="true"></span>${escapeHtml(label)}</span>${priceMarkup}</div>`;
  }).join("");
}

function similarProducts(product, activeProducts) {
  const sameCategory = activeProducts.filter(
    ({ product: item }) => item.id !== product.id && item.category === product.category
  );
  const others = activeProducts.filter(
    ({ product: item }) =>
      item.id !== product.id &&
      item.category !== product.category &&
      !sameCategory.some(({ product: same }) => same.id === item.id)
  );
  return [...sameCategory, ...others].slice(0, 10);
}

function renderSimilar(similar) {
  return similar.map(({ product, slug }) => {
    const price = minimumPrice(product);
    const priceText = price > 0
      ? `${price.toFixed(2)} ${cleanText(product.currency)}`
      : "Stokda yoxdur";
    return `<a class="product-page-similar-card" href="${escapeAttribute(productCanonicalPath(slug))}">
      <img src="${escapeAttribute(rootRelativeUrl(product.image))}" class="product-page-similar-image" alt="${escapeAttribute(product.imageAlt || product.title)}" width="320" height="320" loading="lazy" decoding="async">
      <div class="product-page-similar-title">${escapeHtml(product.title)}</div>
      ${product.category ? `<div class="product-page-similar-category">${escapeHtml(product.category)}</div>` : ""}
      <div class="product-page-similar-price">${escapeHtml(priceText)}</div>
    </a>`;
  }).join("");
}

function productOffers(product, canonical, availability, priceCurrency, sellerName) {
  return (product.plans || [])
    .map((plan) => Number(plan.price))
    .filter((price) => Number.isFinite(price) && price >= 0)
    .map((price) => ({
      "@type": "Offer",
      url: canonical,
      price: price.toFixed(2),
      priceCurrency,
      availability: availability.schema,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: sellerName, url: SITE_URL }
    }));
}

function renderProductFaq(product) {
  const title = cleanText(product.title);
  const plans = (product.plans || [])
    .filter((plan) => Number.isFinite(Number(plan.price)))
    .map((plan) => `${cleanText(plan.label) || `${Number(plan.months) || 1} aylıq plan`} — ${Number(plan.price).toFixed(2)} ${cleanText(product.currency) || "AZN"}`);
  const planText = plans.length ? plans.join(", ") : "Hazırda sifariş üçün açıq plan yoxdur.";
  return `<section class="product-page-faq" aria-labelledby="product-faq-title">
    <h2 id="product-faq-title">Tez-tez verilən suallar</h2>
    <details><summary>${escapeHtml(title)} üçün hansı planlar mövcuddur?</summary><p>${escapeHtml(planText)}</p></details>
    <details><summary>${escapeHtml(title)} sifarişi necə verilir?</summary><p>Səhifədə planı seçib “Sifariş et” düyməsinə toxunun. Məlumatları yoxlayıb təsdiqlədikdən sonra mövcud WhatsApp sifariş axını açılır.</p></details>
    <details><summary>İstifadə qaydalarını haradan oxumaq olar?</summary><p>Bu səhifədəki “İstifadə qaydaları” bölməsində məhsula aid, admin paneldə saxlanılan şərtlər göstərilir.</p></details>
  </section>`;
}

function productAvailability(product) {
  const rawStock = product.stock ?? product.stockCount ?? product.stockQuantity;
  const exhausted =
    (product.stockEnabled === true &&
      rawStock !== null &&
      rawStock !== "" &&
      rawStock !== undefined &&
      Number(rawStock) <= 0) ||
    product.soldOut === true ||
    product.flow === "out_of_stock";
  return exhausted
    ? { inStock: false, label: "Stokda yoxdur", schema: "https://schema.org/OutOfStock" }
    : { inStock: true, label: "Mövcuddur", schema: "https://schema.org/InStock" };
}

function minimumPrice(product) {
  const values = (product.plans || [])
    .map((plan) => Number(plan.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  return values.length ? Math.min(...values) : 0;
}

function schemaCurrency(value) {
  const currency = cleanText(value).toUpperCase();
  if (currency === "₼" || currency === "AZN") return "AZN";
  if (currency === "$" || currency === "USD") return "USD";
  if (currency === "€" || currency === "EUR") return "EUR";
  return currency || "AZN";
}

function rootRelativeUrl(value) {
  const source = cleanText(value).replace(/^https?:\/\/mirpanel\.com/i, "");
  return source.startsWith("/") ? source : `/${source}`;
}

function pageLinkUrl(value) {
  const source = cleanText(value);
  if (!source) return "";
  return /^https?:\/\//i.test(source) ? source : canonicalSiteUrl(rootRelativeUrl(source));
}

function canonicalSiteUrl(value) {
  const source = cleanText(value);
  if (source === "/" + "#products-section") return "/mehsul";
  if (/^\/(?:mehsul|haqqimizda|sertler|elaqe)\/$/.test(source)) return source.slice(0, -1);
  return source;
}

function absoluteUrl(value) {
  try {
    return new URL(rootRelativeUrl(value), SITE_URL).href;
  } catch {
    return `${SITE_URL}/assets/logo.png`;
  }
}

function cleanText(value) {
  return String(value ?? "").trim();
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

function escapeXml(value) {
  return escapeHtml(value);
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
