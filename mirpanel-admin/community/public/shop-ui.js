import {ensureCart} from '/cart-ready.js?v=checkout-sounds-20261108';
import {playCheckoutSound} from '/checkout-sounds.js?v=1';
await ensureCart();
import {parseTopupCents,topupAmountText} from '/community-assets/topup-amount.js?v=topup-20261104';
import {createWalletTopup} from '/community-assets/wallet-topup.js?v=topup-card-slots-1';
export function mountShop(){
const life=new AbortController(),on=(target,name,fn)=>target.addEventListener(name,fn,{signal:life.signal});
const app=document.getElementById('shopApp'),cart=window.MirpanelCart,route=location.pathname,base='/api/payments/shop',money=c=>(Number(c)/100).toFixed(2)+' ₼';
if(route==='/odenis')app.dataset.shopCheckout='';
if(route==='/balans'){app.classList.add('shop-wallet-page');document.body.classList.add('wallet-page-active');}
const walletLoading=app.querySelector('.shop-wallet-loading')?.cloneNode(true);
const el=(t,text,cls)=>{const n=document.createElement(t);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;},link=(text,href)=>{const a=el('a',text,'shop-link');a.href=href;return a;},button=(text,fn,primary=false)=>{const b=el('button',text,primary?'shop-primary':'');b.type='button';b.onclick=fn;return b;};
let closed=false,working=false,profile=null,group=null,methods=[],confirmationTimer,walletPrefetched;
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
async function api(path,body,{file,timeout=30000}={}){if(path==='/wallet'&&body===undefined&&walletPrefetched){const pending=walletPrefetched;walletPrefetched=null;return pending;}const c=new AbortController();requests.add(c);const t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(base+path,{method:body!==undefined||file?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:file?{'Content-Type':file.type||'application/octet-stream'}:body!==undefined?{'Content-Type':'application/json'}:{},body:file|| (body===undefined?undefined:JSON.stringify(body)),signal:c.signal});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(d.error||'Əməliyyat tamamlanmadı. Yenidən cəhd edin.'),{status:r.status,code:d.code});return d;}catch(e){if(e.name==='AbortError')throw Object.assign(Error('Cavab gecikdi. Eyni əməliyyatı yenidən sınayın.'),{status:504});throw e;}finally{clearTimeout(t);requests.delete(c);}}
async function run(fn){if(working)return;working=true;error.textContent='';app.setAttribute('aria-busy','true');try{await fn();}catch(e){if(!closed){if(e.code==='CHECKOUT_EMAIL_UNVERIFIED'&&route!=='/balans'){try{await checkoutVerification();}catch(err){error.textContent=err.message;}}else error.textContent=e.message;}}finally{working=false;app.removeAttribute('aria-busy');}}
function card(title){const n=el('section',null,'shop-card');if(title)n.append(el('h2',title));return n;}
function paymentPreview(){
 if(!mobileCheckout())return null;
 const panel=card('Ödəniş');panel.classList.add('checkout-choices','checkout-priority');
 const note=el('p','Ödəniş üsulları hazırlanır…','shop-muted');note.setAttribute('role','status');panel.append(note);
 const previous=app.querySelector('.shop-checkout-grid>.checkout-choices');
 if(previous)previous.replaceWith(panel);else app.replaceChildren(el('h1','Səbətim'),panel,error);
 revealPayment(panel);return {panel,previous};
}
function restorePaymentPreview(preview){if(preview?.previous&&preview.panel.isConnected)preview.panel.replaceWith(preview.previous);}
function login(){const n=card('Balansı artırmaq üçün daxil olun və ya qeydiyyatdan keçin'),back=backFromWallet(),destination=back==='/odenis?mode=wallet'?'/balans?returnTo=%2Fodenis%3Fmode%3Dwallet':'/balans',next=encodeURIComponent(destination),actions=el('div',null,'shop-actions');actions.append(link('Daxil ol','/hesab?next='+next),link('Qeydiyyatdan keç','/hesab?mode=signup&next='+next));n.append(actions);if(back)n.append(link('← Alışa qayıt',back));app.replaceChildren(el('h1','Balansım'),n,error);}
function refreshAccount(){window.refreshCommunityNav?.();}
async function checkoutLogin(){const box=card('Hesabına daxil ol');box.append(el('p','Sifariş vermək üçün hesab lazımdır. Qeydiyyat pulsuzdur.'),link('Giriş et','/hesab?next=%2Fodenis'),link('Qeydiyyat','/hesab?mode=signup&next=%2Fodenis'));app.replaceChildren(box,error);await import('/account-header.js?v=header-session-1');if(!closed)window.MirpanelRequireLogin?.('/odenis');}
async function checkoutVerification(){
 checkoutView=false;group=null;consentAccepted=false;paymentReady=false;
 if(location.pathname!=='/sebet')history.replaceState(history.state,'','/sebet');
 else if(location.search)basketURL('/sebet');
 await basket();if(closed)return;
 const {requestEmailConfirmation}=await import('/community-assets/auth-forms.js?v=verify-session-20261108');
 if(!closed)await requestEmailConfirmation({checkout:true,signal:life.signal,onVerified:()=>location.replace('/sebet')});
}
function product(x,quantity,controls=false){const n=card(),row=el('div',null,'shop-product'),img=el('img');img.src=x.image||'/favicon.ico';img.alt=x.title;const info=el('div');info.append(el('h2',x.title),el('p',x.planName||x.plan_name,'shop-muted'),el('strong',money(x.unitCents??x.unit_cents),'shop-price'));row.append(img,info);if(controls){for(const field of x.maskedDetails||[])info.append(el('small',field.label+': '+field.value));if(x.draftId)info.append(button('Məlumatları redaktə et',()=>void import('/community-assets/cart-entry.js?v=checkout-sounds-20261108').then(m=>m.editCartLine(x)).catch(e=>{error.textContent=e.message;})));const counts=el('div',null,'shop-quantity');for(const delta of [-1,1]){const b=button(delta===-1?'−':'+',()=>run(async()=>{cart.set(x.productId,x.planIndex,quantity+delta,undefined,undefined,x.lineId);await refreshBasket();}));b.disabled=delta===-1?quantity<=1:x.renewalOnly===true||quantity>=20||x.available!=null&&quantity>=x.available;b.setAttribute('aria-label',(delta===-1?'Azalt: ':'Artır: ')+x.title);counts.append(b);if(delta===-1)counts.append(el('span',String(quantity)));}row.append(counts);const remove=button('Sil',()=>run(async()=>{cart.set(x.productId,x.planIndex,0,undefined,undefined,x.lineId);await refreshBasket();}));remove.setAttribute('aria-label','Sil: '+x.title);info.append(remove);}else info.append(el('small',quantity+' ədəd'));n.append(row);return n;}
let basketEpoch=0,viewCartKey='';
function refreshBasket(){
 consentAccepted=false;paymentReady=false;
 app.querySelectorAll('.checkout-choices button,.checkout-choices input').forEach(n=>n.disabled=true);
 return checkoutView&&!group&&cart.read().length?payment():basket();
}
if(route==='/sebet'||route==='/odenis')on(window,'mirpanel:cart',()=>{
 if(viewCartKey&&viewCartKey!==JSON.stringify(cart.read())&&!group&&!working&&(!checkoutView||profile))void run(refreshBasket);
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
  for(const p of offers){
   const a=link('',''+p.path),img=el('img'),details=el('span');
   img.src=p.image||'/favicon.ico';img.alt='';img.loading='lazy';
   details.append(el('strong',p.title),el('small',checkoutMoney(p.priceCents)+(p.from?'-dən başlayır':'')));
   a.setAttribute('aria-label',p.title+' seç');a.append(img,details,el('span','+','shop-offer-plus'));more.append(a);
  }
 });
 if(checkoutView)panel.classList.add('checkout-priority');
 layout.append(left,panel);app.classList.add('shop-combined');app.replaceChildren(el('h1','Səbətim'),layout,error);
}
async function basket(){
 const turn=++basketEpoch,items=cart.read();
 viewCartKey=JSON.stringify(items);
 if(!items.length){const empty=card('Səbətiniz boşdur');empty.classList.add('shop-empty');empty.append(link('Məhsullara bax','/mehsul'));app.replaceChildren(el('h1','Səbətim'),empty,error);return;}
 if(!app.querySelector('.shop-checkout-grid'))app.replaceChildren(el('h1','Səbətim'),el('p','Qiymətlər yoxlanılır…'),error);
 const q=await api('/quote',{items});if(closed||turn!==basketEpoch)return;
 const sum=card(),row=el('div',null,'shop-row');row.append(el('span','Cəmi'),el('strong',checkoutMoney(q.totalCents),'shop-total'));
 const next=button('Ödənişə keç',()=>void run(async()=>{
  if(q.balanceCents===null){await checkoutLogin();return;}
  const preview=paymentPreview();
  try{
   const {getCommunityState,invalidateCommunityState}=await import('/session-state.js?v=avatar-20261104');invalidateCommunityState();
   const s=await getCommunityState();profile=s.ok?s.data.profile:null;if(!profile){await checkoutLogin();return;}
   if(profile.emailVerified===false){await checkoutVerification();return;}
   checkoutView=true;if(route==='/sebet')basketURL('/sebet?checkout=1');
   await payment(true,preview);
  }catch(e){restorePaymentPreview(preview);throw e;}
 }),true);
 sum.append(row,next);sum.classList.add('checkout-choices');checkoutLayout(q,sum);
}
function topupLink(returnTo){const a=link('Balansını artır','/balans?returnTo='+encodeURIComponent(returnTo));a.classList.add('shop-primary','shop-return');return a;}
function backFromWallet(){const value=new URLSearchParams(location.search).get('returnTo')||'';return /^\/(?:mehsul(?:\/[a-z0-9-]+\/?)?|odenis\?mode=wallet|sebet)?$/.test(value)?value:'';}
async function getMethods(){
 const c=new AbortController();requests.add(c);const timeout=setTimeout(()=>c.abort(),20000);
 try{
  const response=await fetch('/api/payments/methods',{credentials:'same-origin',cache:'no-store',signal:c.signal});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Ödəniş kartları yüklənmədi.');
  if(!closed)methods=(data.methods||[]).filter(method=>method.available);
 }finally{clearTimeout(timeout);requests.delete(c);}
}
const pendingKey='mirpanel.cart.checkout.v1';
function savedCheckout(){try{return JSON.parse(localStorage.getItem(pendingKey)||'null');}catch{return null;}}
async function requestKey(items,mode,methodId){const bytes=new TextEncoder().encode(JSON.stringify({items,mode,methodId})),digest=await crypto.subtle.digest('SHA-256',bytes),input=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),old=savedCheckout();if(old?.input===input)return old;const value={input,requestId:crypto.randomUUID()};localStorage.setItem(pendingKey,JSON.stringify(value));return value;}
const checkoutMoney=c=>money(c).replace('.',',');
function checkoutIcon(path){const span=el('span',null,'checkout-icon');span.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';return span;}
const cardIcon=()=>checkoutIcon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-14 5h4"/>'),walletIcon=()=>checkoutIcon('<path d="M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h12a2 2 0 0 0 2-2v-2M3 8h15"/><rect x="13" y="9" width="9" height="7" rx="2"/>');
async function payment(reveal=false,preview=null){
 if(profile?.emailVerified===false){await checkoutVerification();return;}
 const completed=new URLSearchParams(location.search).get('completed');if(/^[0-9a-f-]{36}$/i.test(completed||'')){try{group=await api('/checkout?id='+encodeURIComponent(completed));if(group.state==='submitted'){await paymentGroup(false);return;}}catch(e){if(e.status!==404)throw e;}}
 const pending=savedCheckout();if(pending?.id){try{group=await api('/checkout?id='+pending.id);if(group.state==='reserved'||group.state==='submitted'){if(group.state==='reserved'&&!profile){await checkoutLogin();return;}await paymentGroup();return;}error.textContent='Əvvəlki rezervin vaxtı bitib. Səbətiniz qorunub.';group=null;}catch(e){if(e.status!==404)throw e;}localStorage.removeItem(pendingKey);}
 if(!profile){await checkoutLogin();return;}
 const items=cart.checkout();if(!items.length){await basket();return;}
 viewCartKey=JSON.stringify(items);
 if(reveal&&!preview)paymentPreview();
 const q=await api('/quote',{items});if(closed)return;
 const quoteKey=JSON.stringify([items,q.totalCents]);if(consentQuote!==quoteKey){consentAccepted=false;consentQuote=quoteKey;}paymentReady=true;
 const choices=card('Ödəniş');choices.classList.add('checkout-choices');const amount=el('p',null,'checkout-amount');amount.append(el('span','Cəmi'),el('strong',checkoutMoney(q.totalCents)));choices.append(amount);
 const options=el('fieldset',null,'checkout-methods');options.append(el('legend','Ödəniş üsulu'));
 for(const [value,title,sub,icon] of [
  ['card','Kartdan karta','Hazırda əlçatan deyil',cardIcon],
  ['wallet','Balansla ödə',q.balanceCents==null?'Daxil olun':checkoutMoney(q.balanceCents),walletIcon]
 ]){
  const tile=el('label',null,'checkout-tile'),radio=el('input');
  radio.type='radio';radio.name='paymentMode';radio.value=value;
  radio.disabled=value==='card';radio.checked=value==='wallet';
  if(radio.disabled)tile.classList.add('checkout-tile-disabled');
  tile.append(radio,icon(),el('strong',title),el('small',sub),el('span','✓','checkout-check'));
  options.append(tile);
 }
 choices.append(options);const walletStatus=el('div',null,'checkout-warning');choices.append(walletStatus);
 const stockOk=q.items.every(x=>x.available==null||x.available>=x.quantity);if(!stockOk)choices.append(el('p','Səbətdəki bəzi məhsullar seçdiyiniz sayda stokda yoxdur.','shop-error'),link('Səbətə qayıt','/sebet'));
 const detailsOk=q.items.every(x=>!x.detailsMissing);if(!detailsOk)choices.append(el('p','Sifariş məlumatları natamamdır. Paketi məhsul səhifəsində yenidən seçib məlumatları daxil edin.','shop-error'),link('Məhsullara bax','/mehsul'));
 const termsOk=q.items.every(x=>!x.termsMissing);if(!termsOk)choices.append(el('p','Məhsul və paket şərtlərini səbətə əlavə etməzdən əvvəl təsdiqləyin.','shop-error'),link('Məhsullara qayıt','/mehsul'));
 const consent=el('label',null,'shop-consent checkout-consent'),accept=el('input'),legal=el('span');accept.type='checkbox';accept.checked=consentAccepted;
 const legalLink=(title,id)=>{const a=link(title,'/sertler#sertler-'+id);a.target='_blank';a.rel='noopener';return a;};
 legal.append(legalLink('Ödəniş qaydalarını',4),', ',legalLink('geri qaytarma şərtlərini',6),' və ',legalLink('məsuliyyət hədlərini',8),' oxudum və qəbul edirəm.');
 consent.append(accept,legal);choices.append(consent);accept.onchange=()=>{consentAccepted=accept.checked;updateChoice();};
 const go=button('Sifarişi tamamla',()=>{if(go.disabled||!consentAccepted||!paymentReady)return;void run(submit);},true);choices.append(go);
 const short=q.balanceCents==null?0:Math.max(0,q.totalCents-q.balanceCents);
 function updateChoice(){walletStatus.replaceChildren();walletStatus.hidden=!short&&q.balanceCents!=null;
 if(short)walletStatus.append(el('strong','Balans kifayət etmir'),el('p',checkoutMoney(q.balanceCents)+' var, '+checkoutMoney(short)+' çatmır.'),topupLink('/odenis?mode=wallet'));
 else if(q.balanceCents==null)walletStatus.append(el('p','Balansla ödəniş üçün hesabınıza daxil olun.'),topupLink('/odenis?mode=wallet'));
 go.disabled=!paymentReady||!consentAccepted||!stockOk||!detailsOk||!termsOk||q.balanceCents==null||short>0;go.replaceChildren();if(go.disabled)go.append(checkoutIcon('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>'));go.append(document.createTextNode('Sifarişi tamamla · '+checkoutMoney(q.totalCents)));
 }
 async function submit(){if(!consentAccepted||!paymentReady||JSON.stringify(cart.checkout())!==JSON.stringify(items))return refreshBasket();try{const key=await requestKey(items,'wallet','');group=await api('/checkout',{items,mode:'wallet',methodId:'',requestId:key.requestId,consentAccepted,expectedTotalCents:q.totalCents});localStorage.setItem(pendingKey,JSON.stringify({...key,id:group.id}));await paymentGroup();if(group.orderCreated===true&&group.paymentConfirmed===true&&group.orderCode)void playCheckoutSound('order',group.orderCode);}catch(e){if(e.status===409)await payment();throw e;}}
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
  ['Ödənişlərimə bax','/profil?tab=payments&topup='+encodeURIComponent(saved.id),'orders','<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-13 5h3"/>'],
  ['Məhsullara bax','/mehsullar','products','<path d="M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2"/>'],
  ['Ana səhifə','/','home','<path d="m3 10 9-7 9 7v11H3V10Zm6 11v-8h6v8"/>']]){const a=link('',url);a.classList.add('shop-result-action--'+variant);a.append(checkoutIcon(path),el('span',text));actions.append(a);}
 const back=backFromWallet();
 if(back==='/odenis?mode=wallet')actions.append(link('Alışa qayıt',back));
 result.append(badge,message,actions);app.replaceChildren(result);window.scrollTo({top:0,behavior:'instant'});heading.focus({preventScroll:true});
}
async function wallet(){let data;try{data=await api('/wallet');}catch(e){if(e.status===401){login();return;}throw e;}
 const hero=card('Mövcud balans');hero.classList.add('shop-wallet-hero');hero.append(el('strong',money(data.cents)));
 const preview=el('p',null,'shop-topup-preview'),result=el('span','—');preview.append(document.createTextNode('Əlavə etdikdən sonra: '),result);preview.setAttribute('aria-live','polite');hero.append(preview);
 const form=card('Balansı artır'),amount=el('input'),presets=el('div',null,'shop-presets'),hint=el('p','Minimum 1 ₼ · Maksimum 500 ₼','shop-muted'),invalid=el('p','','shop-error');let selectedCents=500,flow;
 amount.inputMode='decimal';amount.placeholder='Öz məbləğiniz';amount.maxLength=32;amount.setAttribute('aria-label','AZN məbləği');hint.id='topupAmountHint';invalid.id='topupAmountError';amount.setAttribute('aria-describedby',hint.id+' '+invalid.id);invalid.setAttribute('aria-live','polite');
 const effective=()=>selectedCents??parseTopupCents(amount.value);
 function update(){let cents;try{cents=effective();invalid.textContent='';amount.setAttribute('aria-invalid','false');}catch(e){invalid.textContent=amount.value?e.message:'';amount.setAttribute('aria-invalid',String(!!amount.value));}result.textContent=cents!==undefined&&Number.isSafeInteger(data.cents)&&Number.isSafeInteger(data.cents+cents)?money(data.cents+cents):'—';flow?.updateAmount();}
 for(const n of [5,10,20,50]){const b=button(n+' ₼',()=>{selectedCents=n*100;amount.value='';for(const p of presets.children)p.setAttribute('aria-pressed',String(p===b));update();});b.setAttribute('aria-pressed',String(n===5));presets.append(b);}
 amount.oninput=()=>{selectedCents=null;for(const p of presets.children)p.setAttribute('aria-pressed','false');update();};
 const amountLabel=el('label','Və ya öz məbləğinizi daxil edin');amountLabel.append(amount);form.append(presets,amountLabel,hint,invalid);
 flow=createWalletTopup({el,button,api,run,money,methods,profile,getCents:effective,signal:life.signal,isClosed:()=>closed,onBusy:b=>{amount.disabled=b;for(const p of presets.children)p.disabled=b;},restoreCents:c=>{selectedCents=[500,1000,2000,5000].includes(c)?c:null;amount.value=selectedCents===null?topupAmountText(c):'';for(const p of presets.children)p.setAttribute('aria-pressed',String(Number(p.textContent.split(' ')[0])*100===selectedCents));update();},onComplete:async saved=>{showTopupResult(saved);}});form.append(flow.element);update();
 const history=card('Əməliyyat tarixçəsi');history.classList.add('shop-history');history.id='emeliyyatlar';for(const x of data.items){const row=el('article');row.append(el('strong',(Number(x.cents)>0?'+':'')+money(x.cents)),el('p',x.reason,'shop-muted'),el('small',new Date(x.created_at).toLocaleString('az-AZ',{timeZone:'Asia/Baku'})));history.append(row);}if(data.more)historyMore(history,1);if(!data.items.length)history.append(el('p','Hələ əməliyyat yoxdur.','shop-muted'));const requests=card('Balans müraciətləri');for(const x of data.topups.filter(x=>x.status!=='draft'))requests.append(el('p',money(x.requested_cents)+' · '+({reviewing:'Yoxlanılır',approved:'Təsdiqləndi',rejected:'Rədd edildi'}[x.status]||x.status)));if(!data.topups.some(x=>x.status!=='draft'))requests.append(el('p','Hələ müraciət yoxdur.','shop-muted'));const back=backFromWallet();if(back){const a=link('← Alışa qayıt',back);a.classList.add('shop-return');form.prepend(a);}requests.append(link('Sifarişlərimdə bax','/sifarislerim'));app.replaceChildren(el('h1','Balansım'),hero,form,status,requests,history,error);void flow.resume();}
async function start(){
 if(!app.querySelector('.shop-wallet-loading')){
  app.replaceChildren(el('h1',route==='/balans'?'Balansım':'Səbətim'),walletLoading?.cloneNode(true)||el('div',null,'site-route-placeholder'));
 }
 if(route==='/sebet'&&!checkoutView){await basket();return;}
 const session=import('/session-state.js?v=avatar-20261104').then(m=>{if(checkoutView)m.invalidateCommunityState();return m.getCommunityState();});
 void session.catch(()=>{});
 if(route==='/balans'){
  walletPrefetched=api('/wallet');
  const methodsReady=getMethods();void methodsReady.catch(()=>{});
  try{await walletPrefetched;}catch(e){if(closed)return;if(e.status===401){walletPrefetched=null;login();return;}throw e;}
  const [s]=await Promise.all([session,methodsReady]);
  if(closed)return;if(s.ok)profile=s.data.profile;
  await wallet();
 }else{
  const s=await session;if(closed)return;
  if(s.ok){profile=s.data.profile;window.mirpanelAccountProfile=profile||null;window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:profile||null}));}
  await payment(true);
 }
 if(location.hash==='#emeliyyatlar')document.getElementById('emeliyyatlar')?.scrollIntoView();
}
const dispose=()=>{closed=true;clearTimeout(confirmationTimer);for(const r of requests)r.abort();life.abort();document.body.classList.remove('wallet-page-active');};
on(window,'pagehide',dispose);on(window,'mirpanel:account',e=>{if(profile&&!e.detail&&route==='/balans'){document.body.classList.remove('wallet-topup-active');login();}const signedOut=!!profile&&!e.detail;profile=e.detail;if(signedOut&&checkoutView&&group?.state!=='submitted')void checkoutLogin();});
on(window,'mirpanel:before-navigate',e=>{if(working||app.querySelector('input[type=file]')?.files.length){e.preventDefault();status.textContent='Əvvəl aktiv əməliyyatı tamamlayın və ya ləğv edin. Seçilmiş fayl qorunub.';}});
const boot=()=>{walletPrefetched=null;return start().catch(e=>{if(closed)return;app.replaceChildren(el('h1','Yükləmə alınmadı'),error,button('Yenidən cəhd et',boot));error.textContent=e.message;});};void boot();
function historyMore(history,page){const more=button('Daha çox göstər',()=>run(async()=>{more.disabled=true;try{const d=await api('/wallet?page='+(page+1));more.remove();for(const x of d.items){const row=el('article');row.append(el('strong',(Number(x.cents)>0?'+':'')+money(x.cents)),el('p',x.reason,'shop-muted'),el('small',new Date(x.created_at).toLocaleString('az-AZ',{timeZone:'Asia/Baku'})));history.append(row);}if(d.more)historyMore(history,page+1);}finally{more.disabled=false;}}));history.append(more);}
window.mirpanelPageDispose=dispose;return dispose;
}
if(!new URL(import.meta.url).searchParams.get('v')?.startsWith('shell-')&&!window.mirpanelNavigationMounting&&document.getElementById('shopApp'))mountShop();
