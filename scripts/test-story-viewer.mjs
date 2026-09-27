import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = process.env.MIRPANEL_NODE_MODULES;
const browserPath = process.env.MIRPANEL_BROWSER_PATH;
if (!nodeModules || !browserPath) throw new Error("Browser test runtime paths are required.");
const { chromium } = await import(pathToFileURL(path.join(nodeModules, "playwright", "index.mjs")));
const css = fs.readFileSync(path.join(root, "stories.css"), "utf8");
const js = fs.readFileSync(path.join(root, "stories.js"), "utf8");
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0;background:#090909;color:#fff}</style><style>${css}</style></head><body><section id="homeStories"><div id="homeStoriesTrack"></div></section><div class="story-viewer" id="storyViewer" role="dialog" hidden><div class="story-viewer-card"><div id="storyProgress" class="story-progress"></div><header class="story-viewer-head"><img id="storyViewerCover"><strong id="storyViewerTitle"></strong><button class="story-sound" id="storySound" hidden>🔊</button><button id="storyViewerClose">×</button></header><div class="story-stage" id="storyStage"><div id="storyMedia" class="story-media"></div><p id="storyCaption" hidden></p><button id="storyPlay" class="story-play" hidden>Videonu oynat</button><button id="storyPrev" class="story-zone story-zone-prev"></button><button id="storyNext" class="story-zone story-zone-next"></button></div></div></div><script>${js}</script></body></html>`;
const stories = [{ id:"video-story", title:"Video", coverUrl:"https://media.test/cover.png", active:true, items:[{ id:"video-item", media_type:"video", mediaUrl:"https://media.test/story.mp4", caption:"", active:true }] }];
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const browser = await chromium.launch({ executablePath: browserPath, headless:true });

async function makePage(blockAudible = false) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/stories", (route) => route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ stories }) }));
  await page.route("https://media.test/cover.png", (route) => route.fulfill({ status:200, contentType:"image/png", body:pixel }));
  await page.route("https://media.test/story.mp4", (route) => route.fulfill({ status:200, contentType:"video/mp4", body:Buffer.alloc(64) }));
  return { context, page, errors, blockAudible };
}

async function installPlaybackStub(target) {
  await target.page.evaluate((blocked) => {
    window.__blockAudible = blocked;
    window.__playAttempts = [];
    HTMLMediaElement.prototype.__storyOriginalAdd ||= HTMLMediaElement.prototype.addEventListener;
    HTMLMediaElement.prototype.addEventListener = function (type, listener, options) {
      if (type === "error") return;
      return this.__storyOriginalAdd(type, listener, options);
    };
    HTMLMediaElement.prototype.play = function () {
      window.__playAttempts.push({ muted:this.muted, volume:this.volume });
      return !this.muted && window.__blockAudible ? Promise.reject(new DOMException("Blocked", "NotAllowedError")) : Promise.resolve();
    };
  }, target.blockAudible);
}

const results = [];
const primary = await makePage(false);
for (const [width,height] of [[320,568],[390,844],[768,900],[1440,900]]) {
  await primary.page.setViewportSize({ width, height });
  await primary.page.setContent(html, { waitUntil:"domcontentloaded" });
  await installPlaybackStub(primary);
  await primary.page.waitForSelector(".home-story");
  await primary.page.locator(".home-story").click();
  await primary.page.waitForSelector("#storyMedia video");
  if (process.env.STORY_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.STORY_SCREENSHOT_DIR, { recursive:true });
    await primary.page.screenshot({ path:path.join(process.env.STORY_SCREENSHOT_DIR, `story-viewer-${width}x${height}.png`) });
  }
  const state = await primary.page.evaluate(() => {
    const card = document.querySelector(".story-viewer-card");
    const video = document.querySelector("#storyMedia video");
    const close = document.getElementById("storyViewerClose");
    const stage = document.getElementById("storyStage");
    const rect = card.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();
    return {
      cardHeight: rect.height,
      top: rect.top,
      bottomGap: innerHeight - rect.bottom,
      fullscreen: rect.height >= innerHeight || rect.width >= innerWidth,
      objectFit: getComputedStyle(video).objectFit,
      closeVisible: close.getBoundingClientRect().width > 0,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      viewerScroll: card.scrollHeight > card.clientHeight,
      stageTop: stageRect.top,
      stageBottom: stageRect.bottom,
      mediaWithinViewport: stageRect.top >= 0 && stageRect.bottom <= innerHeight,
      videoWithinStage: videoRect.top >= stageRect.top && videoRect.bottom <= stageRect.bottom && videoRect.left >= stageRect.left && videoRect.right <= stageRect.right,
      firstPlayMuted: window.__playAttempts[0]?.muted
    };
  });
  assert.equal(state.objectFit, "contain");
  assert.equal(state.closeVisible, true);
  assert.equal(state.overflow, false);
  assert.equal(state.viewerScroll, false);
  assert.equal(state.mediaWithinViewport, true);
  assert.equal(state.videoWithinStage, true);
  assert.equal(state.firstPlayMuted, false);
  await primary.page.locator("#storyViewerClose").click();
  assert.equal(await primary.page.locator("#storyViewer").isHidden(), true);
  results.push({ width, height, ...state });
}
assert.equal(primary.errors.length, 0, primary.errors.join(" | "));
await primary.context.close();

const blocked = await makePage(true);
await blocked.page.setViewportSize({ width:390, height:844 });
await blocked.page.setContent(html, { waitUntil:"domcontentloaded" });
await installPlaybackStub(blocked);
await blocked.page.waitForSelector(".home-story");
await blocked.page.locator(".home-story").click();
await blocked.page.locator("#storyPlay").waitFor({ state:"visible" });
const attemptsBefore = await blocked.page.evaluate(() => window.__playAttempts);
assert.equal(attemptsBefore[0].muted, false);
assert.equal(attemptsBefore[1].muted, true);
await blocked.page.evaluate(() => { window.__blockAudible = false; });
await blocked.page.locator("#storyPlay").click();
assert.equal(await blocked.page.locator("#storyMedia video").evaluate((video) => video.muted), false);
assert.equal(await blocked.page.getByRole("button", { name:"Səsi bağla" }).isVisible(), true);
assert.equal(blocked.errors.length, 0, blocked.errors.join(" | "));
await blocked.context.close();
await browser.close();

console.log(JSON.stringify({ ok:true, results, audibleAttempt:true, blockedFallback:true, consoleErrors:0 }, null, 2));
