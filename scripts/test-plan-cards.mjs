import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES, 'playwright/index.mjs')));
const root = process.cwd();
const server = http.createServer((req, res) => {
  let file = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (file.startsWith('mehsul/') && !path.extname(file)) file += '.page';
  file = path.join(root, file);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  const type = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.page') ? 'text/html' : file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream';
  res.writeHead(200, {'Content-Type':type}); res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({executablePath:process.env.MIRPANEL_BROWSER_PATH,headless:true});
const results = [], errors = [], resourceErrors = [], operations = [];
const visualDir = process.env.MIRPANEL_VISUAL_DIR;
if(visualDir) fs.mkdirSync(visualDir,{recursive:true});
try {
  for(const width of [320,390,1440]) for(const slug of ['capcut-pro','spotify-premium','youtube-premium']) {
    const page = await browser.newPage({viewport:{width,height:width<500?844:900}});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',message=>{if(message.type()==='error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text());});
    page.on('response',response=>{if(response.status()>=400) resourceErrors.push({status:response.status(),url:response.url()});});
    await page.route('**/*',async route=>{
      const req=route.request();
      // Disable host telemetry in the read-only live fixture; it is not an order operation.
      if(new URL(req.url()).pathname==='/cdn-cgi/rum') return route.fulfill({status:204});
      if(req.method()!=='GET') { operations.push(req.url()); return route.abort(); }
      return route.continue();
    });
    await page.goto(`${process.env.MIRPANEL_TEST_ORIGIN || `http://127.0.0.1:${server.address().port}`}/mehsul/${slug}`,{waitUntil:'networkidle'});
    await page.waitForTimeout(3100);
    const original = await page.evaluate(()=>JSON.stringify(currentProduct.plans));
    const count = await page.locator('#pp-plans-container .pp-plan-label').count();
    assert.ok(count>0);
    for(let index=0;index<count;index++) {
      await page.locator('#pp-plans-container .pp-plan-label').nth(index).click();
      await page.waitForTimeout(220);
      const result=await page.evaluate(()=>({
        index:currentPlanIdx,
        overflow:document.documentElement.scrollWidth>innerWidth,
        rows:[...document.querySelectorAll('#pp-plans-container .pp-plan-label')].map(row=>{
          const name=row.querySelector('.pp-plan-name'),price=row.querySelector('.pp-plan-right');
          const nr=name.getBoundingClientRect(),pr=price.getBoundingClientRect();
          return {label:name.textContent,height:row.getBoundingClientRect().height,nameLines:Math.round(nr.height/parseFloat(getComputedStyle(name).lineHeight)),active:row.classList.contains('active'),color:getComputedStyle(row.querySelector('.pp-new-price')).color,emphasis:row.dataset.priceEmphasis,nameFont:getComputedStyle(name).fontSize,overlap:nr.right>pr.left,textClipped:name.scrollHeight>name.clientHeight || name.scrollWidth>name.clientWidth};
        })
      }));
      assert.equal(result.index,index); assert.equal(result.overflow,false);
      for(const row of result.rows) {
        assert.ok(row.height>=44); assert.equal(row.overlap,false); assert.equal(row.textClipped,false);
        assert.ok(row.nameLines<=2,`${slug}@${width}: ${row.label} wraps to ${row.nameLines} lines`);
        assert.equal(row.color,row.emphasis==='discount-month'?'rgb(255, 212, 0)':'rgb(255, 255, 255)');
        if(width<500) assert.equal(row.nameFont,'12px');
      }
      // Open only the initial confirmation; never accept it or enter payment.
      await page.locator('#pp-order-btn').click();
      const selected = JSON.parse(original)[index];
      const info = await page.locator('#mInfo').textContent();
      assert.ok(info.includes(Number(selected.price).toFixed(2)),info);
      if(selected.label) assert.ok(info.replace(/\s+/g,' ').includes(selected.label.trim().replace(/\s+/g,' ')),info);
      await page.locator('#closeModal').click();
      assert.equal(await page.evaluate(()=>JSON.stringify(currentProduct.plans)),original);
      if(index===0 && visualDir) {
        await page.locator('#pp-plans-container').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(visualDir,`${slug}-${width}.png`)});
      }
      if(index===0) results.push({slug,width,...result});
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('#pp-plans-container .pp-plan-label').first().evaluate(row=>getComputedStyle(row).transitionDuration),'0s');
    await page.close();
  }
  assert.deepEqual(errors,[]); assert.deepEqual(operations,[]);
  console.log(JSON.stringify({results,javascriptErrors:errors.length,resourceErrors:[...new Map(resourceErrors.map(item=>[item.url,item])).values()],writeRequests:operations.length},null,2));
} finally {await browser.close(); await new Promise(r=>server.close(r));}
