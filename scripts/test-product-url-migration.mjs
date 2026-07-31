import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";
import { activeProductsWithSlugs } from "../mirpanel-admin/product-pages.mjs";
import { onRequest } from "../functions/_middleware.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const state = extractAdminState(fs.readFileSync(path.join(root, "app.js"), "utf8"));
const active = activeProductsWithSlugs(state.products);
const redirects = fs.readFileSync(path.join(root, "_redirects"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const redirectLines = redirects.trim().split(/\r?\n/).map((line) => line.split(/\s+/));
const redirectMap = new Map(redirectLines.filter(([, , status]) => status === "301").map(([from, to]) => [from, to]));
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

assert.equal(active.length, 21);
assert.equal(new Set(active.map(({ slug }) => slug)).size, 21, "Təmiz slug toqquşması var");

for (const { product, slug } of active) {
  const route = `/mehsul/${slug}`;
  const canonical = `https://mirpanel.com${route}`;
  const file = path.join(root, "mehsul", slug, "index.html");
  const html = fs.readFileSync(file, "utf8");
  const legacy = legacyById[product.id];

  assert.ok(slug && !slug.endsWith("-almaq") && !slug.includes("hesab0") && !slug.includes("/"), `${product.id}: təmiz slug`);
  assert.ok(html.includes(`rel="canonical" href="${canonical}"`), `${route}: self-canonical`);
  assert.ok(html.includes(`property="og:url" content="${canonical}"`), `${route}: OG URL`);
  assert.ok(html.includes(`"url":"${canonical}"`), `${route}: Product URL`);
  assert.ok(html.includes(`"item":"${canonical}"`), `${route}: Breadcrumb URL`);
  assert.equal((sitemap.match(new RegExp(`<loc>${canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>`, "g")) || []).length, 1, `${route}: sitemap`);
  assert.equal(redirectMap.get(`${route}/`), route, `${route}/: slash 301`);
  assert.equal(redirectMap.get(`/${legacy}`), route, `${legacy}: slash-sız legacy 301`);
  assert.equal(redirectMap.get(`/${legacy}/`), route, `${legacy}: slash-lı legacy 301`);
  assert.equal(redirectMap.has(route), false, `${route}: canonical redirect olmamalıdır`);
  assert.equal(redirectMap.has(redirectMap.get(`/${legacy}`)), false, `${legacy}: redirect chain var`);

  const direct = await onRequest({
    request: new Request(`${canonical}?ref=test`),
    next: async (request) => {
      const requested = new URL(request?.url || canonical);
      const diskPath = path.join(root, requested.pathname.replace(/^\/+/, ""));
      if (!fs.existsSync(diskPath)) return new Response("Not found", { status: 404 });
      return new Response(fs.readFileSync(diskPath, "utf8"), { status: 200, headers: { "Content-Type": "text/html" } });
    }
  });
  assert.equal(direct.status, 200, `${route}: middleware birbaşa 200`);

  const slash = await onRequest({ request: new Request(`${canonical}/?ref=test`), next: async () => new Response("unexpected") });
  assert.equal(slash.status, 301, `${route}/: middleware 301`);
  assert.equal(slash.headers.get("location"), `${canonical}?ref=test`, `${route}/: query qorunmadı`);
}

const productLocs = [...sitemap.matchAll(/<loc>(https:\/\/mirpanel\.com\/mehsul\/[^<]+)<\/loc>/g)].map((match) => match[1]);
assert.equal(productLocs.length, 21, "Sitemap-da 21 məhsul URL-si yoxdur");
assert.ok(productLocs.every((url) => !url.endsWith("/") && !url.includes("-almaq")), "Sitemap məhsul URL formatı yanlışdır");
assert.equal([...redirectMap].some(([from, to]) => from === to), false, "Redirect loop var");

const homeSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const cmsSource = fs.readFileSync(path.join(root, "cms-site.js"), "utf8");
const stockSource = fs.readFileSync(path.join(root, "stock-display-fix.js"), "utf8");
const routerSource = fs.readFileSync(path.join(root, "seo-router.js"), "utf8");
assert.ok(homeSource.includes('href="/mehsul/${productSlug}"'), "Ana səhifə kartı birbaşa yeni URL-yə getmir");
assert.ok(cmsSource.includes("url: `/mehsul/${slug}`"), "Banner birbaşa yeni URL-yə getmir");
assert.ok(stockSource.includes("`/mehsul/${productSlug}`"), "Stok renderer-i köhnə məhsul URL-si yaradır");
assert.ok(routerSource.includes("`/mehsul/${slug}`"), "Klik marşrutlaşdırıcısı köhnə məhsul URL-si yaradır");

console.log("PASS: 21 slash-sız canonical məhsul URL-si, daxili rewrite və biraddımlı 301 miqrasiyası.");
