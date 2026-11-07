import {ensureCart} from '/cart-ready.js?v=checkout-sounds-20261108';
import {playCheckoutSound} from '/checkout-sounds.js?v=1';
await ensureCart();
import {parseTopupCents,topupAmountText} from '/community-assets/topup-amount.js?v=topup-20261104';
import {createWalletTopup,drawBankChoices,orderBankDetail} from '/community-assets/wallet-topup.js?v=order-transfer-20261106';
export function mountShop(){
const life=new AbortController(),on=(target,name,fn)=>target.addEventListener(name,fn,{signal:life.signal});
const app=document.getElementById('shopApp'),cart=window.MirpanelCart,route=location.pathname,base='/api/payments/shop',money=c=>(Number(c)/100).toFixed(2)+' ₼';
if(route==='/odenis')app.dataset.shopCheckout='';
if(route==='/balans'){app.classList.add('shop-wallet-page');document.body.classList.add('wallet-page-active');}
const el=(t,text,cls)=>{const n=document.createElement(t);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;},link=(text,href)=>{const a=el('a',text,'shop-link');a.href=href;return a;},button=(text,fn,primary=false)=>{const b=el('button',text,primary?'shop-primary':'');b.type='button';b.onclick=fn;return b;};
let closed=false,working=false,profile=null,group=null,mode=new URLSearchParams(location.search).get('mode')==='wallet'?'wallet':'card',methodId='',methods=[],allMethods=[],methodLoadError='',timer,confirmationTimer,epoch=0,walletPrefetched;
let checkoutView=route==='/odenis'||route==='/sebet'&&new URLSearchParams(location.search).get('checkout')==='1',consentAccepted=false,consentQuote='',paymentReady=false,offerRequest;
const requests=new Set();
const error=el('p','','shop-error');error.setAttribute('role','alert');const status=el('p');status.setAttribute('role','status');
async function api(path,body,{file,timeout=30000}={}){if(path==='/wallet'&&body===undefined&&walletPrefetched){const pending=walletPrefetched;walletPrefetched=null;return pending;}const c=new AbortController();requests.add(c);const t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(base+path,{method:body!==undefined||file?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:file?{'Content-Type':file.type||'application/octet-stream'}:body!==undefined?{'Content-Type':'application/json'}:{},body:file|| (body===undefined?undefined:JSON.stringify(body)),signal:c.signal});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(d.error||'Əməliyyat tamamlanmadı. Yenidən cəhd edin.'),{status:r.status,code:d.code});return d;}catch(e){if(e.name==='AbortError')throw Object.assign(Error('Cavab gecikdi. Eyni əməliyyatı yenidən sınayın.'),{status:504});throw e;}finally{clearTimeout(t);requests.delete(c);}}
async function run(fn){if(working)return;working=true;error.textContent='';app.setAttribute('aria-busy','true');try{await fn();}catch(e){if(!closed)error.textContent=e.message;}finally{working=false;app.removeAttribute('aria-busy');}}
function card(title){const n=el('section',null,'shop-card');if(title)n.append(el('h2',title));return n;}
function login(){const n=card('Balansı artırmaq üçün daxil olun və ya qeydiyyatdan keçin'),back=backFromWallet(),destination=back==='/odenis?mode=wallet'?'/balans?returnTo=%2Fodenis%3Fmode%3Dwallet':'/balans',next=encodeURIComponent(destination),actions=el('div',null,'shop-actions');actions.append(link('Daxil ol','/hesab?next='+next),link('Qeydiyyatdan keç','/hesab?mode=signup&next='+next));n.append(actions);if(back)n.append(link('← Alışa qayıt',back));app.replaceChildren(el('h1','Balansım'),n,error);}
function refreshAccount(){window.refreshCommunityNav?.();}
async function checkoutLogin(){const box=card('Hesabına daxil ol');box.append(el('p','Sifariş vermək üçün hesab lazımdır. Qeydiyyat pulsuzdur.'),link('Giriş et','/hesab?next=%2Fodenis'),link('Qeydiyyat','/hesab?mode=signup&next=%2Fodenis'));app.replaceChildren(box,error);await import('/account-header.js?v=account-update-20261107');if(!closed)window.MirpanelRequireLogin?.('/odenis');}
function product(x,quantity,controls=false){const n=card(),row=el('div',null,'shop-product'),img=el('img');img.src=x.image||'/favicon.ico';img.alt=x.title;const info=el('div');info.append(el('h2',x.title),el('p',x.planName||x.plan_name,'shop-muted'),el('strong',money(x.unitCents??x.unit_cents),'shop-price'));row.append(img,info);if(controls){for(const field of x.maskedDetails||[])info.append(el('small',field.label+': '+field.value));if(x.draftId)info.append(button('Məlumatları redaktə et',()=>void import('/community-assets/cart-entry.js?v=checkout-sounds-20261108').then(m=>m.editCartLine(x)).catch(e=>{error.textContent=e.message;})));const counts=el('div',null,'shop-quantity');for(const delta of [-1,1]){const b=button(delta===-1?'−':'+',()=>run(async()=>{cart.set(x.productId,x.planIndex,quantity+delta,undefined,undefined,x.lineId);await refreshBasket();}));b.disabled=delta===-1?quantity<=1:quantity>=20||x.available!=null&&quantity>=x.available;b.setAttribute('aria-label',(delta===-1?'Azalt: ':'Artır: ')+x.title);counts.append(b);if(delta===-1)counts.append(el('span',String(quantity)));}row.append(counts);const remove=button('Sil',()=>run(async()=>{cart.set(x.productId,x.planIndex,0,undefined,undefined,x.lineId);await refreshBasket();}));remove.setAttribute('aria-label','Sil: '+x.title);info.append(remove);}else info.append(el('small',quantity+' ədəd'));n.append(row);return n;}
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
  const {getCommunityState,invalidateCommunityState}=await import('/session-state.js?v=avatar-20261104');invalidateCommunityState();
  const s=await getCommunityState();profile=s.ok?s.data.profile:null;if(!profile){await checkoutLogin();return;}
  checkoutView=true;if(route==='/sebet')history.replaceState(history.state,'','/sebet?checkout=1');
  await payment();if(matchMedia('(max-width:760px)').matches)app.querySelector('.checkout-choices')?.scrollIntoView({block:'start'});
 }),true);
 sum.append(row,next);sum.classList.add('checkout-choices');checkoutLayout(q,sum);
}
function topupLink(returnTo){const a=link('Balansı artır','/balans?returnTo='+encodeURIComponent(returnTo));a.classList.add('shop-primary','shop-return');return a;}
function backFromWallet(){const value=new URLSearchParams(location.search).get('returnTo')||'';return /^\/(?:mehsul(?:\/[a-z0-9-]+\/?)?|odenis\?mode=wallet|sebet)?$/.test(value)?value:'';}
async function getMethods(){methodLoadError='';const c=new AbortController();requests.add(c);const timeout=setTimeout(()=>c.abort(),20000);try{const r=await fetch('/api/payments/methods',{credentials:'same-origin',cache:'no-store',signal:c.signal}),d=await r.json();if(!r.ok)throw Error(d.error||'Ödəniş kartları yüklənmədi.');if(closed)return;allMethods=d.methods||[];methods=allMethods.filter(m=>m.available);if(!methods.some(m=>m.id===methodId))methodId=methods[0]?.id||'';}finally{clearTimeout(timeout);requests.delete(c);}}
function upload(kind,id,onSaved,already=false,onBusy=()=>{}){const label=el('section',null,'wallet-receipt order-receipt'),input=el('input'),pick=button('Qalereyadan çek seç',()=>{if(!working)input.click();},true),info=el('p',already?'Çek uğurla yükləndi':'',already?'shop-success':'shop-muted');input.type='file';input.accept='image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf';input.hidden=true;input.setAttribute('aria-label','Çek faylı');info.setAttribute('role','status');label.append(pick,input,el('p','JPG/JPEG, PNG və PDF · maksimum 5 MB','shop-muted'),info);input.onchange=()=>{const file=input.files[0];if(input.disabled||working||!file)return;onSaved(false);const version=++epoch;if(file.size>5242880){info.textContent='Fayl maksimum 5 MB ola bilər.';return;}input.disabled=pick.disabled=true;onBusy(true);info.className='shop-muted';info.textContent='Çek yüklənir…';const slow=setTimeout(()=>{if(version===epoch)info.textContent='Yükləmə davam edir, zəhmət olmasa gözləyin';},4000);void(async()=>{try{let r;for(let attempt=0;attempt<3;attempt++){try{r=await api('/receipt?kind='+kind+'&id='+id,undefined,{file,timeout:105000});break;}catch(e){if(attempt===2||e.status<500&&e.status!==429)throw e;await new Promise(r=>setTimeout(r,500*(attempt+1)));}}if(!r?.receiptUploaded)throw Error('Saxlanma təsdiqlənmədi.');if(!closed&&version===epoch){info.textContent='Çek uğurla yükləndi';info.className='shop-success';onSaved(true);}}catch(e){if(!closed&&version===epoch){info.textContent=e.message+' Faylı yenidən seçərək cəhd edin.';info.className='shop-error';}}finally{clearTimeout(slow);input.disabled=pick.disabled=false;onBusy(false);}})();};return label;}
const pendingKey='mirpanel.cart.checkout.v1';
function savedCheckout(){try{return JSON.parse(localStorage.getItem(pendingKey)||'null');}catch{return null;}}
async function requestKey(items,mode,methodId){const bytes=new TextEncoder().encode(JSON.stringify({items,mode,methodId})),digest=await crypto.subtle.digest('SHA-256',bytes),input=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),old=savedCheckout();if(old?.input===input)return old;const value={input,requestId:crypto.randomUUID()};localStorage.setItem(pendingKey,JSON.stringify(value));return value;}
const checkoutMoney=c=>money(c).replace('.',',');
function checkoutIcon(path){const span=el('span',null,'checkout-icon');span.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';return span;}
const cardIcon=()=>checkoutIcon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-14 5h4"/>'),walletIcon=()=>checkoutIcon('<path d="M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h12a2 2 0 0 0 2-2v-2M3 8h15"/><rect x="13" y="9" width="9" height="7" rx="2"/>');
async function payment(selectCard=false){
 const completed=new URLSearchParams(location.search).get('completed');if(/^[0-9a-f-]{36}$/i.test(completed||'')){try{group=await api('/checkout?id='+encodeURIComponent(completed));if(group.state==='submitted'){await paymentGroup(false);return;}}catch(e){if(e.status!==404)throw e;}}
 const pending=savedCheckout();if(pending?.id){try{group=await api('/checkout?id='+pending.id);if(group.state==='reserved'||group.state==='submitted'){if(group.state==='reserved'&&!profile){await checkoutLogin();return;}await paymentGroup();return;}error.textContent='Əvvəlki rezervin vaxtı bitib. Səbətiniz qorunub; kartı yenidən seçin.';group=null;}catch(e){if(e.status!==404)throw e;}localStorage.removeItem(pendingKey);}
 if(!profile){await checkoutLogin();return;}
 const items=cart.checkout();if(!items.length){await basket();return;}
 viewCartKey=JSON.stringify(items);
 const [q]=await Promise.all([api('/quote',{items}),getMethods().catch(e=>{methods=[];methodLoadError=e.message;})]);if(closed)return;
 const quoteKey=JSON.stringify([items,q.totalCents]);if(consentQuote!==quoteKey){consentAccepted=false;consentQuote=quoteKey;}paymentReady=true;
 const choices=card('Ödəniş');choices.classList.add('checkout-choices');const amount=el('p',null,'checkout-amount');amount.append(el('span','Cəmi'),el('strong',checkoutMoney(q.totalCents)));choices.append(amount);
 const options=el('fieldset',null,'checkout-methods');options.append(el('legend','Ödəniş üsulu'));const radios={};
 for(const [value,title,sub,icon] of [['card','Kartdan karta köçürmə','Bank kartı',cardIcon],['wallet','Balans',q.balanceCents==null?'Daxil olun':checkoutMoney(q.balanceCents),walletIcon]]){const tile=el('label',null,'checkout-tile'),r=el('input');r.type='radio';r.name='paymentMode';r.value=value;radios[value]=r;r.onchange=()=>{mode=value;updateChoice();};tile.append(r,icon(),el('strong',title),el('small',sub),el('span','✓','checkout-check'));options.append(tile);}
 choices.append(options);const walletStatus=el('div',null,'checkout-warning');choices.append(walletStatus);
 if(!methods.length)choices.append(el('p',methodLoadError||(allMethods.length?'Kartların hazırda boş ödəniş limiti yoxdur. Bir qədər sonra yenidən yoxlayın.':'Hazırda aktiv ödəniş kartı yoxdur.'),'shop-muted'),button('Kartları yenidən yoxla',()=>void run(()=>payment(true))));
 const stockOk=q.items.every(x=>x.available==null||x.available>=x.quantity);if(!stockOk)choices.append(el('p','Səbətdəki bəzi məhsullar seçdiyiniz sayda stokda yoxdur.','shop-error'),link('Səbətə qayıt','/sebet'));
 const detailsOk=q.items.every(x=>!x.detailsMissing);if(!detailsOk)choices.append(el('p','Sifariş məlumatları natamamdır. Paketi məhsul səhifəsində yenidən seçib məlumatları daxil edin.','shop-error'),link('Məhsullara bax','/mehsul'));
 const termsOk=q.items.every(x=>!x.termsMissing);if(!termsOk)choices.append(el('p','Məhsul və paket şərtlərini səbətə əlavə etməzdən əvvəl təsdiqləyin.','shop-error'),link('Məhsullara qayıt','/mehsul'));
 const consent=el('label',null,'shop-consent checkout-consent'),accept=el('input'),legal=el('span');accept.type='checkbox';accept.checked=consentAccepted;
 const legalLink=(title,id)=>{const a=link(title,'/sertler#sertler-'+id);a.target='_blank';a.rel='noopener';return a;};
 legal.append(legalLink('Ödəniş qaydalarını',4),', ',legalLink('geri qaytarma şərtlərini',6),' və ',legalLink('məsuliyyət hədlərini',8),' oxudum və qəbul edirəm.');
 consent.append(accept,legal);choices.append(consent);accept.onchange=()=>{consentAccepted=accept.checked;updateChoice();};
 const go=button('Sifarişi tamamla',()=>{if(go.disabled||!consentAccepted||!paymentReady)return;if(mode==='card'){void bankSelection();return;}void run(()=>submit('wallet',''));},true);choices.append(go);
 const short=q.balanceCents==null?0:Math.max(0,q.totalCents-q.balanceCents);
 function updateChoice(){const wallet=mode==='wallet';radios[mode].checked=true;walletStatus.replaceChildren();walletStatus.hidden=!wallet||(!short&&q.balanceCents!=null);
 if(wallet&&short)walletStatus.append(el('strong','Balans kifayət etmir'),el('p',checkoutMoney(q.balanceCents)+' var, '+checkoutMoney(short)+' çatmır.'),topupLink('/odenis?mode=wallet'));
 else if(wallet&&q.balanceCents==null)walletStatus.append(el('p','Balansla ödəniş üçün hesabınıza daxil olun.'),topupLink('/odenis?mode=wallet'));
 go.disabled=!paymentReady||!consentAccepted||!stockOk||!detailsOk||!termsOk||(wallet?(q.balanceCents==null||short>0):!methods.length);go.replaceChildren();if(go.disabled)go.append(checkoutIcon('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>'));go.append(document.createTextNode('Sifarişi tamamla · '+checkoutMoney(q.totalCents)));
 }
 async function submit(selected,id){if(!consentAccepted||!paymentReady||JSON.stringify(cart.checkout())!==JSON.stringify(items))return refreshBasket();try{const key=await requestKey(items,selected,id);group=await api('/checkout',{items,mode:selected,methodId:id,requestId:key.requestId,consentAccepted,expectedTotalCents:q.totalCents});localStorage.setItem(pendingKey,JSON.stringify({...key,id:group.id}));await paymentGroup();if(group.orderCreated===true&&group.paymentConfirmed===true&&group.orderCode)void playCheckoutSound('order',group.orderCode);}catch(e){if(e.status===409)await payment(true);throw e;}}
 async function bankSelection(){if(!termsOk||!methods.length)return;const panel=card('Bank kartını seçin'),grid=el('div',null,'wallet-bank-grid');panel.classList.add('checkout-choices');let picked='';const next=button('Bu kartla davam et · '+checkoutMoney(q.totalCents),()=>run(async()=>{if(!picked)return;next.disabled=true;try{await submit('card',picked);}finally{next.disabled=!picked;}}),true);next.disabled=true;
 drawBankChoices({el,button,grid,methods,onSelect:id=>{picked=id;next.disabled=false;}});
 panel.append(grid,next,button('← Ödəniş üsuluna qayıt',()=>checkoutLayout(q,choices)));checkoutLayout(q,panel);}
 updateChoice();checkoutLayout(q,choices);if(selectCard&&consentAccepted&&stockOk&&detailsOk&&termsOk)await bankSelection();
}
async function paymentGroup(clearCart=true){
 clearTimeout(confirmationTimer);
 const rejected=group.items.some(x=>['rejected','expired','cancelled'].includes(x.status));
 const summary=card(group.state==='submitted'?(group.paymentConfirmed?'Ödəniş təsdiqləndi':'Sifariş qəbul edildi'):'Ödənişi tamamlayın');
 summary.append(el('p','Cəmi: '+money(group.totalCents)));if(group.orderCode)summary.append(el('strong','Sifariş № '+group.orderCode));
 if(group.state==='submitted'){
  if(clearCart){cart.clear();localStorage.removeItem(pendingKey);history.replaceState(history.state,'','/odenis?completed='+encodeURIComponent(group.id));}
  const actions=el('div',null,'shop-actions');
  actions.append(link('Sifarişlərimə bax',group.orderCode?'/profil?tab=orders&order='+encodeURIComponent(group.orderCode):'/profil?tab=orders'),link('Məhsullara bax','/mehsul'),link('Ana səhifə','/'));
  summary.append(el('p',group.paymentConfirmed?'Ödəniş təsdiqləndi. Təhvil vəziyyətini sifarişinizdə izləyin.':rejected?'Ödəniş təsdiqlənmədi. Faktiki statusu sifarişinizdə yoxlayın.':'Ödəniş yoxlanılır. Bu, çatdırılma təsdiqi deyil.',group.paymentConfirmed?'shop-success':'shop-muted'),actions);
  app.replaceChildren(el('h1','Sifarişiniz'),summary,...group.items.map(x=>product(x,x.quantity||1)),error);refreshAccount();
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
 const reserved=group;let method;
 try{method=await api('/method?id='+encodeURIComponent(reserved.methodId)+'&checkout='+encodeURIComponent(reserved.id));}
 catch(e){if(closed)return;
  if(e.code==='CART_RESERVATION_EXPIRED'){localStorage.removeItem(pendingKey);group=null;await payment(true);error.textContent=e.message;return;}
  const recovery=card('Ödəniş kartını yenidən seçin');recovery.append(el('p',e.message,'shop-error'),el('p','Səbətiniz və yazdığınız sifariş məlumatları qorunub.','shop-muted'));
  recovery.append(button('Yenidən yoxla',()=>void run(()=>paymentGroup(false))));
  if(e.status===409||e.status===404)recovery.append(button('Başqa kart seç',()=>void run(async()=>{
   if(reserved.receiptUploaded&&!confirm('Çekiniz bu karta bağlıdır. Kartı dəyişsəniz yeni rezerv yaradılacaq və çek yenidən yüklənməlidir. Davam edək?'))return;
   await api('/cancel',{id:reserved.id});localStorage.removeItem(pendingKey);group=null;await payment(true);
  }),true));
  app.replaceChildren(recovery,error);return;
 }if(closed)return;
 let receiptReady=reserved.receiptUploaded;
 const actions=el('div',null,'shop-actions');
 async function release(changeCard){if(receiptReady&&!confirm('Kartı dəyişmək və ya sifarişi ləğv etmək cari rezervi bitirəcək. Yeni kart üçün çek yenidən yüklənməlidir. Davam edək?'))return;await run(async()=>{const result=await api('/cancel',{id:reserved.id});if(!changeCard&&result.cancellationApplied===true)void playCheckoutSound('remove','cancel:'+reserved.id);localStorage.removeItem(pendingKey);group=null;await payment(changeCard);});}
 const {panel,change}=orderBankDetail({el,button,method,amount:checkoutMoney(reserved.totalCents),onChange:()=>void release(true),onCopy:async(number,copy)=>{try{await navigator.clipboard.writeText(number);copy.textContent='Kopyalandı';}catch{error.textContent='Kopyalama mümkün olmadı. Kart nömrəsini seçib kopyalayın.';}}});
 const steps=el('section',null,'wallet-topup-steps order-transfer-steps'),list=el('ol');steps.append(el('h3','Addımlar'),list);
 for(const step of ['Yuxarıdakı kart nömrəsini kopyalayın.','Göstərilən məbləği həmin karta köçürün.','“Qalereyadan çek seç” düyməsinə basın.','Ödəniş çekini seçib yükləyin.','“Davam et” düyməsinə basın. Sayt sizi WhatsApp-a yönləndirəcək. Ödəniş yoxlandıqdan sonra sifarişiniz təhvil veriləcək.'])list.append(el('li',step));
 const next=button('Davam et',()=>run(async()=>{if(!receiptReady)return;next.disabled=cancel.disabled=change.disabled=true;try{group=await api('/submit',{id:reserved.id});await paymentGroup();}catch(e){if(e.status===409){await payment();error.textContent=e.message;}else throw e;}finally{next.disabled=!receiptReady;cancel.disabled=change.disabled=false;}}),true);
 next.disabled=!receiptReady;
 const cancel=button('Ləğv et',()=>void release(false));actions.append(cancel,next);
 const heading=el('h1','Ödənişi tamamlayın'),expiry=el('p','Rezerv: '+new Date(reserved.expiresAt).toLocaleTimeString('az-AZ',{hour:'2-digit',minute:'2-digit'})+'-dək aktivdir.','shop-muted order-transfer-expiry');
 const box=upload('cart',reserved.id,saved=>{receiptReady=saved;next.disabled=!saved;},receiptReady,busy=>{change.disabled=cancel.disabled=busy;});
 const stage=el('section',null,'order-transfer-stage');stage.append(heading,panel,expiry,steps,box,actions);
 app.replaceChildren(stage,status,error);
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
 flow=createWalletTopup({el,button,api,run,money,methods,profile,getCents:effective,signal:life.signal,isClosed:()=>closed,onBusy:b=>{amount.disabled=b;for(const p of presets.children)p.disabled=b;},restoreCents:c=>{selectedCents=[500,1000,2000,5000].includes(c)?c:null;amount.value=selectedCents===null?topupAmountText(c):'';for(const p of presets.children)p.setAttribute('aria-pressed',String(Number(p.textContent.split(' ')[0])*100===selectedCents));update();},onComplete:async()=>{status.textContent='Müraciətiniz göndərildi, operator təsdiqi gözlənilir';await wallet();}});form.append(flow.element);update();
 const history=card('Əməliyyat tarixçəsi');history.classList.add('shop-history');history.id='emeliyyatlar';for(const x of data.items){const row=el('article');row.append(el('strong',(Number(x.cents)>0?'+':'')+money(x.cents)),el('p',x.reason,'shop-muted'),el('small',new Date(x.created_at).toLocaleString('az-AZ',{timeZone:'Asia/Baku'})));history.append(row);}if(data.more)historyMore(history,1);if(!data.items.length)history.append(el('p','Hələ əməliyyat yoxdur.','shop-muted'));const requests=card('Balans müraciətləri');for(const x of data.topups.filter(x=>x.status!=='draft'))requests.append(el('p',money(x.requested_cents)+' · '+({reviewing:'Yoxlanılır',approved:'Təsdiqləndi',rejected:'Rədd edildi'}[x.status]||x.status)));if(!data.topups.some(x=>x.status!=='draft'))requests.append(el('p','Hələ müraciət yoxdur.','shop-muted'));const back=backFromWallet();if(back){const a=link('← Alışa qayıt',back);a.classList.add('shop-return');form.prepend(a);}requests.append(link('Sifarişlərimdə bax','/sifarislerim'));app.replaceChildren(el('h1','Balansım'),hero,form,status,requests,history,error);void flow.resume();}
async function start(){app.replaceChildren(el('p','Yüklənir…'));if(route==='/sebet'&&!checkoutView){await basket();return;}if(route==='/balans'){walletPrefetched=api('/wallet');void walletPrefetched.catch(()=>{});}const {getCommunityState,invalidateCommunityState}=await import('/session-state.js?v=avatar-20261104');if(checkoutView)invalidateCommunityState();const [s]=await Promise.all([getCommunityState(),route==='/balans'?getMethods():Promise.resolve()]);if(closed)return;if(s.ok){profile=s.data.profile;if(checkoutView){window.mirpanelAccountProfile=profile||null;window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:profile||null}));}}await(checkoutView?payment():wallet());if(location.hash==='#emeliyyatlar')document.getElementById('emeliyyatlar')?.scrollIntoView();}
const dispose=()=>{closed=true;epoch++;clearInterval(timer);clearTimeout(confirmationTimer);for(const r of requests)r.abort();life.abort();document.body.classList.remove('wallet-page-active');};
on(window,'pagehide',dispose);on(window,'mirpanel:account',e=>{if(profile&&!e.detail&&route==='/balans'){document.body.classList.remove('wallet-topup-active');login();}const signedOut=!!profile&&!e.detail;profile=e.detail;if(signedOut&&checkoutView&&group?.state!=='submitted')void checkoutLogin();});
on(window,'mirpanel:before-navigate',e=>{if(working||app.querySelector('input[type=file]')?.files.length){e.preventDefault();status.textContent='Əvvəl aktiv əməliyyatı tamamlayın və ya ləğv edin. Seçilmiş fayl qorunub.';}});
const boot=()=>{walletPrefetched=null;return start().catch(e=>{if(closed)return;app.replaceChildren(el('h1','Yükləmə alınmadı'),error,button('Yenidən cəhd et',boot));error.textContent=e.message;});};void boot();
function historyMore(history,page){const more=button('Daha çox göstər',()=>run(async()=>{more.disabled=true;try{const d=await api('/wallet?page='+(page+1));more.remove();for(const x of d.items){const row=el('article');row.append(el('strong',(Number(x.cents)>0?'+':'')+money(x.cents)),el('p',x.reason,'shop-muted'),el('small',new Date(x.created_at).toLocaleString('az-AZ',{timeZone:'Asia/Baku'})));history.append(row);}if(d.more)historyMore(history,page+1);}finally{more.disabled=false;}}));history.append(more);}
window.mirpanelPageDispose=dispose;return dispose;
}
if(!new URL(import.meta.url).searchParams.get('v')?.startsWith('shell-')&&!window.mirpanelNavigationMounting&&document.getElementById('shopApp'))mountShop();
