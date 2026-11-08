import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1150,height:800}});
 await page.setContent('<main><div id="plans"></div></main>');
 await page.addScriptTag({path:'mirpanel-admin/public/admin-order-guide.js'});
 await page.evaluate(()=>{window.fixture={id:'qa',title:'Sintetik məhsul',plans:[{label:'Telefon'},{label:'Kompüter'}]};window.dirtyCount=0;mountAdminOrderGuide(document.querySelector('#plans'),fixture,()=>dirtyCount++);});
 await page.locator('#orderGuideEditor summary').click();
 await page.getByLabel('Məlumat mətni').fill('Ümumi sınaq mətni');
 await page.getByLabel('Məhsul və ya paket').selectOption('0');
 await page.getByLabel('Məlumat mətni').fill('Telefon qaydası');
 assert.equal(await page.getByText('Kompüterdə QR ilə giriş',{exact:true}).count(),0);
 const steps=page.locator('fieldset').filter({hasText:'Telefonda giriş'});
 for(let i=0;i<2;i++){
  await steps.getByRole('button',{name:'+ Addım əlavə et'}).click();
  await steps.getByLabel('Şəklin ünvanı').nth(i).fill('/uploads/demo-'+i+'.png');
  await steps.getByLabel('Addımın izahı').nth(i).fill('Sınaq '+i);
 }
 await steps.getByRole('button',{name:'Yuxarı'}).nth(1).click();
 assert.deepEqual(await steps.getByLabel('Addımın izahı').evaluateAll(xs=>xs.map(x=>x.value)),['Sınaq 1','Sınaq 0']);
 await page.getByLabel('Məhsul və ya paket').selectOption('1');
 await page.getByText('Kompüterdə QR ilə giriş',{exact:true}).waitFor();
 await page.getByLabel('Məhsul və ya paket').selectOption('product');
 assert.equal(await page.getByLabel('Məlumat mətni').inputValue(),'Ümumi sınaq mətni');
 assert.equal(await page.evaluate(()=>adminOrderGuideError([fixture])),'');
 assert(await page.evaluate(()=>dirtyCount>0));
 console.log('PASS: admin product/package switching, content editing, step order, and phone-only controls');
}finally{await browser.close();}
