import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { onRequest } from "../functions/_middleware.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routes = ["mehsul", "haqqimizda", "sertler", "elaqe"];

async function request(pathname) {
  const request = new Request(`https://mirpanel.com${pathname}`);
  return onRequest({
    request,
    next: async (nextRequest = request) => {
      const filePath = path.join(root, new URL(nextRequest.url).pathname.replace(/^\//, ""));
      if (!fs.existsSync(filePath)) return new Response("Not found", { status: 404 });
      return new Response(fs.readFileSync(filePath), { status: 200 });
    }
  });
}

for (const route of routes) {
  const direct = await request(`/${route}`);
  assert.equal(direct.status, 200, `/${route} direct status`);
  assert.match(direct.headers.get("content-type") || "", /^text\/html/);
  const html = await direct.text();
  assert.ok(html.includes(`rel="canonical" href="https://mirpanel.com/${route}"`), `/${route} canonical`);

  const slash = await request(`/${route}/?source=test`);
  assert.equal(slash.status, 301, `/${route}/ redirect status`);
  assert.equal(slash.headers.get("location"), `https://mirpanel.com/${route}?source=test`, `/${route}/ one-hop target`);
  const target = await request(new URL(slash.headers.get("location")).pathname);
  assert.equal(target.status, 200, `/${route}/ redirect target`);
}

const listing = fs.readFileSync(path.join(root, "mehsul.page"), "utf8");
assert.equal((listing.match(/class="card"/g) || []).length, 21, "product listing count");
assert.equal(listing.includes("/" + "#products-section"), false, "legacy product anchor");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const redirects = fs.readFileSync(path.join(root, "_redirects"), "utf8");
assert.equal((sitemap.match(/<url>/g) || []).length, 26, "sitemap URL count");
for (const route of routes) {
  assert.ok(sitemap.includes(`<loc>https://mirpanel.com/${route}</loc>`));
  assert.equal(sitemap.includes(`<loc>https://mirpanel.com/${route}/</loc>`), false);
  if (route === "mehsul") assert.ok(redirects.includes("/mehsul /mehsul.page 200"));
  assert.ok(redirects.includes(`/${route}/ /${route} 301`));
}

console.log("PASS: four slashless routes are direct 200, slash variants are one-hop 301, listing has 21 products, sitemap has 26 canonical URLs.");
