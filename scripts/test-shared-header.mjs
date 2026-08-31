import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = process.env.MIRPANEL_NODE_MODULES;
const browserPath = process.env.MIRPANEL_BROWSER_PATH;
if (!nodeModules || !browserPath) throw new Error("Browser test runtime paths are required.");
const { chromium } = await import(pathToFileURL(path.join(nodeModules, "playwright", "index.mjs")));

const routes = {
  "/": "index.html",
  "/mehsul": "mehsul.page",
  "/mehsul/capcut-pro": "mehsul/capcut-pro.page",
  "/mehsul/netflix-sexsi": "mehsul/netflix-sexsi.page",
  "/haqqimizda": "haqqimizda",
  "/sertler": "sertler",
  "/elaqe": "elaqe",
  "/netflix_tesdiq": "netflix_tesdiq/index.html"
};
const expectedActive = {
  "/": "/",
  "/mehsul": "/mehsul",
  "/mehsul/capcut-pro": "/mehsul",
  "/mehsul/netflix-sexsi": "/mehsul",
  "/haqqimizda": "/haqqimizda",
  "/sertler": "/sertler",
  "/elaqe": "/elaqe",
  "/netflix_tesdiq": "/netflix_tesdiq"
};
const mime = { ".html": "text/html; charset=utf-8", ".page": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

for (const [route, file] of Object.entries(routes)) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(html, /class="product-page-header site-header"/, `${route}: shared header missing`);
  assert.equal((html.match(/class="product-page-nav site-header-nav"/g) || []).length, 1, `${route}: desktop nav count`);
  assert.equal((html.match(/class="product-page-nav site-header-drawer-nav"/g) || []).length, 1, `${route}: mobile nav count`);
  assert.equal((html.match(/data-header-key=/g) || []).length, 10, `${route}: five links are not shared across desktop and mobile`);
  if (route !== "/netflix_tesdiq") assert.ok(html.includes(`href="${expectedActive[route]}" data-header-key=`), `${route}: active target missing`);
  assert.match(html, /site-header\.css\?v=/, `${route}: shared CSS missing`);
  assert.match(html, /site-header\.js\?v=/, `${route}: shared JS missing`);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const routeFile = routes[url.pathname];
  const relative = routeFile || url.pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404);
    return response.end("Not found");
  }
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || (routeFile ? "text/html; charset=utf-8" : "application/octet-stream") });
  response.end(fs.readFileSync(file));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const consoleErrors = [];

try {
  for (const width of [1440, 1024, 768, 390, 320]) {
    for (const route of Object.keys(routes)) {
      const page = await browser.newPage({ viewport: { width, height: width <= 390 ? 844 : 900 } });
      page.on("pageerror", (error) => consoleErrors.push(`${route}@${width}: ${error.message}`));
      await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
      const audit = await page.evaluate((activeHref) => {
        const header = document.querySelector(".site-header");
        const activeDesktop = header?.querySelector('.site-header-nav a[aria-current="page"]')?.getAttribute("href");
        const activeMobile = header?.querySelector('.site-header-drawer-nav a[aria-current="page"]')?.getAttribute("href");
        const brand = header?.querySelector(".site-header-brand")?.getBoundingClientRect();
        const nav = header?.querySelector(".site-header-nav")?.getBoundingClientRect();
        const tools = header?.querySelector(".site-header-tools")?.getBoundingClientRect();
        return {
          activeDesktop,
          activeMobile,
          overflow: document.documentElement.scrollWidth - innerWidth,
          desktopVisible: getComputedStyle(header.querySelector(".site-header-nav")).display !== "none",
          menuVisible: getComputedStyle(header.querySelector(".site-header-menu-button")).display !== "none",
          overlap: brand && nav && tools ? brand.right > nav.left || nav.right > tools.left : false,
          linkCount: header.querySelectorAll(".site-header-nav a").length,
          expected: activeHref
        };
      }, expectedActive[route]);
      assert.equal(audit.activeDesktop, expectedActive[route], `${route}@${width}: desktop active link`);
      assert.equal(audit.activeMobile, expectedActive[route], `${route}@${width}: mobile active link`);
      assert.equal(audit.linkCount, 6, `${route}@${width}: desktop link count`);
      assert.ok(audit.overflow <= 0, `${route}@${width}: horizontal overflow ${audit.overflow}`);
      if (width > 900) {
        assert.equal(audit.desktopVisible, true, `${route}@${width}: desktop nav hidden`);
        assert.equal(audit.overlap, false, `${route}@${width}: header items overlap`);
      } else {
        assert.equal(audit.menuVisible, true, `${route}@${width}: hamburger hidden`);
        await page.locator(".site-header-menu-button").click();
        await page.locator(".site-header-drawer").waitFor({ state: "visible" });
        assert.equal(await page.locator(".site-header-drawer-nav a").count(), 6, `${route}@${width}: mobile link count`);
        assert.equal(await page.locator(".site-header-drawer-nav a").allTextContents().then((items) => items.every((item) => item.trim().length > 0)), true, `${route}@${width}: cut mobile label`);
        await page.keyboard.press("Escape");
        await page.locator(".site-header-drawer").waitFor({ state: "hidden" });
      }
      await page.close();
    }
  }

  const clickPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const href of ["/", "/mehsul", "/haqqimizda", "/sertler", "/elaqe", "/netflix_tesdiq"]) {
    await clickPage.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    await clickPage.locator(".site-header-menu-button").click();
    const link = clickPage.locator(`.site-header-drawer-nav a[href="${href}"]`);
    await Promise.all([clickPage.waitForURL(`${origin}${href}`), link.click()]);
    assert.equal(new URL(clickPage.url()).pathname, href, `mobile link ${href}`);
  }
  await clickPage.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join("\n")}`);
console.log("Shared header browser tests passed at 1440, 1024, 768, 390 and 320 px.");
