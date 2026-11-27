import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {onRequest} from '../functions/_middleware.js';
import {chromium, webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const mime = {js:'text/javascript',mjs:'text/javascript',css:'text/css',html:'text/html',png:'image/png',webp:'image/webp',svg:'image/svg+xml'};
let origin, writes = 0;
const json = value => new Response(JSON.stringify(value), {headers:{'Content-Type':'application/json'}});
const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { writes++; res.writeHead(405); res.end(); return; }
    const request = new Request(origin + req.url, {headers:req.headers});
    const result = await onRequest({request, next:async (next=request) => {
      const p = new URL(next.url).pathname;
      if (p === '/api/community/state') return json({profile:null});
      if (p === '/api/payments/inventory') return json({products:[]});
      if (p.startsWith('/api/')) return new Response(null, {status:404});
      const name = p === '/' ? 'index.html' : p.startsWith('/community-assets/') ? 'mirpanel-admin/community/public/' + p.slice(18) : p.slice(1);
      if (!/^[\w/.-]+$/.test(name) || name.includes('..')) return new Response(null, {status:404});
      try {
        let contents = await fs.readFile(name);
        // The old opener is no longer in today's header. Supply it before the
        // actual app boots so its retained handler is registered exactly once.
        if (name === 'index.html') contents = Buffer.from(contents.toString().replace('<div class="side-menu"', '<button id="menuOpenBtn" type="button" style="display:block!important">Legacy menu</button><div class="side-menu"'));
        return new Response(contents, {headers:{'Content-Type':mime[name.split('.').at(-1)] || 'application/octet-stream'}});
      }
      catch { return new Response(null, {status:404}); }
    }});
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  } catch { res.writeHead(500); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
origin = 'http://127.0.0.1:' + server.address().port;
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({headless:true, ...(engine === chromium ? {executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'} : {})});
    try {
      for (const width of [320,390,430,1440]) {
        const page = await browser.newPage({viewport:{width,height:844}});
        try {
          await page.route(/^https?:\/\/(?!127\.0\.0\.1:)/, r => r.abort());
          await page.goto(origin);
          await page.waitForFunction(() => typeof initSidebar === 'function' && !!window.MirpanelNavigation);
          await page.evaluate(() => {
            const menu = document.getElementById('sideMenu');
            const start = document.createElement('button');
            start.id = 'qa-focus-start'; start.textContent = 'Focus anchor';
            const end = document.createElement('button');
            end.id = 'qa-focus-end'; end.textContent = 'Focus end';
            menu.before(start); menu.after(end); start.focus();
          });
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.id), 'qa-focus-end', 'Tab skips the closed off-screen menu');
          await page.keyboard.press('Shift+Tab');
          assert.equal(await page.evaluate(() => document.activeElement.id), 'qa-focus-start', 'Shift+Tab skips the closed menu');
          assert.equal(await page.locator('#sideMenuInput').getAttribute('aria-label'), 'Məhsul axtar');
          await page.evaluate(() => {
            document.getElementById('sideMenuInput').focus();
          });
          assert.equal(await page.evaluate(() => document.activeElement.id), 'qa-focus-start', 'closed menu rejects programmatic focus');

          // Exercise the retained legacy opener using the actual production handler.
          await page.locator('#menuOpenBtn').focus();
          await page.keyboard.press('Enter');
          assert.equal(await page.locator('#sideMenu').evaluate(e => e.inert), false);
          assert.equal(await page.locator('#sideMenu').getAttribute('aria-hidden'), 'false');
          assert.equal(await page.evaluate(() => document.activeElement.id), 'sideMenuClose');
          await page.keyboard.press('Shift+Tab');
          assert.equal(await page.evaluate(() => document.activeElement === [...document.querySelectorAll('#sideMenu a[href]')].at(-1)), true, 'open menu wraps backwards');
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.id), 'sideMenuClose', 'open menu wraps forwards');
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#sideMenu').evaluate(e => e.inert), true);
          assert.equal(await page.evaluate(() => document.activeElement.id), 'menuOpenBtn', 'Escape restores opener focus');
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.id), 'qa-focus-start');
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.id), 'qa-focus-end', 'closed menu is skipped again');
          await page.locator('#menuOpenBtn').focus();
          await page.keyboard.press('Enter');
          await page.locator('#sideMenuClose').click();
          assert.equal(await page.locator('#sideMenu').evaluate(e => e.inert), true);
          assert.equal(await page.evaluate(() => document.activeElement.id), 'menuOpenBtn', 'close button restores opener');
          await page.reload();
          await page.waitForFunction(() => typeof initSidebar === 'function');
          assert.equal(await page.locator('#sideMenu').evaluate(e => e.inert), true, 'reload starts with an inert menu');
          console.log('PASS sidebar keyboard', engine.name(), width, 'closed focus, label, open trap, Escape, close and reload');
        } finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }
  assert.equal(writes, 0);
} finally { await new Promise(r => server.close(r)); }
