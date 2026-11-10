import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {normalizeAdminPayload,extractAdminState} from '../mirpanel-admin/core.mjs';
import {checkoutFields,validateDetails} from '../mirpanel-admin/community/public/checkout-fields.js';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const live=process.argv.includes('--live'),origin=live?'https://mirpanel.com':'https://mirpanel.test';
const adminOrigin=live?'https://mirpanel.onrender.com':origin;
const readAsset=async(file,url)=>{
 if(!live)return fs.readFile(file,'utf8');
 const r=await fetch(url,{signal:AbortSignal.timeout(12000)});assert.ok(r.ok,url);return r.text();
};
const admin=await readAsset('mirpanel-admin/public/admin.js',adminOrigin+'/admin.js?v=customer-form-1');
const css=await readAsset('mirpanel-admin/public/admin.css',adminOrigin+'/admin.css?v=customer-form-1');
const segment=(start,end)=>admin.slice(admin.indexOf(start),admin.indexOf(end,admin.indexOf(start)));
const editor=segment("let formScope='product'",'function renderCategories()');
const definitions=segment('const orderFlows =','function validHttpsUrl')+
 segment('const formFieldTypes =','const defaultUi')+
 segment('function defaultFormField','function slug')+
 segment('function activeFormFields','function ensureProduct');
const addHandler=segment('$("addFormFieldBtn").addEventListener','$("productImagePickBtn")');
const data=extractAdminState(await fs.readFile('app.js','utf8'));
const sourceProducts=['prime','capcut'].map(id=>data.products.find(p=>p.id===id));
const files=new Map();
for(const name of ['checkout-fields.js','cart-entry.js','cart-entry.css','entry-styles.js']){
 files.set('/community-assets/'+name,await readAsset('mirpanel-admin/community/public/'+name,origin+'/community-assets/'+name+'?v=customer-form-1'));
}
const pin={key:'code_4',label:'Otaq kodu',placeholder:'Məsələn, 0408',type:'pin',digits:4,enabled:true,required:true};
for(const [engine,width] of [[chromium,390],[chromium,1440],[webkit,390]]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 const context=await browser.newContext({viewport:{width,height:900}});
 try{
  let customerProduct={id:'prime',title:'Prime Video',formFields:[pin],plans:[{label:'1 ay'},{label:'2 ay',formFields:[]}]},submitted=[];
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url()),p=u.pathname;
   const js=body=>route.fulfill({contentType:'text/javascript',body});
   if(files.has(p))return route.fulfill({contentType:p.endsWith('.css')?'text/css':'text/javascript',body:files.get(p)});
   if(p==='/cart-ready.js')return js('export async function ensureCart(){return {commitDraft(){window.committed=true},open(){window.cartOpened=true}}}');
   if(p==='/api/payments/shop/quote'){
    const {planIndex}=route.request().postDataJSON().items[0],plan=customerProduct.plans[planIndex];
    return route.fulfill({json:{balanceCents:500,items:[{productId:'prime',planIndex,planName:plan.label,terms:'Sınaq şərtləri',termsVersion:'synthetic',fields:checkoutFields(customerProduct,plan)}]}});
   }
   if(p==='/api/payments/shop/draft'){
    const req=route.request().postDataJSON();
    submitted.push(validateDetails(checkoutFields(customerProduct,customerProduct.plans[req.planIndex]),req.values));
    return route.fulfill({json:{draftId:'synthetic'}});
   }
   if(p==='/editor'||p==='/customer')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><main class="productFormGroups"><div id="productFieldActions"><select id="formFieldScope"></select><button id="addFormFieldBtn">Sahə əlavə et</button></div><div id="formFields"></div></main>'});
   return route.fulfill({status:404});
  });
  const page=await context.newPage();
  await page.goto(origin+'/editor');
  await page.addStyleTag({content:css});
  await page.addScriptTag({content:`
   const $=id=>document.getElementById(id);
   const escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
   const renderOptions=(a,v)=>a.map(([k,t])=>'<option value="'+k+'"'+(k===v?' selected':'')+'>'+t+'</option>').join('');
   const selectedProduct=()=>window.product;
   const markDirty=()=>{},refreshOrderFlowDisplay=()=>{},ensureConfirmation=()=>({});
   ${definitions}${editor}${addHandler}
   window.openEditor=product=>{window.product=product;renderFormFields(product);};
  `});
  for(const [index,original]of sourceProducts.entries()){
   await page.evaluate(product=>window.openEditor(product),original);
   const cards=page.locator('.formFieldRow');
   await page.locator('#addFormFieldBtn').click();
   const created=cards.last();
   await created.getByLabel('Müştərinin gördüyü ad').fill('Sınaq kodu');
   await created.getByLabel('Xanada görünən nümunə').fill('Məsələn, 0408');
   await created.getByLabel('Cavab növü').selectOption('pin');
   assert.equal(await created.getByLabel('Kodun rəqəm sayı').inputValue(),'4');
   assert.equal(await created.locator('details').evaluate(e=>e.open),false);
   assert.equal(await page.getByText('Sahənin adı',{exact:true}).count(),0);
   const key=await page.evaluate(()=>product.formFields.at(-1).key);
   await created.getByLabel('Aktiv').uncheck();
   await page.waitForFunction(()=>!document.querySelector('[data-field-preview]').textContent.includes('Sınaq kodu'));
   assert.ok(await created.isVisible());
   await created.getByLabel('Aktiv').check();
   await page.locator('[data-field-preview]').getByText('Sınaq kodu',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>product.formFields.at(-1).key),key);
   const preserved=await page.evaluate(()=>product.formFields[0].key);
   await created.getByRole('button',{name:/yuxarı/}).click();
   assert.ok(await page.evaluate(key=>product.formFields.some(f=>f.key===key),preserved));
   while(await cards.count())await cards.last().getByRole('button',{name:/sil/i}).click();
   const saved=await page.evaluate(()=>product);
   const normalized=normalizeAdminPayload({...data,products:[saved]}).products[0];
   assert.deepEqual(normalized.formFields,[]);
   assert.deepEqual(checkoutFields(normalized,normalized.plans[0]),[]);
   if(index===0){
    await page.locator('#formFieldScope').selectOption('0');
    await page.getByRole('button',{name:'Bu paket üçün ayrıca sahələr'}).click();
    await page.locator('#addFormFieldBtn').click();
    await cards.last().getByRole('button',{name:/sil/i}).click();
    assert.deepEqual(await page.evaluate(()=>product.plans[0].formFields),[]);
    await page.getByRole('button',{name:'Ümumi məhsul sahələrinə qayıt'}).click();
    assert.equal(await page.evaluate(()=>Object.hasOwn(product.plans[0],'formFields')),false);
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.goto(origin+'/customer');
  async function accept(index){
   await page.evaluate(async ({p,index})=>{
    window.cartOpened=false;
    const {startCartEntry}=await import('/community-assets/cart-entry.js?v=customer-form-1');
    await startCartEntry(p,p.plans[index]);
   },{p:customerProduct,index});
   await page.getByRole('checkbox').check();
   await page.getByRole('button',{name:'Təsdiqləyirəm'}).click();
  }
  await accept(0);
  const field=page.getByRole('textbox',{name:'Otaq kodu'});
  await field.waitFor();
  assert.equal(await field.getAttribute('placeholder'),pin.placeholder);
  assert.equal(await field.getAttribute('inputmode'),'numeric');
  assert.equal(await page.locator('.cart-entry-fields input').count(),1);
  assert.ok((await page.locator('dialog.cart-entry').boundingBox()).height<300);
  await field.fill('0408');assert.equal(await field.inputValue(),'0408');
  await page.getByRole('button',{name:'Davam et'}).click();
  await page.waitForFunction(()=>window.cartOpened);
  assert.deepEqual(submitted[0],{code_4:'0408'});
  assert.throws(()=>validateDetails(checkoutFields(customerProduct,customerProduct.plans[0]),{code_4:'408'}));
  await accept(1);
  await page.waitForFunction(()=>window.cartOpened);
  assert.deepEqual(submitted[1],{});
  assert.equal(await page.getByRole('heading',{name:'Sifariş məlumatları'}).count(),0);
  console.log('PASS '+engine.name()+' '+width+'px: Prime and CapCut admin changes, compact single field, leading zero and no form for empty package');
 }finally{await context.close();await browser.close();}
}
