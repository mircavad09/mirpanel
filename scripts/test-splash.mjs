import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';

// Homepage-only tests. No backend, credentials, orders, or external requests.
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'payment-test-artifacts/splash');
fs.mkdirSync(out, {recursive: true});
const {chromium} = await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES, 'playwright/index.mjs')));
let writes = 0;
const server = http.createServer((req, res) => {
  if (req.method !== 'GET') { writes++; res.writeHead(405); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  // Product routes are static document navigations in production. Mirror the
  // deployed .page files here without involving checkout APIs.
  const productPage = url.pathname.match(/^\/mehsul\/([a-z0-9-]+)$/);
  const productPagePath = productPage ? path.resolve(root, `./mehsul/${productPage[1]}.page`) : null;
  const requestPath = productPagePath && fs.existsSync(productPagePath)
    ? `/mehsul/${productPage[1]}.page`
    : (url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(root, '.' + requestPath);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.page':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true, executablePath:process.env.MIRPANEL_BROWSER_PATH});
const results = [];
async function setup(width, options = {}) {
  const context = await browser.newContext({viewport:{width,height:options.height || 900}, reducedMotion:options.reduced ? 'reduce' : 'no-preference', javaScriptEnabled:!options.noJS});
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (route.request().method() !== 'GET') { writes++; return route.abort(); }
    if (url.pathname === '/app.js' && options.delay) await new Promise(r => setTimeout(r, options.delay));
    if (url.pathname === '/splash.js' && options.delaySplash) await new Promise(r => setTimeout(r, options.delaySplash));
    if (url.pathname === '/splash.js' && options.missing) return route.fulfill({status:200, contentType:'text/javascript', body:''});
    if (url.pathname === '/splash.css' && options.missingCSS) return route.fulfill({status:200, contentType:'text/css', body:''});
    if (url.pathname === '/splash.js' && options.failure) return route.fulfill({contentType:'text/javascript', body:fs.readFileSync(path.join(root,'splash.js'),'utf8').replace("status.querySelector('button').addEventListener", 'throw new Error("fixture splash failure");\n    status.querySelector(\'button\').addEventListener')});
    return route.continue();
  });
  await context.addInitScript(() => {
    window.splashTiming = {start:null, end:null};
    new MutationObserver(() => {
      const e = document.getElementById('newSplashScreen');
      if (!e) return;
      if (!e.hidden && window.splashTiming.start === null) window.splashTiming.start = performance.now();
      if (e.hidden && window.splashTiming.start !== null && window.splashTiming.end === null) window.splashTiming.end = performance.now();
    }).observe(document, {subtree:true, childList:true, attributes:true, attributeFilter:['hidden']});
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return {context, page, errors};
}
async function hidden(page) { await page.waitForFunction(() => document.getElementById('newSplashScreen').hidden); }
async function timing(page) { return page.evaluate(() => { const t=window.splashTiming; return t.start === null ? 0 : Math.round((t.end ?? performance.now()) - t.start); }); }
async function functional(page, width) {
  assert.ok(await page.locator('#grid .card').count() > 0, 'homepage rendered');
  assert.equal(await page.locator('input#q').count(), 1, 'only one home product search exists');
  const compactLayout = width <= 768;
  if (compactLayout) {
    assert.ok(await page.locator('.home-discovery').isVisible(), 'mobile quick links are visible');
    assert.ok(await page.locator('.site-header-tools #q').isVisible(), 'mobile product search shares the hamburger row');
    assert.equal(await page.locator('.search-promo-box').isVisible(), false, 'legacy duplicate search block is hidden');
    assert.equal(await page.locator('.site-header-nav').isVisible(), false, 'mobile header keeps only the hamburger menu');
    assert.equal(await page.locator('.banner-wrap').isVisible(), false, 'announcement is not a separate mobile banner');
    assert.ok(await page.locator('.home-announcement-ticker').isVisible(), 'ticker sits beside the mobile logo');
    assert.equal(await page.locator('.home-announcement-track').evaluate((element) => getComputedStyle(element).whiteSpace), 'nowrap');
  } else {
    assert.ok(await page.locator('.home-discovery').isVisible(), 'product ribbon is visible on desktop');
    assert.ok(await page.locator('.site-header-tools .site-header-search').isVisible(), 'desktop header search is visible');
    assert.ok(await page.locator('.home-announcement-ticker').isVisible(), 'desktop announcement ticker is visible');
    assert.equal(await page.locator('.banner-wrap').isVisible(), false, 'desktop ribbon follows the header without a duplicate announcement banner');
    const mainHeight = (await page.locator('#heroSlider').boundingBox()).height;
    const secondaryHeight = (await page.locator('#homeSecondaryProductBanner').boundingBox()).height;
    if (width >= 1024) {
      const panel = await page.locator('.home-banner-layout').boundingBox();
      const secondaryPanel = await page.locator('#homeSecondaryBanners').boundingBox();
      const filterTabs = await page.locator('.home-filter-tabs').boundingBox();
      const sort = await page.locator('.glass-sort-container').boundingBox();
      assert.ok(panel.height <= 400.5, `desktop banner panel is at most 400px: ${panel.height}`);
      assert.ok(Math.abs(mainHeight - panel.height) <= 1, 'main banner fills the left column');
      assert.ok(secondaryPanel.x > (await page.locator('#heroSlider').boundingBox()).x, 'secondary banners occupy the right column');
      assert.ok(secondaryHeight < mainHeight / 2, 'secondary banners are stacked compactly');
      assert.ok(Math.abs(filterTabs.y - sort.y) <= 2, 'filters and sorting share one desktop row');
    }
    assert.equal(await page.locator('.footer').evaluate((element) => getComputedStyle(element).position), 'static', 'desktop footer stays in document flow');
    const contentBottom = (await page.locator('#products-section').boundingBox()).y + (await page.locator('#products-section').boundingBox()).height;
    assert.ok((await page.locator('.footer').boundingBox()).y >= contentBottom, 'desktop footer follows all homepage products');
    assert.equal(await page.locator('#gameBtnOpen').evaluate((element) => getComputedStyle(element).position), 'static', 'desktop game button does not cover content');
    assert.equal(await page.locator('#waFab').evaluate((element) => getComputedStyle(element).position), 'static', 'desktop WhatsApp button does not cover content');
  }
  assert.ok(await page.locator('#heroSlider .slide').count() >= 1, 'one main banner is rendered');
  assert.equal(await page.locator('#homeSecondaryBanners > :not([hidden])').count(), 2, 'two real secondary banners are rendered');
  const secondarySources = await page.locator('#homeSecondaryBanners img').evaluateAll((images) => images.map((image) => image.getAttribute('src')));
  assert.ok(secondarySources.some((source) => /slider4\.png/.test(source || '')), 'YouTube repository banner is used');
  assert.ok(secondarySources.some((source) => /support\.png/.test(source || '')), 'support repository banner is used');
  const quickLinks = page.locator('#homeQuickLinks .home-quick-group').first().locator('.home-quick-link');
  assert.ok(await quickLinks.count() >= 4 && await quickLinks.count() <= 6, '4–6 active products are shown in the logo ribbon');
  const quickTitles = (await quickLinks.locator('.home-quick-label').allTextContents()).map((title) => title.trim());
  for (const expected of ['YouTube', 'Netflix', 'CapCut Pro', 'Spotify']) assert.ok(quickTitles.includes(expected), `${expected} uses its full short ribbon label`);
  assert.ok(quickTitles.every((title) => !title.includes('...') && !title.includes('…')), 'ribbon labels never use ellipsis');
  assert.equal(await quickLinks.locator('.home-quick-logo img').count(), await quickLinks.count(), 'every ribbon card uses a real logo');
  for (const href of await quickLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
    assert.match(href || '', /^\/mehsul\/[a-z0-9-]+$/, 'quick link uses an existing product detail route');
  }
  const activeSlideBefore = await page.locator('#heroSlider .slide.active').count();
  if (activeSlideBefore && await page.locator('#heroSlider .slider-dots .dot').count() > 1) {
    await page.locator('#heroSlider .next-arrow').click();
    assert.equal(await page.locator('#heroSlider .slide.active').count(), 1, 'banner slider remains usable after interaction');
  }
  const filters = page.locator('[data-home-filter]');
  assert.ok(await filters.count() >= 1, 'metadata-backed product filters are shown');
  const bestSellerCount = await page.locator('#grid .card').count();
  assert.ok(bestSellerCount > 0, 'best seller products are the default view');
  assert.equal(await page.locator('[data-home-filter="best"]').getAttribute('aria-selected'), 'true');
  await page.locator('[data-home-filter="best"]').click();
  assert.equal(await page.locator('[data-home-filter="best"]').getAttribute('aria-selected'), 'true');
  if (await page.locator('[data-home-filter="premium"]').count()) {
    await page.locator('[data-home-filter="premium"]').click();
    assert.ok(await page.locator('#grid .card').count() > 0, 'premium filter uses existing product badge metadata');
  }
  await page.locator('[data-home-filter="best"]').click();
  if (width < 850) {
    await page.locator('.site-header-menu-button').click();
    assert.equal(await page.locator('.site-header-menu-button').getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.site-header-menu-button').getAttribute('aria-expanded'),'false');
  } else assert.ok(await page.locator('.site-header-nav a').count() >= 5);
  await page.locator('#q').fill('Netflix');
  const titles = await page.locator('#grid .card .title').allTextContents();
  assert.ok(titles.length > 0 && titles.every(t => /netflix/i.test(t)), 'search after splash');
  await page.locator('#q').fill('');
  assert.equal(await page.evaluate(() => document.body.style.position), '', 'no scroll lock');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no horizontal overflow');
}
try {
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'splash.js'), 'utf8'), /(?:sessionStorage|localStorage|document\.cookie)/,
    'splash does not persist a once-per-session state');
  for (const width of [320,390,768,1440,1920]) {
    const {context,page,errors} = await setup(width, {delay:900, height:width === 1920 ? 1080 : 900});
    await page.goto(origin, {waitUntil:'commit'});
    await page.waitForFunction(() => window.splashTiming.start !== null);
    await page.waitForTimeout(500);
    await page.screenshot({path:path.join(out,`animation-${width}.png`)});
    await page.waitForLoadState('domcontentloaded');
    await hidden(page);
    const firstMs = await timing(page);
    assert.ok(firstMs >= 2850 && firstMs <= 3000, `first visit is approximately three seconds: ${firstMs}`);
    assert.equal(await page.locator('#splashLoadStatus').isVisible(), false);
    await page.screenshot({path:path.join(out,`home-${width}.png`)});
    await functional(page,width);
    await page.reload({waitUntil:'domcontentloaded'}); await hidden(page);
    const reloadMs = await timing(page);
    assert.ok(reloadMs >= 2850 && reloadMs <= 3000, `reload gets the full splash: ${reloadMs}`);
    await page.goto(`${origin}/mehsul/netflix-sexsi`, {waitUntil:'commit'}); await page.waitForFunction(() => window.splashTiming.start !== null); await hidden(page);
    const productDirectMs = await timing(page);
    assert.ok(productDirectMs >= 2850 && productDirectMs <= 3000, `direct product document load gets splash: ${productDirectMs}`);
    // A payment cancellation that chooses a full-document return uses the same
    // navigation path. This makes no checkout API request and creates no data.
    await page.goto(`${origin}/?checkout-cancelled=1`, {waitUntil:'commit'}); await page.waitForFunction(() => window.splashTiming.start !== null); await hidden(page);
    const checkoutCancelReloadMs = await timing(page);
    assert.ok(checkoutCancelReloadMs >= 2850 && checkoutCancelReloadMs <= 3000, `checkout cancellation reload gets splash: ${checkoutCancelReloadMs}`);
    assert.deepEqual(errors, []);
    results.push({width,firstMs,reloadMs,productDirectMs,checkoutCancelReloadMs,homeMenuSearch:true,consoleErrors:errors.length});
    await context.close();
  }
  for (const mode of ['slow','late','reduced','missing','failure','missingCSS','noJS']) {
    const options = mode === 'slow' ? {delay:4400} : mode === 'late' ? {delaySplash:900} : {[mode]:true, delay:mode === 'reduced' ? 900 : 0};
    const {context,page,errors} = await setup(390,options);
    await page.goto(origin,{waitUntil:'commit'});
    if (mode === 'slow') {
      await page.waitForFunction(() => window.splashTiming.start !== null);
      await page.waitForTimeout(1300);
      await page.screenshot({path:path.join(out,'sequence-1.3s.png')});
      await page.waitForTimeout(800);
      await page.screenshot({path:path.join(out,'sequence-2.1s.png')});
      await hidden(page);
      assert.ok(await timing(page) <= 3000, 'slow network animation is bounded');
      assert.equal(await page.locator('#splashLoadStatus').isVisible(),false,'slow network does not extend splash with a frozen screen');
      assert.equal(await page.locator('#mainHeader').isVisible(),true,'site is revealed at the deadline');
      await page.screenshot({path:path.join(out,'slow-network.png')});
    }
    await page.waitForLoadState('domcontentloaded');
    if (mode === 'noJS') {
      assert.equal(await page.locator('#newSplashScreen').isVisible(),false);
      results.push({mode,pass:true});
    }
    else {
      await hidden(page);
      const duration = await timing(page);
      if (mode === 'reduced') {
        assert.ok(duration <= 250, 'reduced motion duration');
        assert.equal(await page.locator('.premium-logo').evaluate(e => getComputedStyle(e).animationName),'none');
      }
      if (mode === 'late') assert.ok(duration >= 2850 && duration <= 3000, 'a late cached async splash script still shows the full sequence');
      if (mode === 'missing' || mode === 'failure') assert.ok(duration <= 100, 'script failure opens immediately');
      await functional(page,390);
      if (mode === 'slow') assert.equal(await page.locator('#splashLoadStatus').isVisible(),false,'no loading overlay remains');
      results.push({mode,durationMs:duration,pass:true});
    }
    assert.deepEqual(errors,[]);
    await context.close();
  }
  assert.equal(writes,0);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:true,results,writes},null,2));
  console.log(JSON.stringify({ok:true,results,writes},null,2));
} finally { await browser.close(); await new Promise(r => server.close(r)); }
