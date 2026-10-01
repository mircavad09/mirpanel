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
const adminJs = fs.readFileSync(path.join(root, "mirpanel-admin/public/stories-admin.js"), "utf8");
const adminCss = fs.readFileSync(path.join(root, "mirpanel-admin/public/admin.css"), "utf8");

let failuresRemaining = 0;
let putCount = 0;
let lastBody = Buffer.alloc(0);
const server = http.createServer((request, response) => {
  if (request.method === "PUT" && request.url.startsWith("/signed")) {
    putCount += 1;
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      lastBody = Buffer.concat(chunks);
      const status = failuresRemaining > 0 ? 503 : 200;
      if (failuresRemaining > 0) failuresRemaining -= 1;
      response.writeHead(status, { "Access-Control-Allow-Origin":"*" }).end(status === 200 ? "ok" : "temporary");
    });
    return;
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"PUT,OPTIONS", "Access-Control-Allow-Headers":"Content-Type,x-upsert" }).end();
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const storyId = "00000000-0000-4000-8000-000000000001";
const html = `<!doctype html><html><head><style>${adminCss}</style></head><body><button class="navBtn" data-view="banners"></button><div id="crumb"></div><main class="main"></main><script>
window.__calls=[]; window.__toast=''; window.__prepareCount=0; window.toast=(text)=>{ window.__toast=text; };
window.api=async(url,options={})=>{ window.__calls.push({url,options});
 if(url==='/api/admin/stories'&&!options.method)return {stories:[{id:'${storyId}',title:'Test',coverUrl:'',sort_order:1,active:false,items:[]}],activeStories:0,activeItems:0,limits:{imageMb:5,videoMb:1024}};
 if(url.endsWith('/video-uploads')&&options.method==='POST'){ window.__prepareCount+=1; const suffix=String(window.__prepareCount).padStart(12,'0'); return {upload:{operationId:'00000000-0000-4000-8000-'+suffix,signedUrl:'http://127.0.0.1:${port}/signed?attempt='+window.__prepareCount}}; }
 if(url.endsWith('/verify')&&options.method==='POST')return {ok:true};
 if(url.startsWith('/api/admin/story-video-uploads/')&&options.method==='DELETE')return {ok:true};
 if(url.endsWith('/items')&&options.method==='POST')return {item:{id:'unexpected'}};
 throw new Error('Unexpected '+url);
};
</script><script>${adminJs}</script></body></html>`;

const browser = await chromium.launch({ executablePath:browserPath, headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });
const errors=[];
page.on("console", (message) => message.type()==="error" && !message.text().includes("Failed to load resource") && errors.push(message.text()));
page.on("pageerror", (error) => errors.push(error.message));
await page.setContent(html, { waitUntil:"domcontentloaded" });
await page.locator('.navBtn[data-view="stories"]').click();
await page.locator('#storiesView').evaluate((view) => view.classList.remove('hidden'));
const form = page.locator(`[data-item-create="${storyId}"]`);
const input = form.locator('input[name="media"]');
const save = form.locator('[data-story-final-save]');
const retry = form.locator('[data-upload-retry]');

const movSize = Math.round(28.7 * 1024 * 1024);
const mov = Buffer.alloc(movSize);
Buffer.from([0,0,0,20]).copy(mov, 0); Buffer.from("ftypqt  ").copy(mov, 4);
await input.setInputFiles({ name:"IMG_0395.MOV", mimeType:"video/quicktime", buffer:mov });
await page.waitForFunction(() => !document.querySelector('[data-story-final-save]')?.disabled, null, { timeout:30000 });
assert.equal(putCount, 1);
assert.ok(lastBody.length > movSize, "MOV multipart gövdəsi storage-a tam göndərilməlidir");
assert.match(await form.locator('[data-upload-status]').innerText(), /Video yükləndi/);
assert.equal((await page.evaluate(() => window.__calls)).filter((call) => call.url.endsWith('/items')).length, 0, "Final düyməsiz media qeydi yaranmamalıdır");

const prepareBeforeAuto = await page.evaluate(() => window.__prepareCount);
failuresRemaining = 2;
const webm = Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(1024)]);
await input.setInputFiles({ name:"retry.webm", mimeType:"video/webm", buffer:webm });
assert.equal(await save.isDisabled(), true, "Retry zamanı final düymə passiv olmalıdır");
await page.waitForFunction(() => !document.querySelector('[data-story-final-save]')?.disabled, null, { timeout:12000 });
assert.equal((await page.evaluate(() => window.__prepareCount)) - prepareBeforeAuto, 3, "Hər retry yeni signed URL almalıdır");

const prepareBeforeManual = await page.evaluate(() => window.__prepareCount);
failuresRemaining = 4;
const mp4 = Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from("ftypisomisom"),Buffer.alloc(1024)]);
await input.setInputFiles({ name:"manual.mp4", mimeType:"video/mp4", buffer:mp4 });
await retry.waitFor({ state:"visible", timeout:15000 });
assert.equal(await save.isDisabled(), true, "Bütün retry-lər bitəndə final düymə passiv qalmalıdır");
assert.equal(await input.evaluate((element) => element.files.length), 1, "Manual retry üçün seçilmiş video qorunmalıdır");
assert.equal((await page.evaluate(() => window.__prepareCount)) - prepareBeforeManual, 4);
failuresRemaining = 0;
await retry.click();
await page.waitForFunction(() => !document.querySelector('[data-story-final-save]')?.disabled, null, { timeout:5000 });
assert.equal((await page.evaluate(() => window.__prepareCount)) - prepareBeforeManual, 5, "Manual retry də yeni signed URL almalıdır");
assert.equal((await page.evaluate(() => window.__calls)).filter((call) => call.url.endsWith('/items')).length, 0);
const layout = await page.evaluate(() => ({ overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth, saveDisabled:document.querySelector('[data-story-final-save]').disabled }));
assert.ok(layout.overflow <= 0);
assert.equal(layout.saveDisabled, false);
await page.setViewportSize({ width:1440, height:900 });
const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth);
assert.ok(desktopOverflow <= 0);
assert.equal(errors.length, 0, errors.join(" | "));

await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log(JSON.stringify({ ok:true, movBytes:movSize, multipartDirect:true, automaticRetryLimit:3, failureAttemptsBeforeManual:4, freshSignedUrls:true, manualRetry:true, duplicateMedia:0, mobile390Overflow:0, desktop1440Overflow:0, consoleErrors:0 }, null, 2));
