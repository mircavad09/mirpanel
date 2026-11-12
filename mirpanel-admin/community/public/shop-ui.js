import {ensureCart} from '/cart-ready.js?v=cart-ready-now-1';
import {playCheckoutSound} from '/checkout-sounds.js?v=1';
await ensureCart();
import {parseTopupCents,topupAmountText} from '/community-assets/topup-amount.js?v=topup-20261104';
import {createWalletTopup,topupReviewTime} from '/community-assets/wallet-topup.js?v=topup-auto-cards-1';
export function mountShop(){
const life=new AbortController(),on=(target,name,fn)=>target.addEventListener(name,fn,{signal:life.signal});
const app=document.getElementById('shopApp'),cart=window.MirpanelCart,route=location.pathname,base='/api/payments/shop',money=c=>(Number(c)/100).toFixed(2)+' ₼';
if(route==='/odenis')app.dataset.shopCheckout='';
if(route==='/balans'){app.classList.add('shop-wallet-page');document.body.classList.add('wallet-page-active');}
const walletLoading=app.querySelector('.shop-wallet-loading')?.cloneNode(true);
const el=(t,text,cls)=>{const n=document.createElement(t);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;},link=(text,href)=>{const a=el('a',text,'shop-link');a.href=href;return a;},button=(text,fn,primary=false)=>{const b=el('button',text,primary?'shop-primary':'');b.type='button';b.onclick=fn;return b;};
let accountEpoch=0;
let closed=false,working=false,profile=null,group=null,confirmationTimer,walletFlow;
let checkoutView=route==='/odenis'||route==='/sebet'&&new URLSearchParams(location.search).get('checkout')==='1',consentAccepted=false,consentQuote='',paymentReady=false,offerRequest;
const mobileCheckout=()=>matchMedia('(max-width:760px)').matches;
function revealPayment(panel){
 if(!mobileCheckout()||!panel?.isConnected)return;
 const header=document.querySelector('.site-header'),gap=(header?.getBoundingClientRect().height||0)+8;
 window.scrollTo({top:Math.max(0,scrollY+panel.getBoundingClientRect().top-gap),behavior:'instant'});
}
function basketURL(path){if(window.MirpanelNavigation)window.MirpanelNavigation.replaceURL(path);else history.replaceState(history.state,'',path);}
const requests=new Set();
const error=el('p','','shop-error');error.setAttribute('role','alert');const status=el('p');status.setAttribute('role','status');
async function api(path,body,{file,timeout=30000}={}){const epoch=accountEpoch;const c=new AbortController();requests.add(c);const t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(base+path,{method:body!==undefined||file?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:file?{'Content-Type':file.type||'application/octet-stream'}:body!==undefined?{'Content-Type':'application/json'}:{},body:file|| (body===undefined?undefined:JSON.stringify(body)),signal:c.signal});const d=await r.json().catch(()=>({}));if(epoch!==accountEpoch)throw Object.assign(Error('Account changed.'),{code:'ACCOUNT_CHANGED'});if(!r.ok)throw Object.assign(Error(d.error||'Əməliyyat tamamlanmadı. Yenidən cəhd edin.'),{status:r.status,code:d.code});return d;}catch(e){if(epoch!==accountEpoch)throw Object.assign(Error('Account changed.'),{code:'ACCOUNT_CHANGED'});if(e.name==='AbortError')throw Object.assign(Error('Cavab gecikdi. Eyni əməliyyatı yenidən sınayın.'),{status:504});throw e;}finally{clearTimeout(t);requests.delete(c);}}
async function run(fn){if(working)return;working=true;error.textContent='';app.setAttribute('aria-busy','true');try{await fn();}catch(e){if(!closed&&e.code!=='ACCOUNT_CHANGED'){if(e.code==='CHECKOUT_EMAIL_UNVERIFIED'&&route!=='/balans'){try{await checkoutVerification();}catch(err){error.textContent=err.message;}}else error.textContent=e.message;}}finally{working=false;app.removeAttribute('aria-busy');}}
function card(title){const n=el('section',null,'shop-card');if(title)n.append(el('h2',title));return n;}
function login(){const n=card('Balansı artırmaq üçün daxil olun və ya qeydiyyatdan keçin'),back=backFromWallet(),destination=back==='/odenis?mode=wallet'?'/balans?returnTo=%2Fodenis%3Fmode%3Dwallet':'/balans',next=encodeURIComponent(destination+(location.hash==='#balansi-artir'?location.hash:'')),actions=el('div',null,'shop-actions');actions.append(link('Daxil ol','/hesab?next='+next),link('Qeydiyyatdan keç','/hesab?mode=signup&next='+next));n.append(actions);if(back)n.append(link('← Alışa qayıt',back));app.replaceChildren(el('h1','Balansım'),n,error);}
function refreshAccount(){window.refreshCommunityNav?.();}
async function checkoutLogin(){const box=card('Hesabına daxil ol');box.append(el('p','Sifariş vermək üçün hesab lazımdır. Qeydiyyat pulsuzdur.'),link('Giriş et','/hesab?next=%2Fodenis'),link('Qeydiyyat','/hesab?mode=signup&next=%2Fodenis'));app.replaceChildren(box,error);await import('/account-header.js?v=header-session-1');if(!closed)window.MirpanelRequireLogin?.('/odenis');}
async function checkoutVerification(){
 checkoutView=false;group=null;consentAccepted=false;paymentReady=false;
 if(location.pathname!=='/sebet')history.replaceState(history.state,'','/sebet');
 else if(location.search)basketURL('/sebet');
 await basket();if(closed)return;
 const {requestEmailConfirmation}=await import('/community-assets/auth-forms.js?v=email-confirmation-sheet-1');
 if(!closed)await requestEmailConfirmation({checkout:true,signal:life.signal,onVerified:()=>location.replace('/sebet')});
}
function product(x,quantity,controls=false){const n=card(),row=el('div',null,'shop-product'),img=el('img');img.src=x.image||'/favicon.ico';img.alt=x.title;const info=el('div');info.append(el('h2',x.title),el('p',x.planName||x.plan_name,'shop-muted'),el('strong',x.unitCents==null&&x.unit_cents==null?'—':money(x.unitCents??x.unit_cents),'shop-price'));row.append(img,info);if(x.salesDisabled||x.available===0)info.append(el('p','Stokda yoxdur','shop-error'));else if(x.available!=null&&x.available<quantity)info.append(el('p','Stokda '+x.available+' ədəd var.','shop-error'));if(controls){for(const field of x.maskedDetails||[])info.append(el('small',field.label+': '+field.value));if(x.draftId)info.append(button('Məlumatları redaktə et',()=>void import('/community-assets/cart-entry.js?v=epinby-account-1').then(m=>m.editCartLine(x)).catch(e=>{error.textContent=e.message;})));const counts=el('div',null,'shop-quantity');for(const delta of [-1,1]){const b=button(delta===-1?'−':'+',()=>run(async()=>{cart.set(x.productId,x.planIndex,quantity+delta,undefined,undefined,x.lineId);await refreshBasket();}));b.disabled=delta===-1?quantity<=1:x.renewalOnly===true||quantity>=20||x.available!=null&&quantity>=x.available;b.setAttribute('aria-label',(delta===-1?'Azalt: ':'Artır: ')+x.title);counts.append(b);if(delta===-1)counts.append(el('span',String(quantity)));}row.append(counts);const remove=button('Sil',()=>run(async()=>{cart.set(x.productId,x.planIndex,0,undefined,undefined,x.lineId);await refreshBasket();}));remove.setAttribute('aria-label','Sil: '+x.title);info.append(remove);}else info.append(el('small',quantity+' ədəd'));n.append(row);return n;}
let basketEpoch=0,viewCartKey='';
function refreshBasket(){
 consentAccepted=false;paymentReady=false;
 app.querySelectorAll('.checkout-choices button,.checkout-choices input').forEach(n=>n.disabled=true);
 return checkoutView&&!group&&cart.read().length?payment():basket();
}
if(route==='/sebet'||route==='/odenis')on(window,'mirpanel:cart',()=>{
 if(viewCartKey&&viewCartKey!==JSON.stringify(cart.read())&&!group&&!working)void run(refreshBasket);
});
function checkoutLayout(q,panel){
 const layout=el('div',null,'shop-checkout-grid'),left=el('section',null,'shop-checkout-cart');
 left.setAttribute('aria-label','Səbətdəki məhsullar');
 left.append(...q.items.map(x=>product(x,x.quantity,true)));
 const more=el('section',null,'shop-checkout-offers');more.append(el('h2','Daha çox məhsul əlavə et'),link('Məhsullara bax','/mehsul'));left.append(more);
 offerRequest??=fetch('/api/payments/storefront',{signal:life.signal}).then(r=>r.ok?r.json():null).catch(()=>null);
 void offerRequest.then(data=>{
  if(closed||!Array.isArray(data?.products)||!more.isConnected)return;
  const inCart=new Set(q.items.map(x=>x.productId));
  const category=data.products.find(p=>p.id===q.items.at(-1)?.productId)?.category;
  const offers=data.products.filter(p=>!inCart.has(p.id)&&p.priceCents>0&&/^\/mehsul\/[a-z0-9-]+$/.test(p.path))
   .sort((a,b)=>Number(b.category===category)-Number(a.category===category)).slice(0,4);
  for(const source of offers){const p={...source,priceCents:window.MirpanelPricing?.minimum(source.id,source.priceCents)??source.priceCents};
   const a=link('',''+p.path),img=el('img'),details=el('span');
   img.src=p.image||'/favicon.ico';img.alt='';img.loading='lazy';
   details.append(el('strong',p.title),el('small',checkoutMoney(p.priceCents)+(p.from?'-dən başlayır':'')));
   a.setAttribute('aria-label',p.title+' seç');a.append(img,details,el('span','+','shop-offer-plus'));more.append(a);
  }
 });
 if(checkoutView)panel.classList.add('checkout-priority');
 layout.append(left,panel);app.classList.add('shop-combined');app.replaceChildren(el('h1','Səbətim'),layout,error);
}
function basketPreview(items){
 const previewRows=cart.previewRows?.(items)||items.map(x=>({...x,title:x.productId}));
 const total=previewRows.every(x=>Number.isSafeInteger(x.unitCents))?previewRows.reduce((sum,x)=>sum+x.unitCents*x.quantity,0):null;
 return {items:previewRows,totalCents:total};
}
async function basket(){
 const turn=++basketEpoch,items=cart.read();
 viewCartKey=JSON.stringify(items);
 if(!items.length){const empty=card('Səbətiniz boşdur');empty.classList.add('shop-empty');empty.append(link('Məhsullara bax','/mehsul'));app.replaceChildren(el('h1','Səbətim'),empty,error);return;}
 renderBasket(basketPreview(items));
 try{
  const q=await api('/quote',{items});
  if(!closed&&turn===basketEpoch&&!checkoutView)renderBasket(q);
 }catch(e){if(!closed&&turn===basketEpoch&&e.code!=='ACCOUNT_CHANGED')error.textContent=e.message;}
}
function renderBasket(q){
 const sum=card(),row=el('div',null,'shop-row');row.append(el('span','Cəmi'),el('strong',q.totalCents==null?'—':checkoutMoney(q.totalCents),'shop-total'));
 const next=button('Ödənişə keç',()=>{
  if(q.balanceCents===null){void run(checkoutLogin);return;}
  checkoutView=true;
  if(route==='/sebet')basketURL('/sebet?checkout=1');
  void payment(true,q);
 },true);
 next.disabled=q.items.some(x=>x.termsMissing||x.detailsMissing||x.salesDisabled||x.available!=null&&x.available<x.quantity);
 sum.append(row,next);sum.classList.add('checkout-choices');checkoutLayout(q,sum);
}
function topupLink(){
 const a=link('+ Artır','/balans?returnTo='+encodeURIComponent('/odenis?mode=wallet')+'#balansi-artir');
 a.classList.add('shop-primary','shop-return','checkout-topup-link');
 return a;
}
function backFromWallet(){const value=new URLSearchParams(location.search).get('returnTo')||'';return /^\/(?:mehsul(?:\/[a-z0-9-]+\/?)?|odenis\?mode=wallet|sebet)?$/.test(value)?value:'';}
const pendingKey='mirpanel.cart.checkout.v1';
function savedCheckout(){try{return JSON.parse(localStorage.getItem(pendingKey)||'null');}catch{return null;}}
async function requestKey(items,mode,methodId){const bytes=new TextEncoder().encode(JSON.stringify({items,mode,methodId})),digest=await crypto.subtle.digest('SHA-256',bytes),input=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),old=savedCheckout();if(old?.input===input)return old;const value={input,requestId:crypto.randomUUID()};localStorage.setItem(pendingKey,JSON.stringify(value));return value;}
const checkoutMoney=c=>money(c).replace('.',',');
function checkoutIcon(path){const span=el('span',null,'checkout-icon');span.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';return span;}
const cardIcon=()=>checkoutIcon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-14 5h4"/>'),walletIcon=()=>checkoutIcon('<path d="M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h12a2 2 0 0 0 2-2v-2M3 8h15"/><rect x="13" y="9" width="9" height="7" rx="2"/>');
async function payment(reveal=false,preview=null){
 const turn=++basketEpoch;
 const active=()=>!closed&&turn===basketEpoch;
 paymentReady=false;
 error.textContent='';
 const completed=new URLSearchParams(location.search).get('completed'),pending=savedCheckout();
 const recovering=/^[0-9a-f-]{36}$/i.test(completed||'')||!!pending?.id;
 const items=cart.checkout();
 if(!items.length&&!recovering)return basket();
 const initial=preview||basketPreview(items);
 viewCartKey=JSON.stringify(cart.read());
 renderPayment(initial,items,{pending:true,reveal});
 // Session verification and the authoritative quote are independent.
 const session=readSession();
 const quote=(!recovering&&items.length?api('/quote',{items}):Promise.resolve(null))
  .then(data=>({data}),error=>({error}));
 try{
  const state=await session;
  if(!active())return;
  if(!state.ok&&state.status!==401&&state.status!==403)throw Error('Hesab məlumatı alınmadı.');
  profile=state.ok?state.data.profile:null;
  if(profile?.emailVerified===false){await checkoutVerification();return;}
  if(/^[0-9a-f-]{36}$/i.test(completed||'')){
   try{
    const saved=await api('/checkout?id='+encodeURIComponent(completed));
    if(!active())return;
    if(saved.state==='submitted'){group=saved;await paymentGroup(false);return;}
   }catch(e){if(e.status!==404)throw e;}
  }
  if(!profile){await checkoutLogin();return;}
  if(pending?.id){
   try{
    const saved=await api('/checkout?id='+encodeURIComponent(pending.id));
    if(!active())return;
    if(saved.state==='reserved'||saved.state==='submitted'){group=saved;await paymentGroup();return;}
    error.textContent='Əvvəlki rezervin vaxtı bitib. Səbətiniz qorunub.';
   }catch(e){if(e.status!==404)throw e;}
   localStorage.removeItem(pendingKey);
  }
  if(!items.length){await basket();return;}
  const result=await quote;
  if(result.error)throw result.error;
  const q=result.data||await api('/quote',{items});
  if(!active())return;
  if(!Number.isSafeInteger(q.totalCents)||!Array.isArray(q.items))throw Error('Ödəniş məlumatı alınmadı.');
  if(q.balanceCents===null){await checkoutLogin();return;}
  if(!Number.isSafeInteger(q.balanceCents)||q.balanceCents<0)throw Error('Balans məlumatı alınmadı.');
  const quoteKey=JSON.stringify([items,q.totalCents]);
  if(consentQuote!==quoteKey){consentAccepted=false;consentQuote=quoteKey;}
  paymentReady=true;
  renderPayment(q,items);
 }catch(e){
  if(active()&&e.code!=='ACCOUNT_CHANGED')renderPayment(initial,items,{failure:true});
 }
}
function renderPayment(q,items,{pending=false,failure=false,reveal=false}={}){
 const confirmed=!pending&&!failure;
 const choices=card('Ödəniş');choices.classList.add('checkout-choices');const amount=el('p',null,'checkout-amount');amount.append(el('span','Cəmi'),el('strong',q.totalCents==null?'—':checkoutMoney(q.totalCents)));choices.append(amount);
 const options=el('fieldset',null,'checkout-methods');options.append(el('legend','Ödəniş üsulu'));
 for(const [value,title,sub,icon] of [
  ['card','Kartdan karta','Hazırda əlçatan deyil',cardIcon],
  ['wallet','Balansla ödə',confirmed?checkoutMoney(q.balanceCents):null,walletIcon]
 ]){
  const tile=el('label',null,'checkout-tile'),radio=el('input');
  radio.type='radio';radio.name='paymentMode';radio.value=value;
  radio.disabled=value==='card';radio.checked=value==='wallet';
  if(radio.disabled)tile.classList.add('checkout-tile-disabled');
  const detail=el('small',sub);
  if(value==='wallet'&&!confirmed){
   detail.setAttribute('role','status');
   detail.textContent=pending?'Balans yoxlanılır…':'Balans oxunmadı';
   if(pending)detail.classList.add('checkout-balance-loading');
  }
  tile.append(radio,icon(),el('strong',title),detail,el('span','✓','checkout-check'));
  options.append(tile);
 }
 choices.append(options);const walletStatus=el('div',null,'checkout-warning');choices.append(walletStatus);
 const stockOk=q.items.every(x=>!x.salesDisabled&&(x.available==null||x.available>=x.quantity));if(confirmed&&!stockOk)choices.append(el('p','Səbətdəki bəzi məhsullar seçdiyiniz sayda stokda yoxdur.','shop-error'),link('Səbətə qayıt','/sebet'));
 const detailsOk=q.items.every(x=>!x.detailsMissing);if(confirmed&&!detailsOk)choices.append(el('p','Sifariş məlumatları natamamdır. Paketi məhsul səhifəsində yenidən seçib məlumatları daxil edin.','shop-error'),link('Məhsullara bax','/mehsul'));
 const termsOk=q.items.every(x=>!x.termsMissing);if(confirmed&&!termsOk)choices.append(el('p','Məhsul və paket şərtlərini səbətə əlavə etməzdən əvvəl təsdiqləyin.','shop-error'),link('Məhsullara qayıt','/mehsul'));
 const consent=el('label',null,'shop-consent checkout-consent'),accept=el('input'),legal=el('span');accept.type='checkbox';accept.checked=consentAccepted;accept.disabled=!confirmed;
 const legalLink=(title,id)=>{const a=link(title,'/sertler#sertler-'+id);a.target='_blank';a.rel='noopener';return a;};
 legal.append(legalLink('Ödəniş qaydalarını',4),', ',legalLink('geri qaytarma şərtlərini',6),' və ',legalLink('məsuliyyət hədlərini',8),' oxudum və qəbul edirəm.');
 consent.append(accept,legal);choices.append(consent);accept.onchange=()=>{consentAccepted=accept.checked;updateChoice();};
 const go=button('Sifarişi tamamla',()=>{if(go.disabled||!consentAccepted||!paymentReady)return;void run(submit);},true);choices.append(go);
 const short=confirmed?Math.max(0,q.totalCents-q.balanceCents):0;
 if(failure){
  walletStatus.classList.add('checkout-retry');walletStatus.append(el('span','Ödəniş məlumatları alınmadı.'),button('Yenidən cəhd et',()=>void payment(true,q)));
 }else if(short){
  walletStatus.classList.add('checkout-shortfall');
  const copy=el('div',null,'checkout-shortfall-copy'),amounts=el('p',checkoutMoney(q.balanceCents)+' var · ');
  amounts.append(el('strong',checkoutMoney(short)+' çatmır'));
  copy.append(el('strong','Balans kifayət etmir'),amounts);
  const progress=el('progress',null,'checkout-shortfall-progress');
  progress.max=q.totalCents;progress.value=q.balanceCents;
  progress.setAttribute('aria-label','Balansın qarşıladığı sifariş məbləği');
  walletStatus.append(walletIcon(),copy,topupLink(),progress,
   el('p','Balansını artır, sonra səbətinə qayıdıb ödənişi tamamla.','checkout-shortfall-note'));
 }else walletStatus.hidden=true;
 function updateChoice(){
  go.disabled=!confirmed||!paymentReady||!consentAccepted||!stockOk||!detailsOk||!termsOk||short>0;
  go.replaceChildren();
  if(go.disabled)go.append(checkoutIcon('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>'));
  go.append('Sifarişi tamamla'+(q.totalCents==null?'':' · '+checkoutMoney(q.totalCents)));
 }
 async function submit(){if(!consentAccepted||!paymentReady||JSON.stringify(cart.checkout())!==JSON.stringify(items))return refreshBasket();try{const key=await requestKey(items,'wallet','');group=await api('/checkout',{items,mode:'wallet',methodId:'',requestId:key.requestId,consentAccepted,expectedTotalCents:q.totalCents});localStorage.setItem(pendingKey,JSON.stringify({...key,id:group.id}));await paymentGroup();if(group.orderCreated===true&&group.paymentConfirmed===true&&group.orderCode)void playCheckoutSound('order',group.orderCode);}catch(e){if(e.status===409)await payment().catch(()=>{});throw e;}}
 updateChoice();checkoutLayout(q,choices);if(reveal)revealPayment(choices);
}
async function paymentGroup(clearCart=true){
 clearTimeout(confirmationTimer);
 if(closed)return;
 const rejected=group.items.some(x=>['rejected','expired','cancelled'].includes(x.status));
 if(group.state==='submitted'){
  if(clearCart){cart.clear();localStorage.removeItem(pendingKey);basketURL('/odenis?completed='+encodeURIComponent(group.id));}
  const paid=group.paymentConfirmed===true, delivered=group.deliveryStatus==='completed';
  const heading=paid?'Ödənişiniz uğurla tamamlandı!':rejected?'Ödəniş təsdiqlənmədi':'Ödəniş yoxlanılır';
  const detail=paid?(delivered?'Hesab məlumatlarınız Sifarişlərim bölməsində hazırdır.':'Sifarişiniz hazırlanır. Təhvil vəziyyətini Sifarişlərim bölməsindən izləyə bilərsiniz.'):rejected?'Sifarişinizin cari statusuna Sifarişlərim bölməsində baxa bilərsiniz.':'Çekiniz qəbul edildi. Ödəniş təsdiqlənəndə sifarişinizin statusu yenilənəcək.';
  const summary=el('section',null,'shop-result'),message=el('div',null,'shop-result-message'),actions=el('nav',null,'shop-result-actions');
  summary.dataset.result=paid?'paid':rejected?'rejected':'reviewing';
  const badge=checkoutIcon(paid?'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>':rejected?'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');badge.classList.add('shop-result-badge');
  message.setAttribute('aria-live','polite');message.append(el('h1',heading),el('p',detail));
  if(group.orderCode)message.append(el('p','Sifariş № '+group.orderCode+' · '+checkoutMoney(group.totalCents),'shop-result-reference'));
  actions.setAttribute('aria-label','Sifarişdən sonra keçidlər');
  for(const [variant,label,url,icon] of [
   ['orders','Sifarişlərimə bax',group.orderCode?'/profil?tab=orders&order='+encodeURIComponent(group.orderCode):'/profil?tab=orders','<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z M3 8l9 5 9-5m-9 5v8M7.5 5.5l9 5"/>'],
   ['products','Məhsullara bax','/mehsul','<path d="m3 8 3-4h12l3 4v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Zm0 0h18m-6 4a3 3 0 0 1-6 0"/>'],
   ['home','Ana səhifə','/','<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Zm6 11v-8h6v8"/>']
  ]){
   const a=link('',url);a.classList.add('shop-result-action--'+variant);
   a.append(checkoutIcon(icon),el('span',label));actions.append(a);
  }
  const existing=app.querySelector('.shop-result');
  if(existing){existing.dataset.result=summary.dataset.result;existing.querySelector('.shop-result-badge').replaceWith(badge);existing.querySelector('.shop-result-message').replaceChildren(...message.childNodes);}
  else{summary.append(badge,message,actions);app.replaceChildren(summary,error);if(clearCart)window.scrollTo({top:0,behavior:'instant'});}
  refreshAccount();
  if(group.mode==='card'&&!group.paymentConfirmed&&!rejected){
   const initial=group;
   const poll=async()=>{
    if(closed||group!==initial)return;
    if(!document.hidden)try{
     const updated=await api('/checkout?id='+encodeURIComponent(initial.id),undefined,{timeout:8000});
     if(closed||group!==initial)return;
     if(updated.paymentConfirmed||updated.items.some(x=>['rejected','expired','cancelled'].includes(x.status))){
      group=updated;await paymentGroup(false);
      if(updated.paymentConfirmed&&updated.orderCode)void playCheckoutSound('order',updated.orderCode);return;
     }
    }catch(e){if(e.status===401||e.status===403)return;}
    if(!closed&&group===initial)confirmationTimer=setTimeout(poll,12000);
   };
   confirmationTimer=setTimeout(poll,12000);
  }
  return;
 }
 const reserved=group;
 const panel=card('Kartdan karta hazırda əlçatan deyil');
 panel.append(el('p','Köçürmə etmisinizsə, davam etməzdən əvvəl operatorla əlaqə saxlayın.'),
  button('Rezervi ləğv et və balansla davam et',()=>void run(async()=>{
   await api('/cancel',{id:reserved.id});
   localStorage.removeItem(pendingKey);group=null;await payment();
  }),true));
 app.replaceChildren(panel,error);

}
function showTopupResult(saved){
 const result=el('section',null,'shop-result wallet-topup-result');result.dataset.result='paid';result.setAttribute('aria-labelledby','topupResultTitle');
 const badge=checkoutIcon('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>');badge.classList.add('shop-result-badge');
 const message=el('div',null,'shop-result-message'),heading=el('h1','Ödəniş uğurla əlavə edildi!');heading.id='topupResultTitle';heading.tabIndex=-1;
 message.append(heading,el('p','Ödənişiniz yoxlanılır. Nəticəni Ödənişlərim bölməsində izləyə bilərsiniz.'),el('p','Müraciət № '+saved.number+' · '+checkoutMoney(saved.cents),'shop-result-reference'));
 const actions=el('nav',null,'shop-result-actions');actions.setAttribute('aria-label','Ödənişdən sonra');
 for(const [text,url,variant,path] of [
  ['Ödənişlərimə bax','/profil?tab=payments&topup='+encodeURIComponent(saved.id),'orders','<path d="M5 3h14v18l-3.5-2.5L12 21l-3.5-2.5L5 21V3Zm3.5 5h7m-7 4h7m-7 4H12"/>'],
  ['Məhsullara bax','/mehsul','products','<path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10M7.5 5l9 4v3"/>'],
  ['Ana səhifə','/','home','<path d="m3 10 9-7 9 7v11H3V10Zm6 11v-8h6v8"/>']]){const a=link('',url);a.classList.add('shop-result-action--'+variant);a.append(checkoutIcon(path),el('span',text));actions.append(a);}
 result.append(badge,message,actions);app.replaceChildren(result);window.scrollTo({top:0,behavior:'instant'});heading.focus({preventScroll:true});
}
function showWalletLoading(){
 app.setAttribute('aria-busy','true');
 const loading=walletLoading?.cloneNode(true)||el('div','Balans məlumatı yüklənir…','shop-wallet-loading');
 loading.setAttribute('role','status');
 app.replaceChildren(el('h1','Balansım'),loading);
}
function showWallet(data){
 walletFlow?.abort();
 walletFlow=new AbortController();
 const flowSignal=walletFlow.signal;
 const hero=card('Mövcud balans');hero.classList.add('shop-wallet-hero');hero.append(el('strong',money(data.cents)));
 const preview=el('p',null,'shop-topup-preview'),result=el('span','—');preview.append(document.createTextNode('Əlavə etdikdən sonra: '),result);preview.setAttribute('aria-live','polite');hero.append(preview);
 const presetAmounts=[5,10,20,50,100];
 const form=card('Məbləği seçin'),amount=el('input'),presets=el('div',null,'shop-presets'),hint=el('p','Minimum 1 ₼ · Maksimum 500 ₼','shop-muted'),invalid=el('p','','shop-error');let selectedCents=500,flow;
 form.id='balansi-artir';
 amount.inputMode='decimal';amount.placeholder='0,00';amount.maxLength=32;hint.id='topupAmountHint';invalid.id='topupAmountError';amount.setAttribute('aria-describedby',hint.id+' '+invalid.id);invalid.setAttribute('aria-live','polite');
 const effective=()=>selectedCents??parseTopupCents(amount.value);
 function update(){let cents;try{cents=effective();invalid.textContent='';amount.setAttribute('aria-invalid','false');}catch(e){invalid.textContent=amount.value?e.message:'';amount.setAttribute('aria-invalid',String(!!amount.value));}result.textContent=cents!==undefined&&Number.isSafeInteger(data.cents)&&Number.isSafeInteger(data.cents+cents)?money(data.cents+cents):'—';flow?.updateAmount();}
 for(const n of presetAmounts){const b=button(n+' ₼',()=>{selectedCents=n*100;amount.value='';for(const p of presets.children)p.setAttribute('aria-pressed',String(p===b));update();});b.dataset.cents=String(n*100);b.setAttribute('aria-pressed',String(n===5));presets.append(b);}
 amount.oninput=()=>{selectedCents=null;for(const p of presets.children)p.setAttribute('aria-pressed','false');update();};
 const amountLabel=el('label',null,'wallet-custom-amount'),amountField=el('span',null,'wallet-custom-field'),currency=el('span','₼','wallet-custom-currency');
 const labelText=el('span','Başqa məbləğ');labelText.id='topupCustomAmountLabel';amount.setAttribute('aria-labelledby',labelText.id);
 currency.setAttribute('aria-hidden','true');amountField.append(amount,currency);amountLabel.append(labelText,amountField);form.append(presets,amountLabel,hint,invalid);
 flow=createWalletTopup({el,button,api,run,money,methods:[],profile,getCents:effective,signal:flowSignal,isClosed:()=>closed||flowSignal.aborted,onBusy:b=>{amount.disabled=b;for(const p of presets.children)p.disabled=b;},restoreCents:c=>{selectedCents=presetAmounts.includes(c/100)?c:null;amount.value=selectedCents===null?topupAmountText(c):'';for(const p of presets.children)p.setAttribute('aria-pressed',String(Number(p.dataset.cents)===selectedCents));update();},onComplete:async saved=>{if(!flowSignal.aborted)showTopupResult(saved);}});update();
 const back=backFromWallet();
 if(back){const a=link('← Alışa qayıt',back);a.classList.add('shop-return');form.prepend(a);}
 app.replaceChildren(el('h1','Balansım'),hero,form,flow.element,status,error,walletQuestions());void flow.resume();
}
function walletQuestions(){
 const section=el('section',null,'wallet-faq'),title=el('h2','Balans haqqında suallar'),list=el('div',null,'wallet-faq-list');
 title.id='walletFaqTitle';section.setAttribute('aria-labelledby',title.id);
 for(const [question,answer] of [
  ['Balans nəyə üçündür?','Balansınızdakı məbləğlə səbətinizdəki məhsulları hər dəfə kart məlumatı daxil etmədən ala bilərsiniz.'],
  ['Komissiya tutulurmu?','Xeyr. MirPanel balans artırmaya komissiya tətbiq etmir. Göndərdiyiniz məbləğ tam olaraq balansınıza əlavə olunur.'],
  ['Köçürmə nə vaxt təsdiqlənir?','Çeki göndərdikdən sonra təsdiq adətən '+topupReviewTime+' çəkir. İş saatlarımız hər gün 11:00–00:00-dır.']
 ]){
  const item=el('details');item.append(el('summary',question),el('p',answer));list.append(item);
 }
 const historyLink=el('a','Ödənişlərim','wallet-history-link');historyLink.href='/profil?tab=payments';
 section.append(title,list,historyLink);return section;
}
const readSession=()=>import('/session-state.js?v=avatar-20261104').then(m=>m.getCommunityState(checkoutView?{maxAge:0}:undefined));
function showLoadError(e,retry){
 app.replaceChildren(el('h1','Yükləmə alınmadı'),error,button('Yenidən cəhd et',retry));
 error.textContent=e.message;
}
async function loadWallet(knownProfile=false){
 const epoch=accountEpoch,active=()=>!closed&&epoch===accountEpoch;
 showWalletLoading();
 // The public card list is loaded by the top-up form only when opened.
 // The session identifies the local draft to resume. The wallet endpoint
 // itself authorizes the balance and decides whether sign-in is required.
 const session=knownProfile?null:readSession().catch(()=>null);
 try{
  const data=await api('/wallet');
  const account=await session;
  if(!active())return;
  if(account?.ok)profile=account.data.profile;
  showWallet(data);
  if(location.hash==='#balansi-artir')document.getElementById('balansi-artir')?.scrollIntoView({block:'start',behavior:'instant'});
 }catch(e){
  if(!active())return;
  if(e.status===401)login();
  else showLoadError(e,()=>void loadWallet());
 }finally{if(active())app.removeAttribute('aria-busy');}
}
async function start(){
 if(route==='/balans')return loadWallet();
 if(route==='/sebet'&&!checkoutView){await basket();return;}
 await payment(true);
}
const dispose=()=>{closed=true;clearTimeout(confirmationTimer);for(const r of requests)r.abort();walletFlow?.abort();life.abort();document.body.classList.remove('wallet-page-active');};
on(window,'pagehide',dispose);on(window,'mirpanel:account',e=>{
 const prior=profile?.user_id??profile?.id??null,next=e.detail?.user_id??e.detail?.id??null;profile=e.detail;
 if(prior===next)return;
 ++accountEpoch;++basketEpoch;for(const request of requests)request.abort();
 group=null;consentAccepted=false;paymentReady=false;working=false;offerRequest=null;walletFlow?.abort();
 localStorage.removeItem(pendingKey);clearTimeout(confirmationTimer);
 if(route==='/balans'){
  if(!next){app.removeAttribute('aria-busy');login();}
  else void loadWallet(true);
  return;
 }
 if(checkoutView&&!next)void checkoutLogin();else void run(refreshBasket);
});
on(window,'mirpanel:prices',()=>{if(!closed&&!working&&!group&&['/sebet','/odenis'].includes(route)&&(!checkoutView||paymentReady))void run(refreshBasket);});
on(window,'mirpanel:before-navigate',e=>{if(working||app.querySelector('input[type=file]')?.files.length){e.preventDefault();status.textContent='Əvvəl aktiv əməliyyatı tamamlayın və ya ləğv edin. Seçilmiş fayl qorunub.';}});
const boot=()=>start().catch(e=>{if(!closed)showLoadError(e,boot);});void boot();
window.mirpanelPageDispose=dispose;return dispose;
}
if(!new URL(import.meta.url).searchParams.get('v')?.startsWith('shell-')&&!window.mirpanelNavigationMounting&&document.getElementById('shopApp'))mountShop();
