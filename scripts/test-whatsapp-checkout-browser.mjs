import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";
const {chromium,webkit}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,"playwright/index.mjs")));
const root=process.cwd();
const server=http.createServer((req,res)=>{
  let name=new URL(req.url,"http://localhost").pathname;
  if(name==="/mehsul/capcut-pro"||name==="/mehsul/tiktok-jeton")name+=".page";
  const file=path.resolve(root,"."+name);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const type=file.endsWith(".page")?"text/html":file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":file.endsWith(".png")?"image/png":"application/octet-stream";
  let content=fs.readFileSync(file);
  if(type==="text/html")content=content.toString().replace("</head>","<script>window.MIRPANEL_PAYMENT_API=location.origin</script></head>");
  res.writeHead(200,{"Content-Type":type});res.end(content);
});
await new Promise(resolve=>server.listen(10084,"127.0.0.1",resolve));
const browserType=process.env.MIRPANEL_BROWSER_ENGINE==="webkit"?webkit:chromium;
const browser=await browserType.launch({headless:true,...(process.env.MIRPANEL_BROWSER_PATH?{executablePath:process.env.MIRPANEL_BROWSER_PATH}:{})});
const browserName=process.env.MIRPANEL_BROWSER_NAME||"Chromium";
const profiles=[{name:"iPhone-size automation",width:390,isMobile:true},{name:"Android-size automation",width:360,isMobile:true},{name:"desktop automation",width:1440,isMobile:false}];
const errors=[],results=[];
try {
  for(const profile of profiles){
    const context=await browser.newContext({viewport:{width:profile.width,height:900},isMobile:profile.isMobile});
    const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
    let orders=0,reserves=0,popups=0,target;
    page.on("popup",()=>popups++);
    await page.route("**/api/payments/**",async route=>{
      const endpoint=new URL(route.request().url()).pathname;
      let body;
      if(endpoint.endsWith("/methods"))body={anyAvailable:true,methods:[{id:"22222222-2222-4222-8222-222222222222",providerName:"Fixture Bank",last4:"0000",available:true}]};
      else if(endpoint.endsWith("/reservations")){reserves++;body={reservationId:"11111111-1111-4111-8111-111111111111",expiresAt:new Date(Date.now()+600000).toISOString(),amount:5.99,currency:"AZN",method:{number:"0000 0000 0000 0000",providerName:"Fixture Bank",theme:"abb",type:"bank_card"}};}
      else if(endpoint.endsWith("/orders")){orders++;await new Promise(r=>setTimeout(r,250));body={orderId:"33333333-3333-4333-8333-333333333333",orderCode:"10001",status:"reviewing",productTitle:"Snapshot product",planName:"Snapshot plan",amount:5.99,currency:"AZN",paymentMethod:"LeoBank •••• 7350",receiptUploaded:true};}
      else if(endpoint.endsWith("/resume")){body={state:"submitted",order:{orderId:"33333333-3333-4333-8333-333333333333",orderCode:"10001",status:"reviewing",productTitle:"Snapshot product",planName:"Snapshot plan",amount:5.99,currency:"AZN",paymentMethod:"LeoBank •••• 7350",receiptUploaded:true,idempotent:true}};}
      else {await route.fulfill({status:404,contentType:"application/json",body:"{}"});return;}
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
    });
    // No live WhatsApp request or message is sent: intercept the actual navigation.
    await context.route("https://wa.me/**",async route=>{target=new URL(route.request().url());await route.fulfill({status:200,contentType:"text/html",body:"<h1>Isolated WhatsApp destination</h1>"});});
    await page.route("https://script.google.com/**",route=>route.fulfill({status:200,body:"ok"}));
    await page.goto("http://127.0.0.1:10084/mehsul/tiktok-jeton",{waitUntil:"networkidle"});
    await page.click("#pp-order-btn");await page.check("#orderTermsAgreement");await page.click("#orderConfirmationConfirm");
    await page.fill('#universalOrderForm input[name="tiktok_username"]',"@fixture_user");
    await page.click('#universalOrderForm button[type="submit"]');
    await page.click("[data-payment-method]");
    await page.setInputFiles("#paymentReceiptInput",{name:"fixture.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\n%%EOF")});
    const popupPromise=page.waitForEvent("popup");
    await page.evaluate(()=>{document.getElementById("paymentSubmit").click();document.getElementById("paymentSubmit").click();});
    const popup=await popupPromise;
    assert.equal(popup.url(),"about:blank");
    await popup.waitForURL("https://wa.me/**");
    assert.equal(target.hostname,"wa.me");assert.equal(target.protocol,"https:");assert.match(target.pathname,/^\/\d{8,15}$/);
    const message=target.searchParams.get("text");for(const text of ["10001","Snapshot product","Snapshot plan","5.99","LeoBank •••• 7350","TikTok istifadəçi identifikatoru: @fixture_user","Jeton miqdarı: 500","çeki Mirpanel sisteminə yüklənib"])assert.ok(message.includes(text));
    assert.equal(message.includes("Şifrə:"),false);assert.equal(message.includes("Spotify"),false);
    assert.equal(message.includes("0000 0000"),false);assert.equal(orders,1);assert.equal(reserves,1);assert.equal(popups,1);
    // Original checkout always retains the direct fallback and order ID.
    const fallback=page.locator("#paymentWhatsAppFallbackLink");
    await fallback.waitFor({state:"visible"});
    if(await fallback.count()){
      assert.equal(new URL(await fallback.getAttribute("href")).hostname,"wa.me");assert.equal(await fallback.getAttribute("target"),"_blank");
      assert.match(await page.locator(".paymentWhatsAppFallback").textContent(),/10001/);
      assert.ok(await page.locator("#paymentWhatsAppCopy").isVisible());
      assert.ok(await fallback.evaluate(element=>element.getBoundingClientRect().height>=44));
    } else throw new Error("Back navigation did not preserve the WhatsApp fallback");
    results.push({browser:browserName,profile:profile.name,preopenedOnUserGesture:true,httpsWhatsApp:true,fallback:true,copy:true,orders,reserves,popups});
    await context.close();
  }

  // A blocked popup must not create a second order. The original tab keeps a
  // direct user-gesture link and a copyable, already encoded-once message.
  {
    const context=await browser.newContext({viewport:{width:390,height:900},isMobile:true,
      ...(process.env.MIRPANEL_BROWSER_ENGINE==="webkit"?{}:{permissions:["clipboard-read","clipboard-write"]})});
    await context.addInitScript(()=>{window.open=()=>null;});
    const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
    let orders=0,reserves=0;
    await page.route("**/api/payments/**",async route=>{
      const endpoint=new URL(route.request().url()).pathname;let body;
      if(endpoint.endsWith("/methods"))body={anyAvailable:true,methods:[{id:"22222222-2222-4222-8222-222222222222",providerName:"Fixture Bank",last4:"0000",available:true}]};
      else if(endpoint.endsWith("/reservations")){reserves++;body={reservationId:"11111111-1111-4111-8111-111111111111",expiresAt:new Date(Date.now()+600000).toISOString(),amount:5.99,currency:"AZN",method:{number:"0000 0000 0000 0000",providerName:"Fixture Bank",theme:"abb",type:"bank_card"}};}
      else if(endpoint.endsWith("/orders")){orders++;await new Promise(r=>setTimeout(r,650));body={orderId:"33333333-3333-4333-8333-333333333333",orderCode:"10001",status:"reviewing",productTitle:"Azərbaycan məhsulu",planName:"Şəxsi plan",amount:5.99,currency:"AZN",paymentMethod:"LeoBank •••• 7350",receiptUploaded:true};}
      else {await route.fulfill({status:404,contentType:"application/json",body:"{}"});return;}
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
    });
    await page.route("https://script.google.com/**",route=>route.fulfill({status:200,body:"ok"}));
    await page.goto("http://127.0.0.1:10084/mehsul/tiktok-jeton",{waitUntil:"networkidle"});
    await page.click("#pp-order-btn");await page.check("#orderTermsAgreement");await page.click("#orderConfirmationConfirm");
    await page.fill('#universalOrderForm input[name="tiktok_username"]',"@fixture_user");await page.click('#universalOrderForm button[type="submit"]');
    await page.click("[data-payment-method]");await page.setInputFiles("#paymentReceiptInput",{name:"fixture.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\n%%EOF")});
    await page.evaluate(()=>{document.getElementById("paymentSubmit").click();document.getElementById("paymentSubmit").click();});
    await page.locator("#paymentWhatsAppFallbackLink").waitFor({state:"visible"});
    const href=new URL(await page.locator("#paymentWhatsAppFallbackLink").getAttribute("href"));
    assert.equal(href.hostname,"wa.me");assert.ok(href.searchParams.get("text").includes("Azərbaycan məhsulu"));assert.ok(href.searchParams.get("text").includes("LeoBank •••• 7350"));
    await page.locator("#paymentWhatsAppCopy").click();
    await page.waitForFunction(()=>document.getElementById("paymentWhatsAppCopy")?.textContent!=="Mesajı kopyala");
    assert.equal(await page.locator("#paymentWhatsAppCopy").textContent(),"Mesaj kopyalandı");
    assert.equal(orders,1);assert.equal(reserves,1);
    results.push({browser:browserName,profile:"popup blocked",fallback:true,copy:true,orders,reserves});
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,results,consoleErrors:0,physicalSafariTested:false,physicalAndroidTested:false,liveWhatsAppContacted:false}));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
