import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const { chromium } = await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES, 'playwright/index.mjs')));
const routes = ['/', '/mehsul/capcut-pro', '/mehsul/netflix-sexsi', '/mehsul/google-ai-pro-v3', '/mehsul/spotify-premium', '/mehsul/hbo-max'].filter(route => !process.env.MIRPANEL_TEST_ROUTE || route === process.env.MIRPANEL_TEST_ROUTE);
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (file.startsWith('mehsul/') && !path.extname(file)) file += '.page';
  file = path.join(root, file);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  const type = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.page') || file.endsWith('.html') ? 'text/html' : file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream';
  res.writeHead(200, {'Content-Type': type + '; charset=utf-8'}); res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.MIRPANEL_BROWSER_PATH, headless: true });
const results = [], errors = [];
const visualDir = process.env.MIRPANEL_VISUAL_DIR;
if (visualDir) fs.mkdirSync(visualDir, {recursive:true});
try {
  for (const width of [320,390,1440]) for (const route of routes) {
    const page = await browser.newPage({viewport:{width,height:width<500?844:900}});
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}${route}`, {waitUntil:'networkidle'});
    await page.waitForTimeout(3100);
    const result = await page.evaluate(() => {
      const nav = document.querySelector('.site-header-nav');
      const image = document.body.classList.contains('product-page-document') ? document.getElementById('pp-main-img') : null;
      const media = image?.closest('.product-page-media');
      const ir = image?.getBoundingClientRect(), mr = media?.getBoundingClientRect();
      const links = [...nav.querySelectorAll('a')];
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        navVisible: getComputedStyle(nav).display !== 'none',
        netflixLinks: document.querySelectorAll('.site-header a[href="/netflix_tesdiq"]').length,
        overlap: links.some((a,i) => i && a.getBoundingClientRect().left < links[i-1].getBoundingClientRect().right),
        image: image ? { natural:[image.naturalWidth,image.naturalHeight], width:ir.width,height:ir.height,frameWidth:mr.width,frameHeight:mr.height,transform:getComputedStyle(image).transform } : null
      };
    });
    assert.equal(result.overflow,false, `${route}@${width}: overflow`);
    assert.equal(result.netflixLinks,0);
    assert.equal(result.navVisible,width>900);
    if(width>900) assert.equal(result.overlap,false);
    if(result.image){
      const im=result.image;
      assert.ok(im.natural[0]>0, `${route}: image missing`);
      assert.ok(Math.abs(im.width/im.height-im.natural[0]/im.natural[1])<.01, `${route}: ratio changed`);
      assert.ok(Math.abs(im.frameWidth-im.width)<=3 && Math.abs(im.frameHeight-im.height)<=3, `${route}: image bands ${JSON.stringify(im)}`);
      assert.equal(im.transform,'none');
    }
    if(visualDir) await page.screenshot({path:path.join(visualDir,`${route.split('/').pop()||'home'}-${width}.png`)});
    if(width<500){
      await page.locator('.site-header-menu-button').click();
      await page.locator('.site-header-drawer').waitFor({state:'visible'});
      const fit = await page.locator('.site-header-drawer-nav a').evaluateAll(links => links.every(link=>{
        const lr=link.getBoundingClientRect(),sr=link.querySelector('span').getBoundingClientRect();
        return sr.left>=lr.left && sr.right<=lr.right && lr.height>=44;
      }));
      assert.equal(fit,true,`${route}@${width}: drawer label clipped`);
      assert.equal(await page.locator('.site-header-drawer-nav a').count(),5);
      if(visualDir && route.includes('capcut')) await page.screenshot({path:path.join(visualDir,`menu-${width}.png`)});
      await page.keyboard.press('Escape');
    }
    results.push({route,width,...result}); await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({results,consoleErrors:errors.length},null,2));
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
