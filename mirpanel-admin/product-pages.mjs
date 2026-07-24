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

const adminRedirects = [
  "/admin https://mirpanel-admin.onrender.com/ 302",
  "/admin.html https://mirpanel-admin.onrender.com/ 302",
  "/admin/* https://mirpanel-admin.onrender.com/:splat 302"
];

const standaloneSeoRoutes = [
  "/netflix-almaq /netflix-almaq/index.html 200",
  "/netflix-almaq/ /netflix-almaq/index.html 200"
];

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
  return seoSlug(product?.seoSlug);
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
    if (slug === "netflix-almaq") {
      throw new Error(`seoSlug mövcud Netflix SEO səhifəsi ilə toqquşur: ${product.id}`);
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

function activeSitePageSlugs(siteSections = {}) {
  const slugs = new Set();

  for (const [key, fallbackSlug] of Object.entries(defaultSitePageSlugs)) {
    const page = siteSections?.[key] || {};
    if (page.enabled === false) continue;
    const slug = seoSlug(page.slug || fallbackSlug);
    if (slug) slugs.add(slug);
  }

  return [...slugs];
}

export function removedProductPagePaths(previousProducts = [], nextProducts = []) {
  const previous = new Set(activeProductPageSlugs(previousProducts));
  const next = new Set(activeProductPageSlugs(nextProducts));
  return [...previous]
    .filter((slug) => !next.has(slug))
    .map((slug) => `${slug}/index.html`);
}

export function generateSitemap(products = [], siteSections = {}, date = new Date()) {
  const lastmod = date.toISOString().slice(0, 10);
  const urls = new Map();
  const add = (path, changefreq, priority) => {
    const url = `${SITE_URL}${path}`;
    if (!urls.has(url)) urls.set(url, { changefreq, priority });
  };

  add("/", "daily", "1.0");
  for (const slug of activeSitePageSlugs(siteSections)) {
    add(`/${slug}`, "monthly", "0.7");
  }
  add("/netflix-almaq", "weekly", "0.9");
  for (const slug of activeProductPageSlugs(products)) {
    add(`/${slug}/`, "weekly", "0.9");
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

export function generateRedirects(products = [], siteSections = {}) {
  const lines = [...adminRedirects, ...standaloneSeoRoutes];
  const primaryById = new Map(
    activeProductsWithSlugs(products).map(({ product, slug }) => [product.id, slug])
  );

  for (const slug of activeSitePageSlugs(siteSections)) {
    lines.push(`/${slug} /index.html 200`, `/${slug}/ /index.html 200`);
  }

  for (const slug of primaryById.values()) {
    lines.push(`/${slug} /${slug}/index.html 200`, `/${slug}/ /${slug}/index.html 200`);
  }

  for (const [productId, aliases] of Object.entries(defaultSeoAliases)) {
    const primary = primaryById.get(productId);
    if (!primary) continue;
    for (const aliasValue of aliases) {
      const alias = seoSlug(aliasValue);
      if (!alias || alias === primary || alias === "netflix-almaq") continue;
      lines.push(`/${alias} /${primary}/ 301`, `/${alias}/ /${primary}/ 301`);
    }
  }

  return `${[...new Set(lines)].join("\n")}\n`;
}

export function generateProductPageFiles(products = []) {
  const active = activeProductsWithSlugs(products);
  const files = new Map();

  for (const { product, slug } of active) {
    files.set(`${slug}/index.html`, generateProductPageHtml(product, slug, active));
  }

  return files;
}

export function generateProductPageHtml(product, slug, activeProducts) {
  const canonical = `${SITE_URL}/${slug}/`;
  const title = cleanText(product.seoTitle) || `${cleanText(product.title)} | Mirpanel`;
  const description =
    cleanText(product.seoDescription) ||
    cleanText(product.desc) ||
    `${cleanText(product.title)} üçün mövcud planları və qiymətləri Mirpanel-də yoxlayın.`;
  const imageUrl = absoluteUrl(product.image);
  const imageSrc = rootRelativeUrl(product.image);
  const availability = productAvailability(product);
  const currencyCode = schemaCurrency(product.currency);
  const offers = productOffers(product, canonical, availability, currencyCode);
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
            name: cleanText(product.title),
            item: canonical
          }
        ]
      }
    ]
  });

  return `<!DOCTYPE html>
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
      <nav class="product-page-nav" aria-label="Əsas menyu">
        <a href="/"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></svg><span>Ana səhifə</span></a>
        <a href="/#products-section"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></svg><span>Məhsullar</span></a>
        <a href="/#haqqimizda"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/></svg><span>Haqqımızda</span></a>
        <a href="/#elaqe"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6.5 3.5h3l1.5 4-2 1.5a15 15 0 0 0 6 6l1.5-2 4 1.5v3a3 3 0 0 1-3 3C9.8 20.5 3.5 14.2 3.5 6.5a3 3 0 0 1 3-3Z"/></svg><span>Əlaqə</span></a>
      </nav>
    </div>
  </header>

  <main id="productPageView" class="product-page-root">
    <div class="product-page-layout">
      <article class="product-page-card">
        <div class="product-page-card-grid">
          <div class="product-page-media">
            <span class="product-page-availability-badge${availability.inStock ? "" : " is-out"}">${escapeHtml(availability.label)}</span>
            <img id="pp-main-img" src="${escapeAttribute(imageSrc)}" alt="${escapeAttribute(product.title)}">
          </div>

          <div class="product-page-info">
            <div class="product-page-eyebrow">
              ${product.variant ? `<span class="product-page-variant">${escapeHtml(product.variant)}</span>` : ""}
              ${product.category ? `<span class="product-page-category">${escapeHtml(product.category)}</span>` : ""}
              <span class="product-page-status${availability.inStock ? "" : " is-out"}">${escapeHtml(availability.label)}</span>
            </div>
            <h1 id="pp-main-title" class="product-page-title">${escapeHtml(product.title)}</h1>
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
        <a class="product-page-similar-more" href="/#products-section">Daha çox məhsul</a>
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
  <script src="/order-confirmation.js?v=product-pages-20260724"></script>
  <script src="/stock-display-fix.js?v=20260610-1"></script>
  <script src="/product-page.js?v=20260724-refine-1"></script>
</body>
</html>
`.replace(/[ \t]+$/gm, "");
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
    return `<a class="product-page-similar-card" href="/${escapeAttribute(slug)}/">
      <img src="${escapeAttribute(rootRelativeUrl(product.image))}" class="product-page-similar-image" alt="${escapeAttribute(product.title)}">
      <div class="product-page-similar-title">${escapeHtml(product.title)}</div>
      ${product.category ? `<div class="product-page-similar-category">${escapeHtml(product.category)}</div>` : ""}
      <div class="product-page-similar-price">${escapeHtml(priceText)}</div>
    </a>`;
  }).join("");
}

function productOffers(product, canonical, availability, priceCurrency) {
  return (product.plans || [])
    .map((plan) => Number(plan.price))
    .filter((price) => Number.isFinite(price) && price >= 0)
    .map((price) => ({
      "@type": "Offer",
      url: canonical,
      price: price.toFixed(2),
      priceCurrency,
      availability: availability.schema,
      itemCondition: "https://schema.org/NewCondition"
    }));
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
