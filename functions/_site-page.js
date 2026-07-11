const BASE_URL = "https://mirpanel.com";

const DEFAULT_PAGES = {
  haqqimizda: {
    slug: "haqqimizda",
    title: "Haqqımızda",
    subtitle: "Mirpanel haqqında qısa məlumat",
    seoTitle: "Haqqımızda | Mirpanel",
    seoDescription: "Mirpanel premium hesabların sürətli və etibarlı aktivləşdirilməsi üçün xidmət göstərir."
  },
  sertler: {
    slug: "sertler",
    title: "Şərtlər",
    subtitle: "Sifariş və istifadə şərtləri",
    seoTitle: "Şərtlər | Mirpanel",
    seoDescription: "Mirpanel sifariş və istifadə şərtləri."
  },
  elaqe: {
    slug: "elaqe",
    title: "Əlaqə",
    subtitle: "Mirpanel dəstək komandası ilə əlaqə",
    seoTitle: "Əlaqə | Mirpanel",
    seoDescription: "Mirpanel ilə WhatsApp üzərindən əlaqə saxlayın."
  }
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value, fallback) {
  const slug = String(value || "")
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
  return slug || fallback;
}

function extractObject(source, marker) {
  const markerStart = source.indexOf(marker);
  if (markerStart < 0) return null;
  const start = source.indexOf("{", markerStart);
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

async function readPages(context) {
  try {
    const appUrl = new URL(context.request.url);
    appUrl.pathname = "/app.js";
    appUrl.search = "";
    const response = await context.env.ASSETS.fetch(new Request(appUrl, context.request));
    if (!response.ok) return {};
    const source = await response.text();
    const block = extractObject(source, "const SITE_SECTIONS") || extractObject(source, "const SITE_PAGES");
    return block ? JSON.parse(block) : {};
  } catch {
    return {};
  }
}

function normalizePage(key, source = {}) {
  const fallback = DEFAULT_PAGES[key];
  return {
    ...fallback,
    ...source,
    enabled: source.enabled ?? true,
    slug: slugify(source.slug || fallback.slug, fallback.slug),
    title: String(source.title || fallback.title),
    subtitle: String(source.subtitle || fallback.subtitle),
    seoTitle: String(source.seoTitle || fallback.seoTitle),
    seoDescription: String(source.seoDescription || source.subtitle || source.body || source.text || fallback.seoDescription)
  };
}

function injectMeta(html, page) {
  const canonical = `${BASE_URL}/${page.slug}`;
  const title = page.seoTitle || `${page.title} | Mirpanel`;
  const description = page.seoDescription || page.subtitle || page.title;
  let next = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta\s+property=["']og:type["'][^>]*>/i, '<meta property="og:type" content="website" />');

  if (next.match(/<link\s+rel=["']canonical["'][^>]*>/i)) {
    next = next.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}" />`);
  } else {
    next = next.replace(/<\/head>/i, `<link rel="canonical" href="${canonical}" />\n</head>`);
  }

  const extras = `\n<meta property="og:url" content="${canonical}" />\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:title" content="${escapeHtml(title)}" />\n<meta name="twitter:description" content="${escapeHtml(description)}" />`;
  return next.replace(/<\/head>/i, `${extras}\n</head>`);
}

export async function renderSitePage(context, key) {
  const pages = await readPages(context);
  const page = normalizePage(key, pages[key]);
  if (page.enabled === false) return new Response("Not found", { status: 404 });

  const indexUrl = new URL(context.request.url);
  indexUrl.pathname = "/index.html";
  indexUrl.search = "";
  const response = await context.env.ASSETS.fetch(new Request(indexUrl, context.request));
  const html = injectMeta(await response.text(), page);
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-cache");
  return new Response(html, { status: response.status, headers });
}
