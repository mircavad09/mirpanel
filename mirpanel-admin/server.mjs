import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAdminState, normalizeAdminPayload, patchAppSource } from "./core.mjs";

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
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"]
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
  const normalizedMime = String(mimeType || "").toLowerCase();
  if (productImageTypes.has(normalizedMime)) return productImageTypes.get(normalizedMime);

  const ext = path.extname(String(fileName || "")).slice(1).toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "svg"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }

  return "";
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

async function getRepoFile(filePath) {
  const file = await github(
    `/repos/${config.repo}/contents/${filePath}?ref=${encodeURIComponent(config.branch)}`
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
    .replace(/app\.js\?v=[^"]+/g, `app.js?v=${version}`)
    .replace(/order-confirmation\.js\?v=[^"]+/g, `order-confirmation.js?v=${version}`);
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

function generateSitemap(products = []) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const productUrls = activeProductSlugs(products)
    .map((slug) => `  <url><loc>https://mirpanel.com/${slug}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://mirpanel.com/</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
${productUrls}
</urlset>
`;
}

function generateRedirects(products = []) {
  return `${activeProductSlugs(products)
    .map((slug) => `/${slug} /index.html 200`)
    .join("\n")}\n`;
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

function requireAuth(request, response) {
  if (getSession(request)) return true;
  json(response, 401, { error: "Sessiya bitib. Yenidən daxil ol." });
  return false;
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
    sessions.set(id, { expiresAt: Date.now() + sessionTtl });

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
    return json(response, 200, { ok: true });
  }

  if (request.method === "GET" && request.url === "/api/admin/state") {
    const file = await getAppFile();

    return json(response, 200, {
      sha: file.sha,
      data: extractAdminState(file.source),
      loadedAt: new Date().toISOString()
    });
  }

  if (request.method === "POST" && request.url === "/api/upload-product-image") {
    const body = await readBody(request, 7_500_000);
    const extension = extensionFromUpload(body.fileName, body.mimeType);
    const mimeType = String(body.mimeType || "").toLowerCase();

    if (!extension || (mimeType && !productImageTypes.has(mimeType))) {
      return json(response, 400, {
        error: "Bu fayl tipi dəstəklənmir. JPG, PNG, WEBP və SVG qəbul edilir."
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

    const productId = safeUploadSlug(body.productId);
    const stamp = Date.now();
    const random = crypto.randomBytes(4).toString("hex");
    const repoPath = `uploads/products/${productId}-${stamp}-${random}.${extension}`;

    const result = await github(`/repos/${config.repo}/contents/${repoPath}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Upload product image for ${productId}`,
        content: fileBuffer.toString("base64"),
        branch: config.branch
      })
    });

    return json(response, 200, {
      ok: true,
      path: `${repoPath}?v=${stamp}`,
      publicPath: `/${repoPath}?v=${stamp}`,
      filePath: repoPath,
      commitSha: result.commit.sha,
      uploadedAt: new Date().toISOString()
    });
  }

  if (request.method === "POST" && request.url === "/api/admin/save") {
    const body = await readBody(request);

    if (!body.baseSha || !body.data) {
      return json(response, 400, {
        error: "baseSha və data tələb olunur."
      });
    }

    const current = await getAppFile();

    if (current.sha !== body.baseSha) {
      return json(response, 409, {
        error: "app.js GitHub-da başqa yerdə dəyişib. Səhifəni yenilə.",
        currentSha: current.sha
      });
    }

    const adminData = normalizeAdminPayload(body.data);
    const patched = patchAppSource(current.source, adminData);

    const result = await github(`/repos/${config.repo}/contents/app.js`, {
      method: "PUT",
      body: JSON.stringify({
        message: "Update Mirpanel content from admin panel",
        content: Buffer.from(patched, "utf8").toString("base64"),
        sha: current.sha,
        branch: config.branch
      })
    });

    let cacheCommitSha = "";
    let sitemapCommitSha = "";
    let redirectsCommitSha = "";
    try {
      sitemapCommitSha = await updateRepoTextFile(
        "sitemap.xml",
        generateSitemap(adminData.products),
        "Update SEO sitemap from admin panel"
      );
      redirectsCommitSha = await updateRepoTextFile(
        "_redirects",
        generateRedirects(adminData.products),
        "Update SEO route redirects from admin panel"
      );
    } catch (error) {
      console.error("SEO route file update failed:", error);
    }

    try {
      const indexFile = await getRepoFile("index.html");
      const version = `admin-${Date.now()}`;
      const patchedIndex = bumpAssetVersions(indexFile.source, version);

      if (patchedIndex !== indexFile.source) {
        const cacheResult = await github(`/repos/${config.repo}/contents/index.html`, {
          method: "PUT",
          body: JSON.stringify({
            message: "Bump Mirpanel asset cache version",
            content: Buffer.from(patchedIndex, "utf8").toString("base64"),
            sha: indexFile.sha,
            branch: config.branch
          })
        });
        cacheCommitSha = cacheResult.commit.sha;
      }
    } catch (error) {
      console.error("Cache version bump failed:", error);
    }

    return json(response, 200, {
      sha: result.content.sha,
      commitSha: result.commit.sha,
      cacheCommitSha,
      sitemapCommitSha,
      redirectsCommitSha,
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
    "Cache-Control": "no-store"
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

    if (["/admin.css", "/admin.js", "/login.js"].includes(pathname)) {
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