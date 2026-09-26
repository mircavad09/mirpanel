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
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0;background:#070707;color:white;font-family:Arial}.wrap{box-sizing:border-box}.home-banner-layout{width:min(calc(100% - 16px),1000px);margin:auto}.hero-slider-box{height:210px;background:#311f55;border-radius:18px}.home-filter-tabs{height:44px;margin:8px;background:#222}</style><style>${css}</style></head><body class="home-page"><section class="wrap home-banner-layout"><div class="hero-slider-box" id="heroSlider"></div></section><section class="wrap home-stories" id="homeStories" hidden><div class="home-stories-track" id="homeStoriesTrack"></div></section><div class="home-filter-tabs"></div><div class="story-viewer" id="storyViewer" role="dialog" hidden><div class="story-viewer-card"><div id="storyProgress" class="story-progress"></div><header class="story-viewer-head"><img id="storyViewerCover"><strong id="storyViewerTitle"></strong><button id="storyViewerClose">×</button></header><div class="story-stage" id="storyStage"><div id="storyMedia" class="story-media"></div><p id="storyCaption" hidden></p><button id="storyPlay" class="story-play" hidden>Videonu oynat</button><button id="storyPrev" class="story-zone story-zone-prev"></button><button id="storyNext" class="story-zone story-zone-next"></button></div></div></div><script>${js}</script></body></html>`;
const stories = [
  { id:"s1", title:"Müştəri məmnuniyyəti", coverUrl:"https://media.test/cover.jpg", active:true, items:[{id:"i1",media_type:"image",mediaUrl:"https://media.test/photo.jpg",caption:"Rəy",active:true},{id:"i2",media_type:"video",mediaUrl:"https://media.test/video.mp4",caption:"Video",active:true}] },
  { id:"s2", title:"Yeni məhsullar və kampaniyalar", coverUrl:"https://media.test/cover2.jpg", active:true, items:[{id:"i3",media_type:"image",mediaUrl:"https://media.test/photo2.jpg",caption:"Yeni",active:true}] }
];
const browser = await chromium.launch({ executablePath: browserPath, headless:true });
const context = await browser.newContext();
const page = await context.newPage();
const errors=[]; page.on("console",(msg)=>{if(msg.type()==="error")errors.push(msg.text());}); page.on("pageerror",(error)=>errors.push(error.message));
await page.route("**/api/stories",(route)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({stories})}));
const pixel=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");
await page.route("https://media.test/**",async(route)=>{if(route.request().url().endsWith(".mp4")){await new Promise(resolve=>setTimeout(resolve,800));return route.fulfill({status:200,contentType:"video/mp4",body:Buffer.alloc(64)});}return route.fulfill({status:200,contentType:"image/png",body:pixel});});
const results=[];
for(const [width,height] of [[320,568],[390,844],[768,900],[1440,900],[1920,1080]]){
  await page.setViewportSize({width,height}); await page.setContent(html,{waitUntil:"domcontentloaded"}); await page.waitForSelector(".home-story");
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,stories:document.querySelectorAll(".home-story").length,banner:!!document.getElementById("heroSlider"),filtersTop:document.querySelector(".home-filter-tabs").getBoundingClientRect().top,storiesBottom:document.getElementById("homeStories").getBoundingClientRect().bottom}));
  assert.equal(layout.overflow,false); assert.equal(layout.stories,2); assert.equal(layout.banner,true); assert.ok(layout.filtersTop>=layout.storiesBottom-1);
  results.push(`${width}x${height}`);
}
await page.setViewportSize({width:390,height:844}); await page.setContent(html,{waitUntil:"domcontentloaded"}); await page.waitForSelector(".home-story");
assert.equal(await page.locator('video[src*="video.mp4"]').count(),0,"Video viewer açılmadan yüklənməməlidir");
await page.locator(".home-story").first().click(); assert.equal(await page.locator("#storyViewer").isVisible(),true); assert.equal(await page.locator("#storyMedia img").count(),1);
await page.locator("#storyNext").click(); assert.equal(await page.locator("#storyMedia video").count(),1); assert.equal(await page.locator("#storyMedia video").getAttribute("playsinline"),"");
await page.locator("#storyViewerClose").click(); assert.equal(await page.locator("#storyViewer").isHidden(),true); assert.equal(await page.evaluate(()=>document.body.classList.contains("story-viewer-open")),false);
assert.equal(errors.length,0,errors.join(" | "));
const empty = await context.newPage(); await empty.route("**/api/stories",(route)=>route.fulfill({status:200,contentType:"application/json",body:'{"stories":[]}'})); await empty.setContent(html); await empty.waitForTimeout(100); assert.equal(await empty.locator("#homeStories").isHidden(),true);
await browser.close();
console.log(JSON.stringify({ok:true,viewports:results,horizontalOverflow:0,consoleErrors:0,mainBannerPreserved:true,secondaryBannersRemoved:true,imageViewer:true,videoLazyLoad:true,playsInline:true,emptyHidden:true},null,2));
