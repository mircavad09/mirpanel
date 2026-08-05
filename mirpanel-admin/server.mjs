import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { extractAdminState, mergeAdminPayload, normalizeAdminPayload, patchAppSource } from "./core.mjs";
import {
  generateInfoPageFiles,
  generateProductListingPageFiles,
  generateProductPageFiles,
  generateRedirects as buildRedirects,
  generateSitemap as buildSitemap,
  patchHomeHeader,
  removedInfoPagePaths,
  removedProductPagePaths
} from "./product-pages.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
loadEnv(path.join(root, ".env"));

const config = {
  port: Number(process.env.PORT || 8787),
  repo: process.env.MIRPANEL_GITHUB_REPO || "mircavad09/mirpanel",
  branch: process.env.MIRPANEL_GITHUB_BRANCH || "main",
  token: process.env.MIRPANEL_GITHUB_TOKEN || "",
  username: process.env.ADMIN_USERNAME || "",
  password: process.env.ADMIN_PASSWORD || "",
  secureCookie: process.env.COOKIE_SECURE === "true"
};

const sessions = new Map();
const sessionTtl = 8 * 60 * 60 * 1000;
const maxProductImageSize = 5 * 1024 * 1024;
const productImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;
    const index = value.indexOf("=");
    if (index < 1) continue;
    const key = value.slice(0, index).trim();
    const content = value.slice(index + 1).trim().replace(/^[']|[']$/g, "").replace(/^[\"]|[\"]$/g, "");
    if (!process.env[key]) process.env[key] = content;
  }
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    ...headers
  });
  response.end(JSON.stringify(body));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim().split("="))
      .filter(([key]) => key)
  );
}

function getSession(request) {
  const id = getCookies(request).mirpanel_session;
  const current = id && sessions.get(id);

  if (!current || current.expiresAt < Date.now()) {
    if (id) sessions.delete(id);
    return null;
  }

  current.expiresAt = Date.now() + sessionTtl;
  return current;
}

function sessionCookie(id, maxAge = sessionTtl / 1000) {
  return [
    `mirpanel_session=${id}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${maxAge}`,
    config.secureCookie ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

async function readBody(request, limit = 1_500_000) {
  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Göndərilən məlumat çox böyükdür.");
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function safeUploadSlug(value) {
  return String(value || "product")
    .trim()
    .toLowerCase()
    .replaceAll("ə", "e")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "product";
}

function extensionFromUpload(fileName, mimeType) {
  const rawName = String(fileName || "");
  if (!rawName || rawName.includes("..") || /[\\/]/.test(rawName)) return "";
  const fileExtension = path.extname(rawName).slice(1).toLowerCase();
  if (!["jpg", "jpeg", "png", "webp"].includes(fileExtension)) return "";

  const normalizedMime = String(mimeType || "").toLowerCase();
  if (productImageTypes.has(normalizedMime)) {
    const mimeExtension = productImageTypes.get(normalizedMime);
    const normalizedFileExtension = fileExtension === "jpeg" ? "jpg" : fileExtension;
    return normalizedFileExtension === mimeExtension ? mimeExtension : "";
  }

  return fileExtension === "jpeg" ? "jpg" : fileExtension;
}

function matchesImageSignature(buffer, extension) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (extension === "jpg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (extension === "png") {
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (extension === "webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

function gitBlobSha(buffer) {
  const content = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return crypto
    .createHash("sha1")
    .update(Buffer.from(`blob ${content.length}\0`))
    .update(content)
    .digest("hex");
}

function validateGeneratedOutput(appSource, files) {
  new vm.Script(appSource, { filename: "app.js" });
  const residue = new RegExp([
    ["tokens", "truncated"].join(" "),
    ["Ran", "command"].join(" "),
    ["Stopped", "command"].join(" "),
    `^${["Exit", "code:"].join(" ")}`,
    `^${["Wall", "time:"].join(" ")}`,
    `^${"Out" + "put:"}`
  ].join("|"), "m");
  for (const [filePath, content] of files) {
    if (residue.test(String(content))) {
      throw new Error(`${filePath}: alət çıxışı qalığı aşkarlandı.`);
    }
    if (filePath.endsWith("/index.html")) {
      if (!/<title>[\s\S]+<\/title>/.test(content) || !/<h1\b/.test(content)) {
        throw new Error(`${filePath}: məcburi title və ya H1 yoxdur.`);
      }
    }
  }
}

function sameOrigin(request) {
  const origin = String(request.headers.origin || "");
  if (!origin) return true;
  try {
    return new URL(origin).host === String(request.headers.host || "");
  } catch {
    return false;
  }
}

async function github(pathname, options = {}) {
  if (!config.token) throw new Error("MIRPANEL_GITHUB_TOKEN təyin edilməyib.");

  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mirpanel-admin",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || `GitHub xətası: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function getRepoFile(filePath, ref = config.branch) {
  const file = await github(
    `/repos/${config.repo}/contents/${filePath}?ref=${encodeURIComponent(ref)}`
  );

  return {
    sha: file.sha,
    source: Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8")
  };
}

async function getAppFile() {
  return getRepoFile("app.js");
}

function bumpAssetVersions(source, version) {
  return source
    .replace(/style\.css\?v=[^"]+/g, `style.css?v=${version}`)
    .replace(/site-header\.css\?v=[^"]+/g, `site-header.css?v=${version}`)
    .replace(/site-header\.js\?v=[^"]+/g, `site-header.js?v=${version}`)
    .replace(/app\.js\?v=[^"]+/g, `app.js?v=${version}`)
    .replace(/cms-site\.js\?v=[^"]+/g, `cms-site.js?v=${version}`)
    .replace(/order-confirmation\.js\?v=[^"]+/g, `order-confirmation.js?v=${version}`);
}

function escapeHomeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function homeProductSlug(product = {}) {
  return seoSlug(product.seoSlug || product.title || product.id)
    .replace(/-almaq$/, "")
    .replace(/(^|-)hesab0(?=-|$)/g, "$1hesab");
}

function patchHomeStructuredData(source, cms = {}, products = []) {
  const site = cms.site || {};
  const seo = cms.seo?.home || {};
  const intro = cms.homepage?.seoIntro || {};
  const brand = String(site.brandName || "Mirpanel").trim() || "Mirpanel";
  const phone = String(site.whatsappNumber || "").replace(/\D/g, "");
  const logoPath = String(site.logo || "assets/logo.png").replace(/^\/+/, "");
  const organization = {
    "@type": "Organization",
    "@id": "https://mirpanel.com/#organization",
    name: brand,
    url: "https://mirpanel.com/",
    logo: `https://mirpanel.com/${logoPath}`
  };
  if (phone) {
    organization.contactPoint = {
      "@type": "ContactPoint",
      telephone: `+${phone}`,
      contactType: "customer support",
      availableLanguage: "az"
    };
  }
  const schema = {
    "@context": "https://schema.org",
    "@graph": [organization, {
      "@type": "WebSite",
      "@id": "https://mirpanel.com/#website",
      name: brand,
      url: "https://mirpanel.com/",
      publisher: { "@id": "https://mirpanel.com/#organization" },
      inLanguage: "az"
    }]
  };
  const jsonLd = JSON.stringify(schema).replace(/</g, "\\u003c");
  let next = source.replace(
    /(<script id="mirpanel-home-schema" type="application\/ld\+json">)[\s\S]*?(<\/script>)/,
    `$1\n  ${jsonLd}\n  $2`
  );

  const title = String(seo.title || "Premium rəqəmsal məhsullar Azərbaycanda | Mirpanel").trim();
  const description = String(seo.description || "Netflix, Spotify Premium, ChatGPT Plus, CapCut Pro və digər rəqəmsal məhsulların mövcud planlarını Mirpanel-də nəzərdən keçirin.").trim();
  const ogTitle = String(seo.ogTitle || title).trim();
  const ogDescription = String(seo.ogDescription || description).trim();
  next = next
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHomeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escapeHomeHtml(description)}" />`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:title" content="${escapeHomeHtml(ogTitle)}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:description" content="${escapeHomeHtml(ogDescription)}" />`);

  const targets = [
    ["netflix", "Netflix"],
    ["spotify", "Spotify Premium"],
    ["chatgpt", "ChatGPT Plus"],
    ["capcut", "CapCut Pro"],
    ["youtube", "YouTube Premium"],
    ["canva", "Canva Premium"]
  ];
  const links = targets.flatMap(([id, label]) => {
    const product = products.find((item) => item.id === id && item.active !== false);
    const slug = product && homeProductSlug(product);
    return slug ? [`<a href="/mehsul/${slug}">${escapeHomeHtml(label)}</a>`] : [];
  });
  const introTitle = String(intro.title || "Azərbaycanda premium rəqəmsal məhsullar").trim();
  const introText = String(intro.text || "Mirpanel rəqəmsal məhsulların mövcud planlarını, qiymətlərini və sifariş məlumatlarını bir yerdə nəzərdən keçirməyə imkan verir.").trim();
  const linksText = links.length
    ? `Populyar seçimlər: ${links.slice(0, -1).join(", ")}${links.length > 1 ? " və " : ""}${links.at(-1)}. `
    : "";
  const introPattern = /\s*<section class="wrap homeSeoIntro"[\s\S]*?<\/section>\s*/;
  if (intro.enabled === false) {
    next = next.replace(introPattern, "\n\n    ");
  } else {
    const introHtml = `<section class="wrap homeSeoIntro" id="homeSeoIntro" aria-labelledby="homeSeoIntroTitle">\n      <h2 id="homeSeoIntroTitle">${escapeHomeHtml(introTitle)}</h2>\n      <p id="homeSeoIntroText">${escapeHomeHtml(introText)}</p>\n      <p class="homeSeoLinks">${linksText}<a href="/mehsul">Bütün məhsullara baxın</a>.</p>\n    </section>`;
    if (introPattern.test(next)) {
      next = next.replace(introPattern, `\n\n    ${introHtml}\n\n    `);
    } else {
      next = next.replace(/\n\s*<div id="products-section">/, `\n\n    ${introHtml}\n\n    <div id="products-section">`);
    }
  }
  return next;
}

const defaultSeoSlugs = {
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

const defaultSeoAliases = {
  netflix: ["netflix-almaq", "netflix-aile-almaq"],
  prime: ["prime-video-almaq"],
  google_ai: ["gemini-pro-almaq"],
  google_ai_ultra: ["gemini-ultra-almaq"],
  grok_supergrok: ["grok-ai-almaq"],
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
  "/admin https://mirpanel.onrender.com/ 302",
  "/admin.html https://mirpanel.onrender.com/ 302",
  "/admin/* https://mirpanel.onrender.com/:splat 302"
];

const standaloneSeoRedirects = [
  "/netflix-almaq /netflix-almaq/index.html 200",
  "/netflix-almaq/ /netflix-almaq/index.html 200"
];

function seoSlug(value) {
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

function productSeoSlug(product) {
  return seoSlug(
    product.seoSlug ||
    defaultSeoSlugs[product.id] ||
    `${product.title || product.id}-almaq`
  );
}

function activeProductSlugs(products = []) {
  const slugs = new Set();

  for (const product of products) {
    if (product.active === false) continue;
    const slug = productSeoSlug(product);
    if (slug) slugs.add(slug);
    for (const alias of defaultSeoAliases[product.id] || []) {
      const aliasSlug = seoSlug(alias);
      if (aliasSlug) slugs.add(aliasSlug);
    }
  }

  return [...slugs];
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

function generateSitemap(products = [], siteSections = {}) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const sitePageUrls = activeSitePageSlugs(siteSections)
    .map((slug) => `  <url><loc>https://mirpanel.com/${slug}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`)
    .join("\n");
  const productUrls = activeProductSlugs(products)
    .map((slug) => `  <url><loc>https://mirpanel.com/${slug}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`)
    .join("\n");
  const urls = [sitePageUrls, productUrls].filter(Boolean).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://mirpanel.com/</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
${urls}
</urlset>
`;
}

function generateRedirects(products = [], siteSections = {}) {
  const sitePageRoutes = activeSitePageSlugs(siteSections)
    .flatMap((slug) => [`/${slug} /index.html 200`, `/${slug}/ /index.html 200`]);
  const productRoutes = activeProductSlugs(products)
    .filter((slug) => slug !== "netflix-almaq")
    .map((slug) => `/${slug} /index.html 200`);

  return `${[...adminRedirects, ...standaloneSeoRedirects, ...sitePageRoutes, ...productRoutes].join("\n")}\n`;
}

async function updateRepoTextFile(filePath, content, message) {
  const current = await getRepoFile(filePath);

  if (current.source === content) {
    return "";
  }

  const result = await github(`/repos/${config.repo}/contents/${filePath}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      sha: current.sha,
      branch: config.branch
    })
  });

  return result.commit.sha;
}

async function getBranchHead() {
  const reference = await github(
    `/repos/${config.repo}/git/ref/heads/${encodeURIComponent(config.branch)}`
  );
  const commit = await github(`/repos/${config.repo}/git/commits/${reference.object.sha}`);
  return {
    commitSha: reference.object.sha,
    treeSha: commit.tree.sha
  };
}

async function createGitBlob(content) {
  const binary = Buffer.isBuffer(content);
  const blob = await github(`/repos/${config.repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({
      content: binary ? content.toString("base64") : String(content),
      encoding: binary ? "base64" : "utf-8"
    })
  });
  return blob.sha;
}

async function commitRepoFiles({ parent, files, removedPaths, message }) {
  const blobEntries = await Promise.all(
    [...files].map(async ([filePath, content]) => ({
      path: filePath,
      mode: "100644",
      type: "blob",
      sha: await createGitBlob(content)
    }))
  );
  const removedEntries = [...new Set(removedPaths || [])].map((filePath) => ({
    path: filePath,
    mode: "100644",
    type: "blob",
    sha: null
  }));
  const tree = await github(`/repos/${config.repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: parent.treeSha,
      tree: [...blobEntries, ...removedEntries]
    })
  });
  const commit = await github(`/repos/${config.repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [parent.commitSha]
    })
  });
  await github(
    `/repos/${config.repo}/git/refs/heads/${encodeURIComponent(config.branch)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false })
    }
  );

  return {
    commitSha: commit.sha,
    blobs: new Map(blobEntries.map((entry) => [entry.path, entry.sha]))
  };
}

function requireAuth(request, response) {
  if (getSession(request)) return true;
  json(response, 401, { error: "Sessiya bitib. Yenidən daxil ol." });
  return false;
}

function requireMutationAuth(request, response) {
  const session = getSession(request);
  if (!session) {
    json(response, 401, { error: "Sessiya bitib. Yenidən daxil ol." });
    return null;
  }
  if (!sameOrigin(request)) {
    json(response, 403, { error: "Sorğunun mənbəyi etibarlı deyil." });
    return null;
  }
  if (!safeEqual(request.headers["x-csrf-token"], session.csrfToken)) {
    json(response, 403, { error: "Təhlükəsizlik tokeni yanlışdır. Səhifəni yeniləyin." });
    return null;
  }
  return session;
}

async function handleApi(request, response) {
  if (request.method === "POST" && request.url === "/api/login") {
    const body = await readBody(request, 20_000);

    if (!config.username || !config.password) {
      return json(response, 500, {
        error: "Login environment variable-ları təyin edilməyib."
      });
    }

    if (
      !safeEqual(body.username, config.username) ||
      !safeEqual(body.password, config.password)
    ) {
      return json(response, 401, {
        error: "İstifadəçi adı və ya şifrə yanlışdır."
      });
    }

    const id = crypto.randomBytes(32).toString("hex");
    sessions.set(id, {
      expiresAt: Date.now() + sessionTtl,
      csrfToken: crypto.randomBytes(24).toString("hex"),
      preview: null,
      draft: null,
      pendingUploads: new Map()
    });

    return json(response, 200, { ok: true }, {
      "Set-Cookie": sessionCookie(id)
    });
  }

  if (request.method === "POST" && request.url === "/api/logout") {
    const id = getCookies(request).mirpanel_session;
    if (id) sessions.delete(id);

    return json(response, 200, { ok: true }, {
      "Set-Cookie": sessionCookie("", 0)
    });
  }

  if (!requireAuth(request, response)) return;

  if (request.method === "GET" && request.url === "/api/session") {
    return json(response, 200, {
      ok: true,
      csrfToken: getSession(request).csrfToken
    });
  }

  if (request.method === "GET" && request.url === "/api/admin/state") {
    const file = await getAppFile();
    const session = getSession(request);
    const draft = session.draft;
    const hasDraft = Boolean(draft?.data && draft?.baseSha);

    return json(response, 200, {
      sha: hasDraft ? draft.baseSha : file.sha,
      currentSha: file.sha,
      data: hasDraft ? draft.data : extractAdminState(file.source),
      draftSaved: hasDraft,
      draftConflict: hasDraft && draft.baseSha !== file.sha,
      pendingUploads: [...(session.pendingUploads?.keys() || [])],
      csrfToken: session.csrfToken,
      loadedAt: new Date().toISOString()
    });
  }

  if (request.method === "GET" && request.url === "/api/admin/history") {
    const commits = await github(
      `/repos/${config.repo}/commits?sha=${encodeURIComponent(config.branch)}&path=app.js&per_page=20`
    );
    return json(response, 200, {
      items: commits.map((commit) => ({
        sha: commit.sha,
        date: commit.commit?.committer?.date || "",
        message: commit.commit?.message || "",
        section: "Sayt məzmunu",
        type: "Yayım",
        deployStatus: "GitHub-a göndərilib"
      }))
    });
  }

  if (request.method === "GET" && request.url.startsWith("/api/admin/deploy-status")) {
    const requestUrl = new URL(request.url, "http://localhost");
    const expectedSha = String(requestUrl.searchParams.get("appSha") || "");
    const requestedImage = String(requestUrl.searchParams.get("imagePath") || "").trim();
    let imageUrl = "";
    try {
      const parsedImage = new URL(requestedImage || "/", "https://mirpanel.com/");
      if (parsedImage.origin === "https://mirpanel.com" && requestedImage) imageUrl = parsedImage.href;
    } catch { /* invalid image URL is reported below */ }
    const [siteResult, adminResult, imageResult] = await Promise.allSettled([
      fetch(`https://mirpanel.com/app.js?deploy-check=${Date.now()}`, { redirect: "follow" }),
      fetch("https://mirpanel.onrender.com/", { redirect: "follow" }),
      imageUrl ? fetch(imageUrl, { redirect: "follow", headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" } }) : Promise.resolve(null)
    ]);
    let liveAppSha = "";
    let siteStatus = 0;
    if (siteResult.status === "fulfilled") {
      siteStatus = siteResult.value.status;
      if (siteResult.value.ok) {
        liveAppSha = gitBlobSha(Buffer.from(await siteResult.value.arrayBuffer()));
      }
    }
    const adminStatus = adminResult.status === "fulfilled" ? adminResult.value.status : 0;
    const imageResponse = imageResult.status === "fulfilled" ? imageResult.value : null;
    const imageStatus = imageResponse?.status || 0;
    const imageType = imageResponse?.headers?.get("content-type") || "";
    const imageLive = !imageUrl || (imageStatus === 200 && /^image\/(?:jpeg|png|webp)$/i.test(imageType));
    return json(response, 200, {
      cloudflare: {
        status: siteStatus,
        live: Boolean(expectedSha && liveAppSha === expectedSha && imageLive),
        liveAppSha,
        bannerImage: {
          url: imageUrl,
          status: imageStatus,
          contentType: imageType,
          live: imageLive
        }
      },
      render: {
        url: "https://mirpanel.onrender.com/",
        status: adminStatus,
        live: adminStatus === 200
      }
    });
  }

  if (request.method === "GET" && request.url.startsWith("/api/admin/pending-image")) {
    const session = getSession(request);
    const requestUrl = new URL(request.url, "http://localhost");
    const requestedPath = String(requestUrl.searchParams.get("path") || "")
      .replace(/^\/+/, "")
      .split("?")[0];
    const fileBuffer = session.pendingUploads?.get(requestedPath);
    if (!fileBuffer) return json(response, 404, { error: "Gözləyən şəkil tapılmadı." });
    const extension = path.extname(requestedPath).toLowerCase();
    const contentType = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": fileBuffer.length,
      "Cache-Control": "no-store"
    });
    return response.end(fileBuffer);
  }

  if (request.method === "POST" && request.url === "/api/upload-product-image") {
    const session = requireMutationAuth(request, response);
    if (!session) return;
    const body = await readBody(request, 7_500_000);
    const extension = extensionFromUpload(body.fileName, body.mimeType);
    const mimeType = String(body.mimeType || "").toLowerCase();

    if (!extension || (mimeType && !productImageTypes.has(mimeType))) {
      return json(response, 400, {
        error: "Bu fayl tipi dəstəklənmir. Yalnız JPG, PNG və WEBP qəbul edilir."
      });
    }

    const contentBase64 = String(body.contentBase64 || "").replace(/^data:[^,]+,/, "").replace(/\s/g, "");
    if (!contentBase64) {
      return json(response, 400, { error: "Şəkil faylı göndərilməyib." });
    }

    const fileBuffer = Buffer.from(contentBase64, "base64");
    if (!fileBuffer.length) {
      return json(response, 400, { error: "Şəkil faylı oxunmadı." });
    }

    if (fileBuffer.length > maxProductImageSize) {
      return json(response, 413, { error: "Fayl ölçüsü böyükdür. Maksimum 5 MB." });
    }

    if (!matchesImageSignature(fileBuffer, extension)) {
      return json(response, 400, {
        error: "Faylın məzmunu seçilmiş şəkil formatına uyğun deyil."
      });
    }

    const productId = safeUploadSlug(body.productId);
    const stamp = Date.now();
    const random = crypto.randomBytes(4).toString("hex");
    const repoPath = `uploads/products/${productId}-${stamp}-${random}.${extension}`;

    session.pendingUploads.set(repoPath, fileBuffer);

    return json(response, 200, {
      ok: true,
      path: `${repoPath}?v=${stamp}`,
      publicPath: `/${repoPath}?v=${stamp}`,
      filePath: repoPath,
      previewDataUrl: `data:${mimeType};base64,${fileBuffer.toString("base64")}`,
      staged: true,
      uploadedAt: new Date().toISOString()
    });
  }

  if (request.method === "POST" && request.url === "/api/admin/banner-draft") {
    const session = requireMutationAuth(request, response);
    if (!session) return;
    const body = await readBody(request);
    const productId = String(body.productId || "").trim();
    if (!body.baseSha || !productId || !body.banner) {
      return json(response, 400, { error: "Banner, məhsul ID-si və baseSha tələb olunur." });
    }
    const parent = await getBranchHead();
    const current = await getRepoFile("app.js", parent.commitSha);
    const publishedData = extractAdminState(current.source);
    const draftBase = session.draft?.baseSha === body.baseSha
      ? session.draft.data
      : publishedData;
    const draftData = structuredClone(draftBase);
    const product = draftData.products.find((item) => item.id === productId);
    if (!product) return json(response, 404, { error: "Məhsul tapılmadı." });
    product.banner = structuredClone(body.banner);
    draftData.cms ||= {};
    if (Array.isArray(body.media)) draftData.cms.media = structuredClone(body.media);
    const normalized = normalizeAdminPayload(mergeAdminPayload(publishedData, draftData));
    session.draft = {
      baseSha: body.baseSha,
      data: normalized,
      savedAt: Date.now()
    };
    session.preview = null;
    return json(response, 200, {
      ok: true,
      draftSaved: true,
      draftConflict: current.sha !== body.baseSha,
      currentSha: current.sha,
      savedAt: new Date(session.draft.savedAt).toISOString()
    });
  }

  if (request.method === "POST" && request.url === "/api/admin/preview") {
    const session = requireMutationAuth(request, response);
    if (!session) return;
    const body = await readBody(request);
    if (!body.baseSha || !body.data) {
      return json(response, 400, { error: "baseSha və data tələb olunur." });
    }
    const current = await getAppFile();
    if (current.sha !== body.baseSha) {
      return json(response, 409, {
        error: "Məzmun GitHub-da dəyişib. Səhifəni yeniləyin.",
        currentSha: current.sha
      });
    }
    const currentData = extractAdminState(current.source);
    const normalized = normalizeAdminPayload(mergeAdminPayload(currentData, body.data));
    const previewProductPages = generateProductPageFiles(normalized.products, normalized.siteSections, normalized.cms, normalized.content);
    const previewProductListing = generateProductListingPageFiles(normalized.products, normalized.siteSections, normalized.cms);
    const previewInfoPages = generateInfoPageFiles(normalized.siteSections, normalized.ui, normalized.cms);
    validateGeneratedOutput(
      patchAppSource(current.source, normalized),
      new Map([...previewProductPages, ...previewProductListing, ...previewInfoPages])
    );
    const digest = crypto
      .createHash("sha256")
      .update(JSON.stringify({ baseSha: body.baseSha, data: normalized }))
      .digest("hex");
    const previewCssPath = path.join(root, "..", "info-page.css");
    const previewCss = fs.existsSync(previewCssPath) ? fs.readFileSync(previewCssPath, "utf8") : "";
    const prepareInfoPreview = (pageHtml) => pageHtml
        .replace("<head>", '<head><base href="https://mirpanel.com/">')
        .replace("</head>", `<style>${previewCss.replace(/<\/style/gi, "<\\/style")}</style></head>`);
    const aboutSlug = normalized.siteSections?.haqqimizda?.slug || "haqqimizda";
    const termsSlug = normalized.siteSections?.sertler?.slug || "sertler";
    const rawAboutPreviewHtml = previewInfoPages.get(aboutSlug) || "";
    const rawTermsPreviewHtml = previewInfoPages.get(termsSlug) || "";
    const aboutPreviewHtml = rawAboutPreviewHtml ? prepareInfoPreview(rawAboutPreviewHtml) : "";
    const termsPreviewHtml = rawTermsPreviewHtml ? prepareInfoPreview(rawTermsPreviewHtml) : "";
    session.preview = { digest, baseSha: body.baseSha, at: Date.now() };
    return json(response, 200, {
      ok: true,
      previewDigest: digest,
      productCount: normalized.products.length,
      activeProductCount: normalized.products.filter((item) => item.active !== false).length,
      pageCount: previewProductPages.size + previewProductListing.size + previewInfoPages.size,
      aboutPreviewHtml,
      termsPreviewHtml,
      warnings: normalized.cms?.seo?.robotsIndexing === false
        ? ["Bütün saytın indekslənməsi söndürülüb."]
        : []
    });
  }

  if (request.method === "POST" && request.url === "/api/admin/restore-preview") {
    const session = requireMutationAuth(request, response);
    if (!session) return;
    const body = await readBody(request, 20_000);
    const targetSha = String(body.targetSha || "").trim();
    if (!/^[a-f0-9]{40}$/i.test(targetSha)) {
      return json(response, 400, { error: "Düzgün commit SHA tələb olunur." });
    }
    const [historical, current] = await Promise.all([
      getRepoFile("app.js", targetSha),
      getAppFile()
    ]);
    const normalized = extractAdminState(historical.source);
    const digest = crypto
      .createHash("sha256")
      .update(JSON.stringify({ baseSha: current.sha, data: normalized }))
      .digest("hex");
    session.preview = { digest, baseSha: current.sha, at: Date.now(), restoredFrom: targetSha };
    return json(response, 200, {
      ok: true,
      data: normalized,
      baseSha: current.sha,
      previewDigest: digest,
      restoredFrom: targetSha
    });
  }

  if (request.method === "POST" && request.url === "/api/admin/save") {
    const session = requireMutationAuth(request, response);
    if (!session) return;
    const body = await readBody(request);

    if (!body.baseSha || !body.data) {
      return json(response, 400, {
        error: "baseSha və data tələb olunur."
      });
    }

    const parent = await getBranchHead();
    const current = await getRepoFile("app.js", parent.commitSha);

    if (current.sha !== body.baseSha) {
      return json(response, 409, {
        error: "app.js GitHub-da başqa yerdə dəyişib. Səhifəni yenilə.",
        currentSha: current.sha
      });
    }

    const previousData = extractAdminState(current.source);
    const previousIds = new Set(previousData.products.map((product) => product.id));
    for (const product of body.data.products || []) {
      const stableId = String(product._stableId || "");
      if (stableId && previousIds.has(stableId) && stableId !== String(product.id || "")) {
        return json(response, 400, {
          error: `${stableId}: məhsul ID-si yaradıldıqdan sonra dəyişdirilə bilməz.`
        });
      }
    }
    const adminData = normalizeAdminPayload(mergeAdminPayload(previousData, body.data));
    const digest = crypto
      .createHash("sha256")
      .update(JSON.stringify({ baseSha: body.baseSha, data: adminData }))
      .digest("hex");
    if (
      !body.previewDigest ||
      !session.preview ||
      session.preview.digest !== digest ||
      session.preview.baseSha !== body.baseSha
    ) {
      return json(response, 400, {
        error: "Yayımlamadan əvvəl cari dəyişiklikləri önizləyin."
      });
    }
    const patched = patchAppSource(current.source, adminData);
    const indexFile = await getRepoFile("index.html", parent.commitSha);
    const version = `admin-${Date.now()}`;
    const patchedIndex = patchHomeStructuredData(
      patchHomeHeader(bumpAssetVersions(indexFile.source, version), adminData.siteSections, adminData.cms),
      adminData.cms,
      adminData.products
    );
    const productPages = generateProductPageFiles(adminData.products, adminData.siteSections, adminData.cms, adminData.content);
    const productListing = generateProductListingPageFiles(adminData.products, adminData.siteSections, adminData.cms);
    const infoPages = generateInfoPageFiles(adminData.siteSections, adminData.ui, adminData.cms);
    const files = new Map([
      ["app.js", patched],
      ["index.html", patchedIndex],
      ["sitemap.xml", buildSitemap(adminData.products, adminData.siteSections, new Date(), adminData.cms)],
      ["_redirects", buildRedirects(adminData.products, adminData.siteSections, previousData)],
      ...productPages,
      ...productListing,
      ...infoPages
    ]);
    for (const [filePath, buffer] of session.pendingUploads || []) {
      files.set(filePath, buffer);
    }
    validateGeneratedOutput(patched, files);
    const result = await commitRepoFiles({
      parent,
      files,
      removedPaths: [
        ...removedProductPagePaths(previousData.products, adminData.products),
        ...removedInfoPagePaths(previousData.siteSections, adminData.siteSections)
      ],
      message: "Update Mirpanel content and product pages from admin panel"
    });
    const appSha = result.blobs.get("app.js");
    session.preview = null;
    session.draft = null;
    session.pendingUploads?.clear();

    return json(response, 200, {
      sha: appSha,
      commitSha: result.commitSha,
      cacheCommitSha: result.commitSha,
      sitemapCommitSha: result.commitSha,
      redirectsCommitSha: result.commitSha,
      productPagesCommitSha: result.commitSha,
      productPageCount: productPages.size,
      infoPageCount: infoPages.size,
      committedAt: new Date().toISOString()
    });
  }

  return json(response, 404, { error: "Endpoint tapılmadı." });
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function serveFile(response, name) {
  const file = path.join(publicDir, name);

  if (!file.startsWith(publicDir) || !fs.existsSync(file)) {
    return json(response, 404, { error: "Fayl tapılmadı." });
  }

  response.writeHead(200, {
    "Content-Type": mime[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow"
  });

  fs.createReadStream(file).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (pathname.startsWith("/api/")) {
      return await handleApi(request, response);
    }

    if (pathname === "/" || pathname === "/login.html") {
      return serveFile(response, "login.html");
    }

    if (pathname === "/admin") {
      response.writeHead(302, { Location: "/admin.html" });
      return response.end();
    }

    if (pathname === "/admin.html") {
      if (!getSession(request)) {
        response.writeHead(302, { Location: "/login.html" });
        return response.end();
      }

      return serveFile(response, "admin.html");
    }

    if (["/admin.css", "/admin.js", "/login.js", "/admin-stock-save-fix.js", "/cms-admin.js"].includes(pathname)) {
      return serveFile(response, pathname.slice(1));
    }

    return json(response, 404, { error: "Səhifə tapılmadı." });
  } catch (error) {
    console.error(error);
    return json(response, error.status || 500, {
      error: error.message || "Server xətası."
    });
  }
});

server.listen(config.port, () => {
  console.log(`Mirpanel admin: http://localhost:${config.port}`);
});

