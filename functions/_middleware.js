const STATIC_ASSET_RE = /\.(?:js|css|png|jpe?g|webp|svg|ico|gif|avif|xml|txt|json|map|woff2?|ttf|eot|pdf)$/i;

const BASE_URL = "https://mirpanel.com";
const DEFAULT_IMAGE = `${BASE_URL}/assets/logo.png`;
const DEFAULT_REVIEW_BODY = "Sifariş rahat tamamlandı və aktivləşdirmə sürətli edildi.";
const DEFAULT_REVIEW_DATE = "2026-07-10";

const DEFAULT_SEO_SLUGS = {
  capcut: "capcut-pro-almaq",
  netflix: "netflix-sexsi-almaq",
  netflix_umumi: "netflix-umumi-almaq",
  spotify: "spotify-premium-almaq",
  prime: "amazon-prime-video-almaq",
  hbomax: "hbo-max-almaq",
  youtube: "youtube-premium-almaq",
  surfshark: "surfshark-vpn-almaq",
  tiktok_jeton: "tiktok-jeton-almaq",
  google_ai: "google-ai-pro-v3-almaq",
  google_ai_ultra: "google-ai-pro-ultra-almaq",
  captions: "captions-ai-almaq",
  grok_supergrok: "super-grok-ai-almaq",
  claude_ai: "cloud-ai-pro-almaq",
  zoom: "zoom-pro-almaq",
  duolingo: "duolingo-super-almaq",
  canva: "canva-premium-almaq",
  chatgpt: "chatgpt-plus-almaq",
  adobecc: "adobe-creative-cloud-almaq"
};

const SEO_ALIASES = {
  netflix: ["netflix-almaq", "netflix-aile-almaq"],
  prime: ["prime-video-almaq"],
  google_ai: ["gemini-pro-almaq"],
  google_ai_ultra: ["gemini-ultra-almaq"],
  grok_supergrok: ["grok-ai-almaq"],
  claude_ai: ["cloud-ai-max-almaq", "claude-ai-almaq"],
  canva: ["canva-pro-almaq"],
  adobecc: ["adobe-cc-almaq"]
};

const MARKDOWN = `---
title: Mirpanel
description: Premium hesablar və etibarlı aktivləşdirmə xidməti.
url: https://mirpanel.com/
---

# Mirpanel

Mirpanel premium hesablar və rəqəmsal xidmətlər üçün public saytdır. Saytda məhsullar, qiymətlər, stok statusu və sifariş düymələri göstərilir. Brauzer istifadəçiləri üçün normal HTML sayt əsas cavab olaraq qalır.

## Əsas Menyu

- Ana Səhifə
- Məhsullar
- Haqqımızda
- Şərtlər
- Əlaqə

## Məhsullar Haqqında

Mirpanel-də Netflix, Spotify, YouTube Premium, CapCut Pro, Zoom Pro, HBO Max, Amazon Prime Video və digər premium hesab və xidmətlər təqdim olunur. Məhsul kartlarında ad, kateqoriya, qiymət və varsa stok statusu göstərilir.

## Axtarış və Sifariş

İstifadəçi sayt üzərində məhsul axtara, məhsul detail səhifəsinə keçə, mövcud planı seçə və sifariş düyməsi ilə WhatsApp sifariş axınına davam edə bilər.

## Public Discovery Resursları

- Sitemap: https://mirpanel.com/sitemap.xml
- Robots: https://mirpanel.com/robots.txt
- API Catalog: https://mirpanel.com/.well-known/api-catalog
- Agent Card: https://mirpanel.com/.well-known/agent-card.json

## Public API Status

Bu discovery sənədi public sayt haqqında məlumat verir. Admin panel, login, token, private API endpoint-ləri və gizli idarəetmə URL-ləri public discovery üçün paylaşılmır.
`;

function wantsMarkdown(request) {
  return (request.headers.get("Accept") || "").toLowerCase().includes("text/markdown");
}

function isStaticAsset(pathname) {
  return STATIC_ASSET_RE.test(pathname);
}

function isHtmlLikePath(pathname) {
  return pathname === "/" || pathname === "" || pathname.endsWith("/") || pathname.endsWith(".html") || !pathname.includes(".");
}

function estimateTokens(markdown) {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return String(Math.max(1, Math.ceil(words * 1.35)));
}

function absoluteUrl(path) {
  return new URL(path || "/", BASE_URL).href;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
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

function extractObject(source, marker) {
  const startMarker = source.indexOf(marker);
  if (startMarker < 0) return null;
  const start = source.indexOf("{", startMarker);
  if (start < 0) return null;

  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }

    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  return null;
}

function minPrice(product) {
  const prices = (product?.plans || []).map((plan) => Number(plan.price)).filter((price) => price > 0);
  return prices.length ? Math.min(...prices).toFixed(2) : "0.00";
}

function availability(product) {
  const rawStock = product?.stock ?? product?.stockCount ?? product?.stockQuantity;
  if (product?.stockEnabled === true && rawStock !== null && rawStock !== "" && rawStock !== undefined && Number(rawStock) <= 0) {
    return "https://schema.org/OutOfStock";
  }
  if (product?.soldOut || product?.flow === "out_of_stock") return "https://schema.org/OutOfStock";
  return "https://schema.org/InStock";
}

function productSlug(product) {
  return slug(product?.seoSlug || DEFAULT_SEO_SLUGS[product?.id] || `${product?.title || product?.id || "premium-hesab"}-almaq`);
}

function productDescription(product) {
  return String(
    product?.seoDescription ||
    product?.desc ||
    `${product?.title || "Premium hesab"} məhsulunu Azərbaycanda sərfəli qiymətə əldə et. Mirpanel ilə sürətli aktivləşdirmə və rahat sifariş.`
  );
}

function productTitle(product) {
  const name = product?.title || "Premium hesab";
  return String(product?.seoTitle || `${name} almaq | Mirpanel`);
}

function productReviewBody(product) {
  const text = `${product?.id || ""} ${product?.title || ""}`.toLowerCase();
  if (text.includes("netflix")) return "Netflix sifarişi rahat tamamlandı və aktivləşdirmə sürətli edildi.";
  if (text.includes("spotify")) return "Spotify Premium sifarişi rahat tamamlandı və hesab aktivləşdirildi.";
  if (text.includes("capcut")) return "CapCut Pro sifarişi rahat tamamlandı və aktivləşdirmə sürətli edildi.";
  if (text.includes("youtube")) return "YouTube Premium sifarişi rahat tamamlandı və xidmət aktivləşdirildi.";
  if (text.includes("prime") || text.includes("amazon")) return "Amazon Prime Video sifarişi rahat tamamlandı və aktivləşdirmə sürətli edildi.";
  if (text.includes("hbo")) return "HBO Max sifarişi rahat tamamlandı və xidmət aktivləşdirildi.";
  if (text.includes("zoom")) return "Zoom Pro sifarişi rahat tamamlandı və aktivləşdirmə sürətli edildi.";
  if (text.includes("canva")) return "Canva Premium sifarişi rahat tamamlandı və xidmət aktivləşdirildi.";
  if (text.includes("chatgpt")) return "ChatGPT Plus sifarişi rahat tamamlandı və aktivləşdirmə sürətli edildi.";
  return DEFAULT_REVIEW_BODY;
}

function productReview(product) {
  const aggregate = product?.aggregateRating || {};
  const ratingValue = Number(aggregate.ratingValue ?? product?.ratingValue ?? 4.9);
  const reviewCount = Number(aggregate.reviewCount ?? product?.reviewCount ?? 127);
  const bestRating = String(aggregate.bestRating ?? product?.bestRating ?? 5);
  const worstRating = String(aggregate.worstRating ?? product?.worstRating ?? 1);
  const review = Array.isArray(product?.review) ? product.review[0] : product?.review;

  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Number.isFinite(ratingValue) ? String(ratingValue) : "4.9",
      reviewCount: Number.isFinite(reviewCount) ? String(Math.max(1, Math.round(reviewCount))) : "127",
      bestRating,
      worstRating
    },
    review: [
      {
        "@type": "Review",
        author: {
          "@type": "Person",
          name: review?.author?.name || review?.author || "Mirpanel müştərisi"
        },
        datePublished: review?.datePublished || DEFAULT_REVIEW_DATE,
        reviewBody: review?.reviewBody || review?.body || productReviewBody(product),
        reviewRating: {
          "@type": "Rating",
          ratingValue: String(review?.reviewRating?.ratingValue || review?.ratingValue || 5),
          bestRating: String(review?.reviewRating?.bestRating || 5),
          worstRating: String(review?.reviewRating?.worstRating || 1)
        }
      }
    ]
  };
}

function productSchema(product, route) {
  const canonical = `${BASE_URL}${route}`;
  const description = productDescription(product);
  const image = absoluteUrl(product?.image || DEFAULT_IMAGE);
  const rating = productReview(product);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product?.title || "Premium hesab",
    description,
    image,
    brand: {
      "@type": "Brand",
      name: "Mirpanel"
    },
    aggregateRating: rating.aggregateRating,
    review: rating.review,
    offers: {
      "@type": "Offer",
      price: minPrice(product),
      priceCurrency: "AZN",
      availability: availability(product),
      url: canonical
    }
  };
}

async function productSeoRoutes(request) {
  try {
    const response = await fetch(new URL("/app.js", request.url));
    if (!response.ok) return {};
    const source = await response.text();
    const block = extractObject(source, "const DATA");
    if (!block) return {};

    const data = JSON.parse(block);
    const routes = {};

    for (const product of data.products || []) {
      if (product.active === false) continue;
      const routeSlugs = [productSlug(product), ...(SEO_ALIASES[product.id] || []).map(slug)].filter(Boolean);
      for (const item of routeSlugs) {
        routes[`/${item}`] = product;
      }
    }

    return routes;
  } catch {
    return {};
  }
}

function injectScript(html, needle, scriptTag) {
  if (html.includes(needle)) return html;
  return html.replace(/<script src="frontend-routing-detail-fix\.js[^>]*><\/script>/i, `${scriptTag}\n  $&`);
}

function withSeoScripts(html) {
  let next = html;
  next = injectScript(next, "seo.js?v=20260710-seo-1", '<script src="seo.js?v=20260710-seo-1"></script>');
  if (!next.includes("seo-router.js?v=20260710-seo-1")) {
    next = next.replace(/<script src="frontend-routing-detail-fix\.js[^>]*><\/script>/i, '$&\n  <script src="seo-router.js?v=20260710-seo-1"></script>');
  }
  if (!next.includes("site-sections-render.js?v=20260711-sections-1")) {
    next = next.replace(/<script src="app\.js[^>]*><\/script>/i, '$&\n  <script src="site-sections-render.js?v=20260711-sections-1"></script>');
  }
  if (!next.includes("seo-structured-data-fix.js?v=20260713-rating-2")) {
    next = next.replace(/<script src="seo\.js[^>]*><\/script>/i, '$&\n  <script src="seo-structured-data-fix.js?v=20260713-rating-2"></script>');
  }
  return next;
}

function injectMeta(html, route, product) {
  const title = productTitle(product);
  const description = productDescription(product);
  const canonical = `${BASE_URL}${route}`;
  const image = absoluteUrl(product?.image || DEFAULT_IMAGE);
  const schema = productSchema(product, route);

  let next = withSeoScripts(html)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${image}" />`)
    .replace(/<meta\s+property=["']og:type["'][^>]*>/i, '<meta property="og:type" content="product" />');

  if (next.match(/<link\s+rel=["']canonical["'][^>]*>/i)) {
    next = next.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}" />`);
  } else {
    next = next.replace(/<\/head>/i, `<link rel="canonical" href="${canonical}" />\n</head>`);
  }

  const extras = `
<meta property="og:url" content="${canonical}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${image}" />
<script type="application/ld+json" id="mirpanel-edge-product-schema">${JSON.stringify(schema)}</script>`;

  return next.replace(/<\/head>/i, `${extras}\n</head>`);
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const route = pathname.replace(/\/+$/, "") || "/";

  if (isStaticAsset(pathname)) return context.next();

  if (wantsMarkdown(request) && isHtmlLikePath(pathname)) {
    return new Response(MARKDOWN, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Vary": "Accept",
        "x-markdown-tokens": estimateTokens(MARKDOWN),
        "Link": "</.well-known/api-catalog>; rel=\"api-catalog\"; type=\"application/json\", </sitemap.xml>; rel=\"sitemap\"; type=\"application/xml\""
      }
    });
  }

  const response = await context.next();
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html")) return response;

  let html = await response.text();
  const dynamicRoutes = await productSeoRoutes(request);
  const product = dynamicRoutes[route];
  html = product ? injectMeta(html, route, product) : withSeoScripts(html);

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.append("Vary", "Accept");

  return new Response(html, { status: response.status, headers });
}
