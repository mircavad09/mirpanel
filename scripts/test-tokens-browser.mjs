import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import catalogCard from '../catalog-card.js';
import {shopFixture} from './shop-test-fixture.mjs';
import {tokenWallet} from '../mirpanel-admin/community/tokens.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const fixture=await shopFixture(),{pool,shop,catalog}=fixture;
const product={id:'mirpanel-token',title:'Mirpanel Token',image:'/assets/tokens/mirpanel-token.webp',plans:[{price:1}]};
catalog.products.push(product);
const customer={user:'a'},owner='a'.repeat(64);
const profile={user_id:'a',name:'Sınaq',emailVerified:true};
await pool.query("insert into wallet_accounts(user_id,cents) values('a',0)");
let checkoutRequests=[],lastCheckout=null,loseNextResponse=false;
const shell=(body)=>'<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/community-assets/shop.css"><body>'+body+'</body>';
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://local'),route=url.pathname;
 const respond=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 const html=s=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(s);};
 try{
  let body;
  if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;body=JSON.parse(raw);}
  if(route==='/api/community/state')return respond({profile});
  if(route==='/api/community/tokens')return respond(await tokenWallet(pool,customer.user));
  if(route==='/api/payments/shop/quote')return respond(await shop.quote(customer,body.items,owner,null,body.tokenCount??null));
  if(route==='/api/payments/shop/checkout'&&body){
   checkoutRequests.push(body);const result=await shop.checkout(customer,owner,body);lastCheckout=result;
   if(loseNextResponse){loseNextResponse=false;return respond({error:'Bağlantı təsdiqlənmədi'},503);}
   return respond(result);
  }
  if(route==='/api/payments/shop/checkout')return respond(await shop.get(customer,owner,url.searchParams.get('id')));
  if(route==='/api/payments/shop/drafts'||route==='/api/payments/storefront')return respond({items:[],products:[]});
  if(route==='/api/payments/shop/draft/remove')return respond({removed:true});
  if(route==='/odenis')return html(shell('<main id="shopApp" class="shop-page"></main><script type="module" src="/community-assets/shop-ui.js"></script>'));
  if(route==='/balans'){
   assert.equal(url.searchParams.get('returnTo'),'/odenis?mode=wallet&token=1');
   await pool.query("update wallet_accounts set cents=20000 where user_id='a'");
   return html(shell('<p>Sınaq balansı artırıldı</p><a href="/odenis?mode=wallet&amp;token=1">Alışa qayıt</a>'));
  }
  if(route==='/profil')return html(shell('<main id="wallet"></main><script type="module">import {mountTokenWallet} from "/community-assets/token-ui.js";mountTokenWallet({root:document.getElementById("wallet")});</script>'));
  if(route==='/mehsul/mirpanel-token')return html(fs.readFileSync('mehsul/mirpanel-token.page','utf8').replace(/<script src="\/site-header[^<]*<\/script>/g,''));
  if(route==='/')return html(shell(catalogCard.render(product,0,'/mehsul/mirpanel-token',product.title,1,'1,00 ₼')+'<script defer src="/cart-store.js"></script>'));
  const asset=route.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+route.slice(18):route.slice(1);
  if(!route.includes('..')&&fs.existsSync(asset)&&fs.statSync(asset).isFile()){
   res.writeHead(200,{'Content-Type':/\.(?:js|mjs)$/.test(route)?'text/javascript':route.endsWith('.css')?'text/css':route.endsWith('.webp')?'image/webp':'application/octet-stream'});return res.end(fs.readFileSync(asset));
  }
  respond({},404);
 }catch(e){respond({error:e.message},e.status||500);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
fs.mkdirSync('outputs/token-compact',{recursive:true});
const fakeDraft={productId:'ordinary',planIndex:0,quantity:1,termsVersion:(await shop.quote(customer,[{productId:'ordinary',planIndex:0,quantity:1}],owner)).items[0].termsVersion};
try{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   for(const width of [320,390,430,1440]){
    await pool.query("update wallet_accounts set cents=0 where user_id='a'");
    let purchased=0;
    try{purchased=(await tokenWallet(pool,'a')).balance;}catch(e){if(e.code!=='42P01')throw e;}
    checkoutRequests=[];loseNextResponse=true;
    const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    const warning=page.getByRole('dialog',{name:'Diqqət! Almamışdan əvvəl oxuyun.'});
    const drawer=page.getByRole('dialog',{name:'Səbət',exact:true});
    const rows=()=>page.evaluate(()=>window.MirpanelCart.read());

    await page.goto(base);await page.waitForFunction(()=>window.MirpanelCart?.apiVersion===7);
    await page.locator('.homeCardAdd').click();await warning.waitFor();
    assert.equal(await warning.getByRole('button',{name:'Davam et'}).isDisabled(),true);
    await warning.getByRole('button',{name:'Ləğv et'}).click();assert.deepEqual(await rows(),[]);
    await page.locator('.homeCardOrder').click();await warning.getByRole('checkbox',{name:'Oxudum və təsdiqləyirəm'}).check();
    await warning.getByRole('button',{name:'Davam et'}).click();await drawer.getByText('50 token',{exact:true}).waitFor();
    await drawer.getByRole('button',{name:'Səbəti bağla'}).click();

    await page.getByRole('heading',{name:'Mirpanel Token',exact:true}).getByRole('link').click();
    const input=page.getByRole('spinbutton',{name:'Miqdar seçin'});
    assert.equal(await input.inputValue(),'50');
    for(const [n,total] of [[50,'1,00 ₼'],[55,'1,10 ₼'],[5000,'100,00 ₼']]){
     await input.fill(String(n));
     assert.equal(await page.locator('.token-total').textContent(),total);
     await page.getByText('Seçilmiş miqdar: '+n+' token',{exact:true}).waitFor();
    }
    await input.fill('');assert.equal(await input.getAttribute('placeholder'),'50–5000');
    for(const invalid of ['', '49','5001','50.5','-1']){
     await input.fill(invalid);assert.equal(await page.getByRole('button',{name:'İndi al',exact:true}).isDisabled(),true);
     assert.equal(await page.getByRole('button',{name:'Səbətə at',exact:true}).isDisabled(),true);
    }
    await input.fill('55');assert.equal(await page.getByText('+ Artır',{exact:true}).count(),0);
    await page.screenshot({path:'outputs/token-compact/product-'+engine.name()+'-'+width+'.png'});
    await page.getByRole('button',{name:'Səbətə at',exact:true}).click();
    await warning.getByRole('checkbox').check();await warning.getByRole('button',{name:'Davam et'}).click();
    await page.getByRole('status').filter({hasText:'Məhsul səbətə əlavə edildi'}).waitFor();
    assert.equal(await drawer.count(),0);assert.equal((await rows())[0].tokenCount,55);
    await page.evaluate(row=>localStorage.setItem('mirpanel.cart.v1',JSON.stringify([row,...window.MirpanelCart.read()])),fakeDraft);
    await page.getByRole('button',{name:'İndi al',exact:true}).click();
    await warning.getByRole('checkbox').check();await warning.getByRole('button',{name:'Davam et'}).click();
    await drawer.getByText('55 token',{exact:true}).waitFor();await drawer.getByRole('button',{name:'Token üçün ödənişə keç',exact:true}).click();
    await page.getByText('1,10 ₼ çatmır',{exact:true}).waitFor();
    await page.getByRole('link',{name:'+ Artır',exact:true}).click();
    await page.getByRole('link',{name:'Alışa qayıt'}).click();
    await page.getByText('55 token',{exact:true}).waitFor();
    const pay=page.getByRole('button',{name:'Sifarişi tamamla · 1,10 ₼',exact:true});
    assert.equal(await pay.isDisabled(),true);assert.equal(checkoutRequests.length,0);
    await page.getByRole('checkbox').check();await pay.click();await page.getByText('Bağlantı təsdiqlənmədi',{exact:true}).waitFor();
    assert.equal((await tokenWallet(pool,'a')).balance,purchased+55);
    await page.reload();await page.getByRole('checkbox').check();await pay.click();
    await page.getByText('55 token hesabınıza əlavə edildi.',{exact:true}).waitFor();
    assert.equal(checkoutRequests[0].requestId,checkoutRequests[1].requestId);
    assert.equal(checkoutRequests[0].tokenCount,55);assert.equal(checkoutRequests[0].expectedTotalCents,110);
    assert.equal((await tokenWallet(pool,'a')).balance,purchased+55);
    assert.equal((await rows()).length,1);assert.equal((await rows())[0].productId,'ordinary');
    await page.reload();await page.getByText('55 token hesabınıza əlavə edildi.',{exact:true}).waitFor();
    assert.equal((await shop.get(customer,owner,lastCheckout.id)).tokenCount,55);
    await page.getByRole('link',{name:'Tokenlərim',exact:true}).click();
    await page.getByText(purchased+55+' token',{exact:true}).waitFor();
    assert.deepEqual(errors,[]);await page.close();console.log('PASS',engine.name(),width,'prices, placeholder, confirmation, cart, top-up return, retry and one credit');
   }
  }finally{await browser.close();}
 }
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fixture.close();}
