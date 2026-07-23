const SITE_URL = "https://mirpanel.com";
const DELIVERY_TEXT = "7/24, gün ərzində təqdim olunur.";

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
  <link rel="icon" href="/assets/logo.png">
  <script type="application/ld+json">${structuredData}</script>
  <style>
    body.productDocument{min-height:100vh;background:#070707;color:#fff}
    .productHeader{position:sticky;top:0;z-index:30;border-bottom:1px solid rgba(255,255,255,.09);background:rgba(7,7,7,.92);backdrop-filter:blur(16px)}
    .productHeaderIn{width:min(1180px,calc(100% - 32px));min-height:70px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px}
    .productBrand{display:inline-flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font:700 18px/1 Cinzel,serif;letter-spacing:.05em}
    .productBrand img{width:42px;height:42px;object-fit:contain}
    .productHomeLink,.productBackLink{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 15px;border:1px solid rgba(255,212,0,.42);border-radius:12px;color:#ffd400;text-decoration:none;font:800 13px/1 Poppins,sans-serif}
    .productPageMain{padding-top:28px}
    .productStaticDescription{margin:0 0 18px;color:rgba(255,255,255,.78);line-height:1.7}
    .productVariant{display:inline-flex;margin:0 0 14px;padding:6px 10px;border:1px solid rgba(255,212,0,.28);border-radius:999px;color:#ffd400;font-size:12px;font-weight:800}
    .productStatus{display:inline-flex;align-items:center;gap:7px;margin-bottom:14px;font-size:13px;font-weight:800}
    .productStatus.in{color:#2ed573}.productStatus.out{color:#ff6b6b}
    .productStaticSection{margin-top:20px;padding:22px;border:1px solid rgba(255,212,0,.16);border-radius:18px;background:rgba(10,10,10,.74)}
    .productStaticSection h2{margin:0 0 12px;color:#ffd400;font-size:21px}
    .productStaticSection p{margin:0;color:rgba(255,255,255,.82);line-height:1.72}
    .productStaticPlans{display:grid;gap:10px}
    .productStaticPlan{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 15px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.035)}
    .productStaticPlan strong{color:#ffd400;white-space:nowrap}
    .pp-sim-card{color:inherit;text-decoration:none}
    #pp-plans-container .pp-old-price,#pp-plans-container .pp-plan-disc-badge{display:none!important}
    .productFooter{margin-top:42px;padding:24px 16px;border-top:1px solid rgba(255,255,255,.08);text-align:center;color:rgba(255,255,255,.58);font-size:12px}
    @media(max-width:720px){.productHeaderIn{width:min(100% - 20px,1180px);min-height:62px}.productBrand{font-size:15px}.productBrand img{width:36px;height:36px}.productHomeLink{padding:8px 11px;font-size:11px}.productPageMain{padding-top:18px}.productStaticSection{padding:16px;border-radius:14px}.productStaticSection h2{font-size:18px}.productStaticPlan{align-items:flex-start;flex-direction:column;gap:5px}}
  </style>
</head>
<body class="productDocument" data-product-id="${escapeAttribute(product.id)}" data-product-slug="${escapeAttribute(slug)}">
  <header class="productHeader">
    <div class="productHeaderIn">
      <a class="productBrand" href="/" aria-label="Mirpanel ana səhifə">
        <img src="/assets/logo.png" alt="Mirpanel">
        <span>MIRPANEL</span>
      </a>
      <a class="productHomeLink" href="/">Ana səhifə</a>
    </div>
  </header>

  <main id="productPageView" class="wrap productPageMain">
    <a class="productBackLink" href="/">⟵ Ana səhifəyə qayıt</a>

    <div class="pp-top-grid">
      <div class="pp-box pp-left">
        <div class="pp-img-wrap">
          <span class="pp-avail-badge">${escapeHtml(availability.label)}</span>
          <img id="pp-main-img" src="${escapeAttribute(imageSrc)}" alt="${escapeAttribute(product.title)}">
        </div>
      </div>

      <div class="pp-box pp-center">
        <h1 id="pp-main-title" class="pp-title">${escapeHtml(product.title)}</h1>
        ${product.variant ? `<div class="productVariant">${escapeHtml(product.variant)}</div>` : ""}
        <div class="productStatus ${availability.inStock ? "in" : "out"}">${escapeHtml(availability.label)}</div>
        ${product.desc ? `<p class="productStaticDescription">${escapeHtml(product.desc)}</p>` : ""}
        <div class="pp-delivery">
          <strong style="color:#2ed573">${DELIVERY_TEXT}</strong>
          ${product.note ? `<br>${escapeHtml(product.note)}` : ""}
        </div>

        <h2 class="pp-subtitle">Mövcud planlar</h2>
        <div class="productStaticPlans" data-static-product-plans>${planMarkup}</div>
        <div id="pp-plans-container" class="pp-plans-container" hidden></div>

        <div class="pp-actions" style="margin-top:15px">
          <button class="pp-btn-solid" id="pp-order-btn" type="button">Sifariş et</button>
        </div>
      </div>

      <aside class="pp-box pp-right" aria-label="Oxşar məhsullar">
        <h2 class="pp-subtitle">Oxşar məhsullar</h2>
        <div id="pp-similar-list" class="pp-similar-list">${similarMarkup}</div>
      </aside>
    </div>

    <section class="productStaticSection" id="productSeoStatic">
      <h2>${escapeHtml(product.title)} haqqında</h2>
      <p>${escapeHtml(product.seoContent || product.desc || `${product.title} üçün mövcud planları və qiymətləri bu səhifədə görə bilərsiniz.`)}</p>
    </section>

    <section class="productStaticSection">
      <h2>İstifadə qaydaları</h2>
      <p>${escapeHtml(usageText || "Məhsul məlumatlarında əlavə istifadə qaydası qeyd edilməyib.")}</p>
    </section>

    <section class="pp-bottom-section" hidden aria-hidden="true">
      <div id="pp-tabs-container"></div>
      <div id="pp-content-box"></div>
    </section>
  </main>

  <footer class="productFooter">©️ 2026 Mirpanel • Bütün hüquqlar qorunur</footer>

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

  <script src="/app.js?v=product-pages-20260724"></script>
  <script src="/hbo-max-order-fix.js?v=20260707-prime-video-1"></script>
  <script src="/order-confirmation.js?v=product-pages-20260724"></script>
  <script src="/stock-display-fix.js?v=20260610-1"></script>
  <script src="/product-page.js?v=20260724-2"></script>
</body>
</html>
`.replace(/[ \t]+$/gm, "");
}

function renderPlans(product) {
  const plans = Array.isArray(product.plans) ? product.plans : [];
  if (!plans.length) return `<p>Mövcud plan yoxdur.</p>`;
  return plans.map((plan) => {
    const label = cleanText(plan.label) || `${Number(plan.months) || 1} aylıq`;
    const price = Number(plan.price);
    const priceText = price > 0
      ? `${price.toFixed(2)} ${cleanText(product.currency)}`
      : (cleanText(plan.label) || "Stokda yoxdur");
    return `<div class="productStaticPlan"><span>${escapeHtml(label)}</span><strong>${escapeHtml(priceText)}</strong></div>`;
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
  return [...sameCategory, ...others].slice(0, 4);
}

function renderSimilar(similar) {
  return similar.map(({ product, slug }) => {
    const price = minimumPrice(product);
    const priceText = price > 0
      ? `${price.toFixed(2)} ${cleanText(product.currency)}`
      : "Stokda yoxdur";
    return `<a class="pp-sim-card" href="/${escapeAttribute(slug)}/">
      <img src="${escapeAttribute(rootRelativeUrl(product.image))}" class="pp-sim-img" alt="${escapeAttribute(product.title)}">
      <div class="pp-sim-info"><div class="pp-sim-title">${escapeHtml(product.title)}</div><div class="pp-sim-price">${escapeHtml(priceText)}</div></div>
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
