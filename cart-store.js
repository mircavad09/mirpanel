(()=>{'use strict';const previous=window.MirpanelCart;if(previous?.apiVersion>=7&&typeof previous.commitDraft==='function'&&typeof previous.checkout==='function')return;const key='mirpanel.cart.v1',tokenId='mirpanel-token';
 const isToken=x=>x.productId===tokenId;
 const validToken=n=>Number.isInteger(n)&&n>=50&&n<=5000;
 const audio=import('/checkout-sounds.js?v=1').catch(()=>null);
 const sound=(kind,id)=>void audio.then(m=>m?.playCheckoutSound(kind,id));
 const sources=x=>[...new Set([x.draftId,...(x.draftIds||[])].filter(v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v)))];
 const clean=x=>({productId:x.productId,planIndex:x.planIndex,quantity:x.quantity,...(isToken(x)&&validToken(x.tokenCount)?{tokenCount:x.tokenCount}:{}),...(x.draftId?{draftId:x.draftId,lineId:x.lineId||x.draftId,draftIds:sources(x)}:{}),...(x.termsVersion?{termsVersion:x.termsVersion}:{}),...(/^[a-f0-9]{64}$/.test(x.mergeKey||'')?{mergeKey:x.mergeKey}:{})});
 const read=()=>{try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.filter(x=>typeof x.productId==='string'&&Number.isInteger(x.planIndex)&&x.planIndex>=0&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=20&&(!isToken(x)||x.planIndex===0&&x.quantity===1&&validToken(x.tokenCount))).slice(0,20).map(clean):[];}catch{return[];}};
 function save(items){localStorage.setItem(key,JSON.stringify(items.map(clean)));window.dispatchEvent(new Event('mirpanel:cart'));}
 const line=(id,idx)=>JSON.stringify([id,idx]);
 sessionStorage.removeItem('mirpanel.cart.details.v1');
 const draftPost=(path,body)=>fetch('/api/payments/shop/'+path,{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Qaralama yenilənmədi.');return r.json();});
 const removedKey='mirpanel.cart.removed.v2';
 const removed=()=>{try{return JSON.parse(localStorage.getItem(removedKey)||'[]');}catch{return[];}};
 function retire(ids,onRemoved){localStorage.setItem(removedKey,JSON.stringify([...new Set([...removed(),...ids])].slice(-200)));const requests=[];for(let i=0;i<ids.length;i+=40)requests.push(draftPost('draft/remove',{ids:ids.slice(i,i+40)}));void Promise.all(requests).then(results=>{if(results.every(r=>r.removed===true))onRemoved?.();}).catch(()=>{});}
 function combine(a,x,matches=[]){
  if(isToken(x))return [...a.filter(n=>!isToken(n)),x];
  const known=x.draftId&&a.find(n=>sources(n).includes(x.draftId));if(known)return a;
  const same=n=>n.productId===x.productId&&n.planIndex===x.planIndex&&n.termsVersion===x.termsVersion&&(x.mergeKey&&n.mergeKey===x.mergeKey||sources(n).some(id=>matches.includes(id)));
  const peers=a.filter(same),quantity=peers.reduce((n,p)=>n+p.quantity,x.quantity);
  if(quantity>20)throw Error('Say 1–20 aralığında olmalıdır.');
  if(!peers.length)return [...a,x];
  const first=peers[0],merged={...first,mergeKey:x.mergeKey,quantity,draftIds:[...new Set([...peers.flatMap(sources),...sources(x)])]};
  return a.flatMap(n=>n===first?[merged]:same(n)?[]:[n]);
 }
 const cart=Object.assign(previous||{},{apiVersion:7,read,checkout:read,
 addToken(tokenCount,termsVersion){
  if(!validToken(tokenCount)||!termsVersion)throw Error('Token sayını və şərtləri təsdiqləyin.');
  const rows=read().filter(x=>!isToken(x));
  if(rows.length>=20)throw Error('Səbətdə ən çox 20 məhsul sətri ola bilər.');
  save([...rows,{productId:tokenId,planIndex:0,quantity:1,tokenCount,termsVersion}]);
  showCartAdded();
 },
 clearPaid(tokenCount,tokenTermsVersion){
  const rows=read();
  const purchased=rows.filter(x=>tokenCount?isToken(x)&&x.tokenCount===tokenCount&&(!tokenTermsVersion||x.termsVersion===tokenTermsVersion):!isToken(x));
  retire(purchased.flatMap(sources));
  save(rows.filter(x=>!purchased.includes(x)));
 },
 commitDraft(d,meta){let a=read(),retired=[];const x=clean({...meta,...d}),added=!meta.edit&&x.draftId&&!a.some(n=>sources(n).includes(x.draftId))&&!removed().includes(x.draftId);if(meta.edit){const old=a.find(n=>n.lineId===x.lineId);if(old){retired=sources(old).filter(id=>id!==x.draftId);a=a.filter(n=>n!==old);}}a=combine(a,x,d.matchingDraftIds||[]);if(a.length>20||a.reduce((s,x)=>s+x.quantity,0)>40)throw Error('Səbət limiti: 20 sətir, 40 ədəd.');save(a);retire(retired);if(added){showCartAdded();sound('add',x.draftId);const b=document.getElementById('cartAddProduct')||document.getElementById('pp-order-btn');try{if(b)fly(b,{});}catch{}}},
 set(productId,planIndex,quantity,values,termsVersion,lineId){if(values&&Object.keys(values).length)throw Error('Məlumatları qorunan sifariş formasında daxil edin.');if(!Number.isInteger(quantity)||quantity<0||quantity>20)throw Error('Say 1–20 aralığında olmalıdır.');const a=read(),at=a.findIndex(x=>lineId?x.lineId===lineId:x.productId===productId&&x.planIndex===planIndex);if(at<0)throw Error('Məhsulu əvvəlcə sifariş formasında təsdiqləyin.');const row=a[at];if(quantity)row.quantity=quantity;else a.splice(at,1);if(a.reduce((s,x)=>s+x.quantity,0)>40)throw Error('Bir sifarişdə ən çox 40 ədəd.');save(a);if(!quantity){const ids=sources(row);retire(ids,()=>sound('remove',ids[0]||crypto.randomUUID()));}},
 add(){throw Error('Məhsulu əvvəlcə sifariş formasında təsdiqləyin.');},
 clear(){retire(read().flatMap(sources));save([]);}});window.MirpanelCart=cart;
 // A legacy tab already owns the drawer, badge listeners and observer. Upgrade
 // its public API in place, retaining references and installing no second UI.
 if(previous){window.dispatchEvent(new Event('mirpanel:cart'));return;}
 async function restore(){const before=JSON.stringify(read()),epoch=priceEpoch;try{const r=await fetch('/api/payments/shop/drafts',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const d=await r.json();if(epoch!==priceEpoch||JSON.stringify(read())!==before)return;const gone=new Set(removed()),fresh=new Map((d.items||[]).map(x=>[x.draftId,x]));let a=[];for(const old of read())a=combine(a,clean({...old,termsVersion:old.termsVersion||fresh.get(old.draftId)?.termsVersion,mergeKey:fresh.get(old.draftId)?.mergeKey||old.mergeKey}));for(const x of d.items||[])if(!gone.has(x.draftId)&&a.length<20)a=combine(a,clean(x));save(a);}catch{}}
 const azMoney=c=>(c/100).toFixed(2).replace('.',',')+' ₼';
 function node(tag,value,cls){const n=document.createElement(tag);if(value!=null)n.textContent=value;if(cls)n.className=cls;return n;}
 function action(label,fn,cls){const b=node('button',label,cls);b.type='button';b.onclick=fn;return b;}
 let addedNotice,addedTimer,addedAt;
 function dismissCartAdded(){clearTimeout(addedTimer);addedNotice?.remove();addedNotice=null;}
 function placeCartAdded(host){
  if(!addedNotice)return;
  addedNotice.style.setProperty('--mir-cart-added-elapsed',`${-Math.max(0,performance.now()-addedAt)}ms`);
  host.prepend(addedNotice);
 }
 function showCartAdded(){
  const previous=addedNotice,hadFocus=previous?.contains(document.activeElement);
  dismissCartAdded();
  const notice=node('div',null,'mir-cart-added'),status=node('span','Məhsul səbətə əlavə edildi'),close=action('×',()=>{
   const fallback=notice.closest('.mir-cart-drawer')?.querySelector('header button');
   dismissCartAdded();fallback?.focus({preventScroll:true});
  },'mir-cart-added-close');
  status.setAttribute('role','status');close.setAttribute('aria-label','Bildirişi bağla');
  const mark=node('span',null,'mir-cart-added-icon'),bar=node('span',null,'mir-cart-added-bar');
  mark.setAttribute('aria-hidden','true');bar.setAttribute('aria-hidden','true');
  mark.innerHTML='<svg viewBox="0 0 24 24" fill="none"><path pathLength="1" d="m5.5 12 4 4L18.5 7" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  notice.append(mark,status,close,bar);addedNotice=notice;addedAt=performance.now();
  placeCartAdded(document.querySelector('.mir-cart-drawer[open]')||document.body);
  if(hadFocus)close.focus({preventScroll:true});
  addedTimer=setTimeout(dismissCartAdded,5000);
 }
 const previewKey='mirpanel.cart.preview.v1';
 const catalog=()=>typeof DATA==='undefined'?[]:DATA.products||[];
 function catalogRow(p,idx){
  const plan=p?.plans?.[idx];if(!plan)return null;const cents=Math.round(Number(window.MirpanelPricing?.standard(plan)??plan.price)*100);
  return {title:p.title,planName:plan.label||plan.name||(plan.months?plan.months+' aylıq':'Paket'),image:p.image||'',unitCents:Number.isSafeInteger(cents)&&cents>0?cents:null};
 }
 let preview={};try{preview=JSON.parse(localStorage.getItem(previewKey)||'{}')||{};}catch{}
 function savePreview(next){preview=next;try{const json=JSON.stringify(next);if(localStorage.getItem(previewKey)!==json)localStorage.setItem(previewKey,json);}catch{}}
 let priceEpoch=0,quoteLife=new AbortController();
 window.addEventListener('mirpanel:prices',()=>{priceEpoch++;quoteLife.abort();quoteLife=new AbortController();seen.clear();pending.clear();window.dispatchEvent(new Event('mirpanel:cart'));prefetch();});
 window.addEventListener('pagehide',()=>{priceEpoch++;quoteLife.abort();pending.clear();});
 window.addEventListener('pageshow',()=>{if(quoteLife.signal.aborted)quoteLife=new AbortController();});
 const seen=new Map(),pending=new Map(),itemKey=x=>x.lineId||line(x.productId,x.planIndex);
 function remember(items){
  const products=catalog();if(!products.length)return;
  const next={};for(const x of items){const k=itemKey(x),p=products.find(p=>p.id===x.productId);const display=isToken(x)?tokenRow(x):catalogRow(p,x.planIndex),row=display?{...preview[k],...display}:preview[k];if(row)next[k]=row;}
  savePreview(next);
 }
 const tokenRow=x=>({...x,title:'Mirpanel Token',planName:x.tokenCount+' token',image:'/assets/tokens/mirpanel-token.webp',unitCents:x.tokenCount*2,termsMissing:!x.termsVersion});
 function verify(items){
  const token=items.find(isToken);
  if(token){
   const rest=items.filter(x=>!isToken(x));
   const tokenLine=tokenRow(token);
   return rest.length?verify(rest).then(q=>({...q,items:[...q.items,tokenLine],totalCents:q.totalCents+tokenLine.unitCents})):
    Promise.resolve({items:[tokenLine],totalCents:tokenLine.unitCents});
  }
  const key=JSON.stringify(items);if(pending.has(key))return pending.get(key);
  const generation=priceEpoch;const request=(async()=>{
   const {withRequestSignal}=await import('/request-lifecycle.mjs?v=abort-compat-1');
   const q=await withRequestSignal([quoteLife.signal],12000,async signal=>{
   const res=await fetch('/api/payments/shop/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items}),signal,cache:'no-store'});
   const data=await res.json();if(!res.ok||!Array.isArray(data.items)||!Number.isSafeInteger(data.totalCents))throw Error('Qiymət və stoku yoxlamaq mümkün olmadı.');return data;
   });
   if(generation!==priceEpoch)throw Error('Account changed.');
   for(const x of q.items){const k=itemKey(x);if(seen.size>=60)seen.delete(seen.keys().next().value);seen.set(k,x);}
   if(JSON.stringify(read())===key){const next={};for(const x of q.items){const k=itemKey(x);next[k]={title:x.title,planName:x.planName,image:x.image,available:x.available,salesDisabled:x.salesDisabled,unitCents:Number.isSafeInteger(x.standardCents)?x.standardCents:preview[k]?.unitCents??null};}savePreview(next);}
   return q;
  })().finally(()=>{if(pending.get(key)===request)pending.delete(key);});pending.set(key,request);return request;
 }
 function previewRows(items){
  return items.map(item=>{
   if(isToken(item))return tokenRow(item);
   const key=itemKey(item),product=catalog().find(p=>p.id===item.productId);
   const stock=product&&window.MirpanelInventory?.productState?.(product);
   const plan=stock&&!stock.unavailable?stock.plans?.[item.planIndex]:null;
   const cached=seen.get(key)||preview[key]||catalogRow(product,item.planIndex)||{};
   const available=cached.available!==undefined?cached.available:plan?.available;
   const salesDisabled=product?.active===false||product?.plans?.[item.planIndex]?.active===false||
    (stock&&!stock.unavailable?stock.salesDisabled:cached.salesDisabled??product?.soldOut===true);
   return {...cached,...item,title:cached.title||product?.title||item.productId,available:salesDisabled?0:available,salesDisabled,
    termsMissing:cached.termsMissing??(!item.termsVersion&&!item.draftId)};
  });
 }
 cart.previewRows=previewRows;
 function prefetch(){const items=read();remember(items);if(items.length)void verify(items).catch(()=>{});}
 const svg=path=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
 const trash=svg('<path d="M4 7h16m-14 0 1 13h10l1-13M9 7V4h6v3m-5 3v6m4-6v6"/>'),arrow=svg('<path d="M5 12h14m-6-6 6 6-6 6"/>');
 function artwork(image){
  const tile=node('span',null,'mir-cart-artwork');
  tile.setAttribute('aria-hidden','true');
  tile.innerHTML=svg('<path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>');
  if(typeof image!=='string'||!image.trim())return tile;
  let url;
  try{url=new URL(image,location.origin+'/');}catch{return tile;}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return tile;
  const img=node('img');img.alt='';img.hidden=true;
  img.addEventListener('load',()=>{img.hidden=false;tile.firstElementChild.remove();},{once:true});
  img.addEventListener('error',()=>img.remove(),{once:true});
  tile.append(img);img.src=url.href;
  return tile;
 }
 let drawer;
 const isCartPage=()=>location.pathname==='/sebet';
 cart.open=({inline=false}={})=>{
  if(!inline&&!isCartPage()){location.assign('/sebet');return;}
  mountDrawer();
 };
 function cartDestination(){
  try{
   const previous=new URL(document.referrer);
   if(previous.origin===location.origin&&(/^\/mehsul(?:\/[a-z0-9-]+)?\/?$/.test(previous.pathname)||['/','/profil','/sifarislerim','/qrup','/balans'].includes(previous.pathname)))return previous.pathname+previous.search;
  }catch{}
  return '/mehsul';
 }
 function mountDrawer(){
  if(drawer?.open)return;
  const loading=document.querySelector('[data-cart-loading]');
  const d=node('dialog',null,'mir-cart-drawer');drawer=d;d.setAttribute('aria-label','Səbət');
  const heading=node('header'),title=node('strong','Səbət'),badge=node('span',null,'mir-cart-heading'),close=action('×',()=>d.close());
  badge.innerHTML=icon;badge.append(title);close.setAttribute('aria-label','Səbəti bağla');close.autofocus=true;heading.append(badge,close);
  const body=node('div',null,'mir-cart-body'),foot=node('footer'),life=new AbortController(),notice=node('p',null,'mir-cart-notice'),total=node('strong','—'),sum=node('div',null,'mir-cart-sum'),next=action('Ödənişə keç',()=>location.assign(tokenPresent?'/odenis?mode=wallet&token=1':requiresLogin?'/hesab?next=%2Fsebet&from=cart':'/odenis'),'mir-cart-next'),other=action('Digər məhsullar üçün ödənişə keç',()=>location.assign('/odenis'),'mir-cart-retry'),retry=action('Yenidən yoxla',()=>void draw(),'mir-cart-retry');
  const nextArrow=node('span',null,'mir-cart-arrow');nextArrow.innerHTML=arrow;next.append(nextArrow);
  notice.setAttribute('role','status');sum.append(node('span','Cəmi'),total);foot.append(notice,retry,sum,next,other);d.append(heading,body,foot);
  let generation=0,requiresLogin=false,tokenPresent=false;other.hidden=true;
  let products=[];
  void fetch('/api/payments/storefront',{signal:life.signal})
   .then(response=>response.ok?response.json():null).then(data=>{
    if(!Array.isArray(data?.products)||life.signal.aborted)return;
    products=data.products.filter(p=>Number.isSafeInteger(p.priceCents)&&p.priceCents>0&&/^\/mehsul\/[a-z0-9-]+$/.test(p.path));
    const items=read();
    render(items,previewRows(items));
   }).catch(()=>{});
  d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
  d.addEventListener('close',()=>{life.abort();if(addedNotice?.parentElement===d)placeCartAdded(document.body);d.remove();if(drawer===d)drawer=null;if(isCartPage())location.replace(cartDestination());},{once:true});
  function render(items,quoted){
   const top=body.scrollTop,focus=document.activeElement?.dataset?.cartFocus;
   const rows=items.map(x=>{
    const p=quoted.find(y=>itemKey(y)===itemKey(x))||{},name=p.title||x.productId;
    const row=node('article',null,'mir-cart-item');row.dataset.cartProduct=x.productId;
    const product=catalog().find(product=>product.id===x.productId);
    const img=artwork(p.image||product?.image);
    const info=node('div',null,'mir-cart-info');info.append(node('strong',name),node('small',p.planName||'Seçilmiş paket'),node('b',p.unitCents==null?'—':azMoney(p.unitCents*x.quantity)));
    if(p.salesDisabled||p.available===0)info.append(node('small','Stokda yoxdur'));
    else if(p.available!=null&&p.available<x.quantity)info.append(node('small','Stokda '+p.available+' ədəd var.'));
    for(const field of p.maskedDetails||[])info.append(node('small',field.label+': '+field.value));
    if(x.draftId&&(p.termsMissing||p.fields?.length))info.append(action(p.termsMissing?'Şərtləri təsdiqlə':'Məlumatları redaktə et',()=>{
     void import('/community-assets/cart-entry.js?v=confirmation-toggle-1').then(m=>m.editCartLine(x)).catch(e=>{notice.textContent=e.message;});
    }));
    const controls=node('div',null,'mir-cart-controls'),qty=node('div',null,'mir-cart-qty'),change=n=>{try{cart.set(x.productId,x.planIndex,n,undefined,undefined,x.lineId);}catch(e){notice.textContent=e.message;}};
    const minus=action('−',()=>change(x.quantity-1)),plus=action('+',()=>change(x.quantity+1)),del=action('Sil',()=>change(0),'mir-cart-remove');del.insertAdjacentHTML('afterbegin',trash);
    for(const [b,label] of [[minus,'Azalt'],[plus,'Artır'],[del,'Sil']]){b.setAttribute('aria-label',label+': '+name);b.dataset.cartFocus=itemKey(x)+label;}
    minus.disabled=x.quantity<=1;plus.disabled=p.renewalOnly===true||x.quantity>=20||p.available!=null&&x.quantity>=p.available;
    if(!isToken(x)){qty.append(minus,node('span',x.quantity),plus);controls.append(qty);}controls.append(del);row.append(img,info,controls);return row;
   });
   const more=node('section',null,'mir-cart-more');more.append(node('p','Daha çox məhsul əlavə et'));
   const inCart=new Set(items.map(x=>x.productId));
   const category=products.find(p=>p.id===items.at(-1)?.productId)?.category;
   const related=products.filter(p=>!inCart.has(p.id))
    .sort((a,b)=>Number(b.category===category)-Number(a.category===category)).slice(0,3);
   for(const p of related){
    const row=node('article',null,'mir-cart-item mir-cart-suggestion'),img=artwork(p.image);
    const info=node('div',null,'mir-cart-info');
    const price=window.MirpanelPricing?.minimum(p.id,p.priceCents)??p.priceCents;
    info.append(node('strong',p.title),node('b',azMoney(price)+(p.from?'-dən başlayır':'')));
    const choose=node('a','+','mir-cart-offer');choose.href=p.path;
    choose.setAttribute('aria-label',p.title+' seç');row.append(img,info,choose);more.append(row);
   }
   if(more.children.length===1){const a=node('a','+ Məhsullara bax');a.href='/mehsul';more.append(a);}
   body.replaceChildren(...(rows.length?rows:[node('p','Səbətiniz boşdur.')]),more);body.scrollTop=top;
   if(focus)[...body.querySelectorAll('[data-cart-focus]')].find(n=>n.dataset.cartFocus===focus)?.focus({preventScroll:true});
  }
  async function draw(){
   const run=++generation,items=read();tokenPresent=items.some(isToken);other.hidden=true;remember(items);title.textContent='Səbət ('+items.reduce((s,x)=>s+x.quantity,0)+')';next.disabled=true;retry.hidden=true;
   const rows=previewRows(items),prices=rows.map(x=>[x.quantity,x.unitCents]);
   total.textContent=prices.every(([,c])=>Number.isSafeInteger(c))?azMoney(prices.reduce((s,[n,c])=>s+n*c,0)):'—';
   function show(rows){
    render(items,rows);
    const termsMissing=rows.some(x=>x.termsMissing),detailsMissing=rows.some(x=>x.detailsMissing);
    const short=rows.some(x=>x.salesDisabled||x.available!=null&&x.available<x.quantity);
    next.disabled=tokenPresent?rows.some(x=>isToken(x)&&x.termsMissing):!items.length||rows.length!==items.length||short||termsMissing||detailsMissing;
    other.hidden=!tokenPresent||!items.some(x=>!isToken(x));
    other.disabled=rows.some(x=>!isToken(x)&&(x.termsMissing||x.detailsMissing||x.salesDisabled||x.available!=null&&x.available<x.quantity));
    next.firstChild.textContent=other.hidden?'Ödənişə keç':'Token üçün ödənişə keç';
    notice.textContent=termsMissing?'Məhsulun şərtlərini yenidən təsdiqləyin.':detailsMissing?'Sifariş məlumatlarını tamamlayın.':'';
   }
   render(items,rows);
   notice.textContent=items.length?'Qiymət və stok yoxlanılır…':'';
   if(!items.length)return;
   try{
    const q=await verify(items);if(run!==generation||life.signal.aborted)return;
    requiresLogin=q.balanceCents===null;show(q.items);total.textContent=azMoney(q.totalCents);
   }catch{if(run===generation&&!life.signal.aborted){notice.textContent='Qiymət və stoku yoxlamaq mümkün olmadı.';retry.hidden=false;if(tokenPresent){next.firstChild.textContent='Token üçün ödənişə keç';next.disabled=false;}}}
  }
  window.addEventListener('mirpanel:cart',draw,{signal:life.signal});window.addEventListener('storage',e=>{if(e.key===key)void draw();},{signal:life.signal});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void draw();},{signal:life.signal});
  loading?.remove();document.body.append(d);placeCartAdded(d);void draw();d.showModal();
 }
 document.addEventListener('click',event=>{
  const quick=event.target.closest('[data-product-id="mirpanel-token"] :is(.homeCardAdd,.homeCardOrder)');
  if(!quick||!['/','/mehsul'].includes(location.pathname)||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();event.stopImmediatePropagation();
  void import('/community-assets/token-ui.js?v=token-cart-1').then(m=>m.confirmTokenPurchase(read().find(isToken)?.tokenCount??50,true)).catch(()=>location.assign('/mehsul/mirpanel-token'));
 },true);
 window.addEventListener('mirpanel:cart',()=>{if(!drawer?.open)prefetch();});
 window.addEventListener('mirpanel:route-ready',()=>remember(read()));
 let accountId;
 window.addEventListener('mirpanel:account',event=>{
  const nextId=event.detail?.user_id??event.detail?.id??null;
  if(accountId===nextId)return;
  accountId=nextId;priceEpoch++;quoteLife.abort();quoteLife=new AbortController();seen.clear();pending.clear();
  window.dispatchEvent(new Event('mirpanel:cart'));
  if(nextId)void restore();
 });
 window.addEventListener('pageshow',event=>{if(event.persisted){if(isCartPage())mountDrawer();window.dispatchEvent(new Event('mirpanel:cart'));}});
 prefetch();void restore();
 const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h2l3 13h11l3-9H6 M10 21h.01 M18 21h.01"/></svg>';
 function fly(b,p){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const target=[...document.querySelectorAll('#cartHeaderLink,[data-browser-nav=cart]')].find(n=>n.getClientRects().length),image=document.getElementById('pp-main-img')?.currentSrc||p.image;if(!target||!image||!b.animate)return;
  const a=b.getBoundingClientRect(),z=target.getBoundingClientRect(),n=document.createElement('img'),x=a.left+a.width/2-24,y=a.top+a.height/2-24;n.className='cart-flight';n.alt='';n.src=image;n.style.left=x+'px';n.style.top=y+'px';document.body.append(n);
  const motion=n.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${z.left+z.width/2-x-24}px,${z.top+z.height/2-y-24}px) scale(.28)`,opacity:.35}],{duration:550,easing:'cubic-bezier(.22,.65,.36,1)'});motion.finished.then(()=>n.remove(),()=>n.remove());
 }
 function mount(){const order=document.getElementById('pp-order-btn');if(order&&!document.getElementById('cartAddProduct')){const b=document.createElement('button'),about=order.parentElement.querySelector('.product-page-action.is-about'),label=document.createElement('span');b.id='cartAddProduct';b.type='button';b.disabled=order.disabled;b.className='cart-add-product'+(about?' product-page-action is-cart':'');b.innerHTML=icon;label.textContent=about?'Səbətə at':'Səbətə əlavə et';b.append(label);b.onclick=()=>{try{if(typeof currentProduct==='undefined'||!currentProduct||!Number.isInteger(currentPlanIdx))throw Error('Əvvəlcə məhsul və planı seçin.');if(order.disabled)throw Error('Seçilmiş paket hazırda stokda yoxdur.');cart.add(currentProduct.id,currentPlanIdx);fly(b,currentProduct);label.textContent='Əlavə edildi';clearTimeout(b.feedbackTimer);b.feedbackTimer=setTimeout(()=>label.textContent=about?'Səbətə at':'Səbətə əlavə et',1400);}catch(e){alert(e.message);}};if(about)about.replaceWith(b);else order.before(b);}
 const header=document.querySelector('.site-header-tools');if(header&&!document.getElementById('cartHeaderLink')){const a=document.createElement('a');a.id='cartHeaderLink';a.href='/sebet';a.className='cart-header-link';a.setAttribute('aria-label','Səbət');a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h2l3 13h11l3-9H6 M10 21h.01 M18 21h.01"/></svg><span>Səbət</span><small></small>';header.append(a);}const n=document.querySelector('#cartHeaderLink small'),count=read().reduce((s,x)=>s+x.quantity,0),text=count>99?'99+':count?String(count):'';if(n&&n.textContent!==text)n.textContent=text;const link=document.getElementById('cartHeaderLink');if(link)link.setAttribute('aria-label',count?'Səbət, '+count+' məhsul':'Səbət');}
 const css=document.createElement('link');css.rel='stylesheet';css.href='/cart-store.css?v=compact-cart-1';if(!document.querySelector('link[href="/cart-store.css?v=compact-cart-1"]'))document.head.append(css);new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});window.addEventListener('mirpanel:cart',mount);window.addEventListener('pagehide',dismissCartAdded);window.addEventListener('storage',e=>{if(e.key===key)mount();});mount();if(isCartPage())mountDrawer();
})();
