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
let received = Buffer.alloc(0);
const server = http.createServer((request, response) => {
  if (request.method === "PUT" && request.url.startsWith("/signed")) {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => { received = Buffer.concat(chunks); response.writeHead(200, { "Access-Control-Allow-Origin":"*" }).end("ok"); });
    return;
  }
  if (request.method === "OPTIONS") { response.writeHead(204, { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"PUT,OPTIONS", "Access-Control-Allow-Headers":"Content-Type,Cache-Control" }).end(); return; }
  response.writeHead(404).end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const storyId = "00000000-0000-4000-8000-000000000001";
const html = `<!doctype html><html><body><button class="navBtn" data-view="banners"></button><div id="crumb"></div><main class="main"></main><script>
window.__calls=[]; window.__toast=''; window.toast=(text)=>{ window.__toast=text; };
window.api=async(url,options={})=>{ window.__calls.push({url,options});
 if(url==='/api/admin/stories'&&!options.method)return {stories:[{id:'${storyId}',title:'Test',coverUrl:'',sort_order:1,active:true,items:[]}],activeStories:0,activeItems:0,limits:{imageMb:5,videoMb:1024}};
 if(url.endsWith('/video-uploads')&&options.method==='POST')return {upload:{operationId:'11111111-1111-4111-8111-111111111111',signedUrl:'http://127.0.0.1:${port}/signed?token=short-lived'}};
 if(url.endsWith('/items')&&options.method==='POST')return {item:{id:'item'}};
 throw new Error('Unexpected '+url);
};
</script><script>${adminJs}</script></body></html>`;
const browser = await chromium.launch({ executablePath: browserPath, headless:true });
const page = await browser.newPage();
const errors=[]; page.on("console",(message)=>message.type()==="error"&&errors.push(message.text())); page.on("pageerror",(error)=>errors.push(error.message));
await page.setContent(html, { waitUntil:"domcontentloaded" });
await page.locator('.navBtn[data-view="stories"]').click();
const form = page.locator(`[data-item-create="${storyId}"]`);
assert.match(await form.locator('input[name="media"]').getAttribute("accept"), /video\/\*/);
await form.locator('select[name="mediaType"]').selectOption("video");
const mp4 = Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from("ftypisomisom"),Buffer.alloc(4)]);
await form.locator('input[name="media"]').setInputFiles({ name:"small.mp4", mimeType:"video/mp4", buffer:mp4 });
assert.equal(await form.locator('select[name="mediaType"]').inputValue(), "video");
assert.match(await form.locator('.storyUploadSelection').innerText(), /small\.mp4.*Video seçildi/);
await form.locator('button[type="submit"]').click();
await page.waitForFunction(() => window.__calls.some((entry) => entry.url.endsWith('/items') && entry.options.method === 'POST'));
const calls = await page.evaluate(() => window.__calls);
const finalize = calls.find((entry) => entry.url.endsWith('/items') && entry.options.method === 'POST');
const payload = JSON.parse(finalize.options.body);
assert.equal(received.equals(mp4), true, "Video byte-ları birbaşa signed URL-ə getməlidir");
assert.equal(payload.directUploadId, "11111111-1111-4111-8111-111111111111");
assert.equal(payload.media, null, "Video base64 JSON ilə Render serverinə göndərilməməlidir");
const mov = Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from("ftypqt  "),Buffer.alloc(4)]);
await form.locator('input[name="media"]').setInputFiles({ name:"iphone.mov", mimeType:"video/quicktime", buffer:mov });
assert.equal(await form.locator('select[name="mediaType"]').inputValue(), "video");
assert.equal(await form.locator('input[name="media"]').evaluate((input) => input.files.length), 1, "iPhone MOV seçimi saxlanmalıdır");
const webm = Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(16)]);
await form.locator('input[name="media"]').setInputFiles({ name:"desktop.webm", mimeType:"video/webm", buffer:webm });
assert.equal(await form.locator('input[name="media"]').evaluate((input) => input.files.length), 1, "Desktop WebM seçimi saxlanmalıdır");
await form.locator('input[name="media"]').setInputFiles({ name:"sound.mp3", mimeType:"audio/mpeg", buffer:Buffer.from("ID3audio") });
assert.equal(await form.locator('input[name="media"]').evaluate((input) => input.files.length), 0, "MP3 seçimdən təmizlənməlidir");
assert.equal(await page.evaluate(() => window.__toast), "Yalnız video faylı seçin.");
assert.equal(errors.length, 0, errors.join(" | "));
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log(JSON.stringify({ ok:true, directBytes:received.length, base64ToServer:false, signedUrl:true, consoleErrors:0 }, null, 2));
