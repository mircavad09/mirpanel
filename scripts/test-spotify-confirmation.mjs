import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractAdminState, normalizeAdminPayload } from "../mirpanel-admin/core.mjs";
import { generateProductPageFiles } from "../mirpanel-admin/product-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = process.env.MIRPANEL_NODE_MODULES;
const browserPath = process.env.MIRPANEL_BROWSER_PATH;
if (!nodeModules || !browserPath) throw new Error("Browser test runtime paths are required.");
const { chromium } = await import(pathToFileURL(path.join(nodeModules, "playwright", "index.mjs")));

const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const state = extractAdminState(appSource);
const spotify = state.products.find((product) => product.id === "spotify");
assert.ok(spotify, "Spotify məhsulu tapılmadı");
assert.equal(spotify.spotifyPasswordResetUrl, "https://accounts.spotify.com/az/password-reset");

const custom = structuredClone(state);
custom.products.find((product) => product.id === "spotify").spotifyPasswordResetUrl = "https://example.com/spotify-reset";
assert.equal(normalizeAdminPayload(custom).products.find((product) => product.id === "spotify").spotifyPasswordResetUrl, "https://example.com/spotify-reset");
const invalid = structuredClone(state);
invalid.products.find((product) => product.id === "spotify").spotifyPasswordResetUrl = "http://example.com/reset";
assert.throws(() => normalizeAdminPayload(invalid), /https:\/\/ URL/);

const generated = generateProductPageFiles(state.products, state.siteSections, state.cms, state.content);
const htmlByPath = new Map();
for (const [file, html] of generated) {
  htmlByPath.set(`/${file.replace(/\.page$/, "")}`, html.replace("</head>", "<script>window.MIRPANEL_PAYMENT_API=location.origin</script></head>"));
}
let reservationRequests = 0;
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/api/payments/methods") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ methods: [], anyAvailable: false }));
  }
  if (pathname === "/api/payments/reservations") {
    reservationRequests += 1;
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ error: "Rezerv yaradılmamalıdır." }));
  }
  if (htmlByPath.has(pathname)) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return response.end(htmlByPath.get(pathname));
  }
  const file = path.join(root, pathname.replace(/^\/+/, ""));
  if (file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const type = (file.endsWith(".js") || file.endsWith(".mjs")) ? "application/javascript" : file.endsWith(".css") ? "text/css" : "application/octet-stream";
    response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
    return response.end(fs.readFileSync(file));
  }
  response.writeHead(404); response.end();
});

await new Promise((resolve) => server.listen(10084, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const consoleErrors=[],missing=[],widths=[320,390,430,768,1440];let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try {
 for(const android of [false,true]){const context=await browser.newContext({...(android?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'}:{})});
 await context.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(!['GET','HEAD'].includes(q.method())||u.hostname==='wa.me')return r.fulfill({status:204});if(u.pathname==='/api/product-sales')return r.fulfill({json:{initialized:false}});return r.continue();});
 const page=await context.newPage();page.on('pageerror',e=>consoleErrors.push(e.message));page.on('response',r=>{if(r.status()===404)missing.push(new URL(r.url()).pathname);});
 for(const width of widths){await page.setViewportSize({width,height:width<500?844:900});await page.goto('http://127.0.0.1:10084/mehsul/spotify-premium',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>{const e=document.getElementById('newSplashScreen');return !e||e.hidden||getComputedStyle(e).display==='none';});
 const open=async()=>{await page.click('#pp-order-btn');await page.check('#orderTermsAgreement');await page.click('#orderConfirmationConfirm');await page.waitForSelector('#spotifyPassword');};await open();
 eq(await page.locator('#modal input[type=password]').count(),1);eq(await page.locator('#spotifyPasswordConfirm,#spotifyPasswordError,#spotifyCredentialsHint').count(),0);eq(await page.locator('[autocomplete=new-password]').count(),0);eq(await page.locator('.spotifyPasswordToggle').count(),1);eq(await page.locator('.spotifyCredentialsForm input').count(),2);
 for(const [selector,type,autocomplete] of [['#spotifyEmail','email','username'],['#spotifyPassword','password','current-password']]){eq(await page.inputValue(selector),'');eq(await page.getAttribute(selector,'type'),type);eq(await page.getAttribute(selector,'autocomplete'),autocomplete);eq(await page.getAttribute(selector,'autocapitalize'),'none');eq(await page.getAttribute(selector,'spellcheck'),'false');eq(await page.getAttribute(selector,'value'),null);eq(await page.locator(`label[for="${selector.slice(1)}"]`).count(),1);}
 await page.focus('#spotifyEmail');await page.focus('#spotifyPassword');await page.waitForTimeout(100);eq(await page.inputValue('#spotifyPassword'),'');eq(await page.locator('#spotifyContinueButton').isDisabled(),true);
 await page.fill('#spotifyEmail','invalid-email');await page.fill('#spotifyPassword','isolated-password');eq(await page.locator('#spotifyContinueButton').isDisabled(),true);await page.fill('#spotifyEmail','isolated@example.com');eq(await page.locator('#spotifyContinueButton').isDisabled(),false);await page.fill('#spotifyPassword','');eq(await page.locator('#spotifyContinueButton').isDisabled(),true);await page.fill('#spotifyPassword','isolated-password');
 await page.locator('[data-password-toggle]').click();eq(await page.getAttribute('#spotifyPassword','type'),'text');eq(await page.getAttribute('[data-password-toggle]','aria-label'),'Şifrəni gizlət');await page.locator('[data-password-toggle]').click();eq(await page.getAttribute('#spotifyPassword','type'),'password');eq(await page.getAttribute('[data-password-toggle]','aria-label'),'Şifrəni göstər');eq(await page.getAttribute('.spotifyPasswordReset a','href'),spotify.spotifyPasswordResetUrl);
 await page.evaluate(()=>window.detachedSpotifyInputs=[...document.querySelectorAll('.spotifyCredentialsForm input')]);await page.click('#universalFormCancel');eq(await page.evaluate(()=>detachedSpotifyInputs.every(e=>e.value===''&&e.defaultValue==='')),true);await open();eq(await page.inputValue('#spotifyEmail'),'');eq(await page.inputValue('#spotifyPassword'),'');await page.fill('#spotifyPassword','escape-only');await page.evaluate(()=>window.escapeInput=document.getElementById('spotifyPassword'));await page.keyboard.press('Escape');eq(await page.evaluate(()=>escapeInput.value),'');await open();
 eq(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);if(width<768)eq(await page.locator('.spotifyCredentialsForm input').evaluateAll(es=>es.every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)),true);
 if(process.env.MIRPANEL_VISUAL_DIR){fs.mkdirSync(process.env.MIRPANEL_VISUAL_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MIRPANEL_VISUAL_DIR,`local-spotify-${android?'android':'windows'}-${width}.png`)});}
 if(width===390){await page.setViewportSize({width:390,height:500});await page.locator('#spotifyContinueButton').scrollIntoViewIfNeeded();eq(await page.locator('#spotifyContinueButton').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);await page.setViewportSize({width,height:844});}
 // Capture the existing payment handoff in memory. No order, reservation or WhatsApp request.
 await page.evaluate(()=>{window.fixtureHandoff=null;window.MirpanelPaymentFlow.start=async v=>{window.fixtureHandoff=v;return null;};});await page.fill('#spotifyEmail','spotify@example.com');await page.fill('#spotifyPassword','isolated-existing-password');await page.click('#spotifyContinueButton');await page.waitForFunction(()=>Boolean(window.fixtureHandoff));const handoff=await page.evaluate(()=>({id:fixtureHandoff.product.id,extra:fixtureHandoff.whatsappExtraText}));eq(handoff.id,'spotify');eq(handoff.extra.includes('spotify@example.com'),true);eq(handoff.extra.includes('isolated-existing-password'),true);eq((handoff.extra.match(/isolated-existing-password/g)||[]).length,1);eq(handoff.extra.includes('təkrar'),false);
 }
 await context.close();}
 eq(reservationRequests,0);eq(consoleErrors.length,0);eq(missing.length,0);console.log(JSON.stringify({ok:true,checks,widths,chromeModes:['Windows Chrome headless','Android Chrome emulation'],passwordInputs:1,newPasswordInputs:0,confirmationInputs:0,manualPasswordManagerPopup:'NOT VERIFIED',realAndroidDevice:'NOT AVAILABLE',orderReservationMessages:0,overflow:0,consoleErrors:0,missing404:0},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
