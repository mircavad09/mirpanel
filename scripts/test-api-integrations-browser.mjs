import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractAdminState} from '../mirpanel-admin/core.mjs';

const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT || 'playwright');
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_CHROME});
const publicDir=new URL('../mirpanel-admin/public/',import.meta.url);
const state=extractAdminState(await readFile(new URL('../app.js',import.meta.url),'utf8'));
const origin='http://mirpanel.test';
const api='/api/admin/api-integrations';
const product={id:'pubg',title:'PUBG Mobile',plans:[{key:'uc60',label:'60 UC',fields:[]}]};
const type={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css'};

try {
  for (const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
    const page=await context.newPage();
    const records={products:[product],suppliers:[],mappings:[],jobs:[],drafts:[]};
    let epinbySaved=false;
    await context.route('**/*',async route=>{
      const u=new URL(route.request().url());
      if (u.origin!==origin) return route.abort();
      if (u.pathname.startsWith('/api/')) {
        let json={items:[],settings:{},products:[],orders:[],methods:[]};
        if (u.pathname==='/api/session') json={csrfToken:'synthetic'};
        if (u.pathname==='/api/admin/state') json={data:state,sha:'synthetic',csrfToken:'synthetic'};
        if (u.pathname===api) {
          if (route.request().method()==='POST') {
            const input=route.request().postDataJSON();
            assert.equal(route.request().headers()['x-csrf-token'],'synthetic');
            if(input.action.startsWith('epinby-')){
              if(input.action==='epinby-save'){
                assert.equal(input.apiKey,'synthetic-key');
                assert.equal(input.webhookSecret,'synthetic-webhook');
                epinbySaved=true;
              }
              const tested=input.action==='epinby-test';
              return route.fulfill({json:{apiKeySaved:epinbySaved,webhookSecretSaved:epinbySaved,
                balance:tested?'12.50':null,currency:tested?'AZN':null,
                ...(tested?{lastStatus:'confirmed',message:'Bağlantı təsdiqləndi'}:{})}});
            }
            assert.equal(input.action,'activate');
            assert.equal(input.plan,'uc60');
            if (width===390) {
              records.drafts=[{id:'test-draft',details:{name:input.name,productId:input.productId},
                reason:'API ünvanı icazə siyahısında deyil.'}];
              json={ok:false,draftId:'test-draft',reason:records.drafts[0].reason};
            } else {
              records.suppliers=[{id:'supplier-1',name:input.name}];
              records.mappings=[{product_id:input.productId,plan_key:input.plan,
                supplier_id:'supplier-1',active:true,settings:{...input.settings,fields:JSON.parse(input.settings.fields)}}];
              json={ok:true,supplierId:'supplier-1'};
            }
          } else json=records;
        }
        return route.fulfill({json});
      }
      if (!/^\/[a-z0-9.-]+$/i.test(u.pathname)) return route.fulfill({status:404});
      try {
        const body=await readFile(new URL(u.pathname.slice(1),publicDir));
        return route.fulfill({body,contentType:type[u.pathname.split('.').at(-1)]});
      } catch { return route.fulfill({status:404}); }
    });
    await page.goto(origin+'/admin.html');
    const button=page.locator('.navBtn[data-view="apiIntegrations"]');
    await page.waitForURL('**/admin.html#dashboard');
    if (width===390) await page.locator('.mobileMenuToggle').click();
    assert.equal(await button.isVisible(),true);
    await button.click();
    await page.locator('main #apiIntegrationsView').waitFor({state:'visible'});
    assert.equal(new URL(page.url()).pathname,'/admin.html');
    assert.equal(context.pages().length,1);
    assert.equal(await page.locator('header').first().isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const epinby=page.locator('#epinbyForm');
    await epinby.locator('[name=apiKey]').fill('synthetic-key');
    await epinby.locator('[name=webhookSecret]').fill('synthetic-webhook');
    await epinby.getByRole('button',{name:'Yadda saxla',exact:true}).click();
    await page.getByText('Məlumatlar saxlanıldı.',{exact:true}).waitFor();
    assert.equal(await epinby.locator('[name=apiKey]').inputValue(),'');
    assert.match(await epinby.locator('[name=webhookSecret]').getAttribute('placeholder'),/saxlanılıb/);
    await epinby.getByRole('button',{name:'Bağlantını yoxla'}).click();
    await page.locator('#epinbyFeedback').getByText('Bağlantı təsdiqləndi').waitFor();
    await page.locator('#epinbyStatus').getByText('12.50 AZN').waitFor();
    await page.reload();
    await epinby.locator('[name=apiKey][placeholder*="saxlanılıb"]').waitFor();
    assert.equal(await epinby.locator('[name=apiKey]').inputValue(),'');
    const form=page.locator('#mappingForm');
    await form.locator('[name=productId]').selectOption('pubg');
    await form.locator('[name=plan]').selectOption('uc60');
    for (const [name,value] of Object.entries({name:'Sınaq',base:'https://test.example',key:'fake-key',
      testPath:'/health',serviceId:'60',orderPath:'/orders',statusPath:'/status'})) {
      await form.locator('[name='+name+']').fill(value);
    }
    await form.getByRole('button',{name:'Yadda saxla və aktivləşdir'}).click();
    if (width===390) {
      await page.getByText('Qaralama saxlandı. API ünvanı icazə siyahısında deyil.',{exact:true}).waitFor();
      assert.equal(await page.locator('#integrationState').textContent(),'');
    } else await page.locator('#integrationState').getByText('Aktiv',{exact:true}).waitFor();
    await context.close();
  }
  console.log('Supplier admin: desktop and mobile inline view, activation, and draft feedback passed.');
} finally { await browser.close(); }
