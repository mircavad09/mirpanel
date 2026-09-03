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
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true, executablePath:process.env.MIRPANEL_BROWSER_PATH});
const results = [];
async function setup(width, options = {}) {
  const context = await browser.newContext({viewport:{width,height:900}, reducedMotion:options.reduced ? 'reduce' : 'no-preference', javaScriptEnabled:!options.noJS});
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (route.request().method() !== 'GET') { writes++; return route.abort(); }
    if (url.pathname === '/app.js' && options.delay) await new Promise(r => setTimeout(r, options.delay));
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
}
try {
  for (const width of [320,390,768,1440]) {
    const {context,page,errors} = await setup(width, {delay:900});
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
    const repeatMs = await timing(page);
    assert.ok(repeatMs <= 250, 'repeat session skips animation');
    assert.deepEqual(errors, []);
    results.push({width,firstMs,repeatMs,homeMenuSearch:true,consoleErrors:errors.length});
    await context.close();
  }
  for (const mode of ['slow','reduced','missing','failure','missingCSS','noJS']) {
    const options = mode === 'slow' ? {delay:4400} : {[mode]:true, delay:mode === 'reduced' ? 900 : 0};
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
