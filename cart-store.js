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
  if(read().some(x=>isToken(x)&&x.tokenCount===tokenCount&&x.termsVersion===termsVersion))return;
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
 set(productId,planIndex,quantity,values,termsVersion,lineId){if(values&&Object.keys(values).length)throw Error('Məlumatları qorunan sifariş formasında daxil edin.');if(!Number.isInteger(quantity)||quantity<0||quantity>20)throw Error('Say 1–20 aralığında olmalıdır.');const a=read(),at=a.findIndex(x=>lineId?x.lineId===lineId:x.productId===productId&&x.planIndex===planIndex);if(at<0)throw Error('Məhsulu əvvəlcə sifariş formasında təsdiqləyin.');const row=a[at];if(quantity===row.quantity)return;const stock=previewRows([row])[0];if(quantity>row.quantity&&(stock.salesDisabled||stock.available!=null&&quantity>stock.available))throw Error('Seçilmiş sayda stok yoxdur.');const quantityChanged=quantity>0;if(quantity)row.quantity=quantity;else a.splice(at,1);if(a.reduce((s,x)=>s+x.quantity,0)>40)throw Error('Bir sifarişdə ən çox 40 ədəd.');save(a);if(quantityChanged)showCartAdded('Miqdar yeniləndi');if(!quantity){const ids=sources(row);retire(ids,()=>sound('remove',ids[0]||crypto.randomUUID()));}},
 add(){throw Error('Məhsulu əvvəlcə sifariş formasında təsdiqləyin.');},
 clear(){retire(read().flatMap(sources));save([]);}});window.MirpanelCart=cart;
 // A legacy tab already owns the drawer, badge listeners and observer. Upgrade
 // its public API in place, retaining references and installing no second UI.
 if(previous){window.dispatchEvent(new Event('mirpanel:cart'));return;}
 async function restore(){const before=JSON.stringify(read()),epoch=priceEpoch;try{const r=await (window.MirpanelRecovery?.read||fetch)('/api/payments/shop/drafts',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const d=await r.json();if(epoch!==priceEpoch||JSON.stringify(read())!==before)return;const gone=new Set(removed()),fresh=new Map((d.items||[]).map(x=>[x.draftId,x]));let a=[];for(const old of read())a=combine(a,clean({...old,termsVersion:old.termsVersion||fresh.get(old.draftId)?.termsVersion,mergeKey:fresh.get(old.draftId)?.mergeKey||old.mergeKey}));for(const x of d.items||[])if(!gone.has(x.draftId)&&a.length<20)a=combine(a,clean(x));save(a);}catch{}}
 const azMoney=c=>(c/100).toFixed(2).replace('.',',')+' ₼';
 function node(tag,value,cls){const n=document.createElement(tag);if(value!=null)n.textContent=value;if(cls)n.className=cls;return n;}
 function action(label,fn,cls){const b=node('button',label,cls);b.type='button';b.onclick=fn;return b;}
 let addedStack,cartLayer,requestHud,loadingDelay;const activeQuotes=new Set(),addedNotices=new Map(),reduceNoticeMotion=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
 function dismissCartAdded(){for(const entry of [...addedNotices.values()]){clearTimeout(entry.timer);clearTimeout(entry.exitTimer);entry.row.remove();}addedNotices.clear();addedStack?.remove();addedStack=null;}
 function placeCartAdded(){
  if(!addedStack)return;
  // A sibling of the cart, inside the native modal's top layer (not its grid).
  const target=cartLayer?.open?cartLayer:document.body;
  if(addedStack.parentElement!==target){const bars=[...addedNotices.values()];target.prepend(addedStack);for(const entry of bars){const bar=entry.row.querySelector('.mir-cart-added-bar');bar.style.animation='none';bar.getBoundingClientRect();bar.style.animation='';bar.style.setProperty('--mir-cart-added-elapsed',-Math.max(0,performance.now()-entry.at)+'ms');}}
 }
 function placeRequestHud(){if(requestHud)(cartLayer?.open?cartLayer:document.body).append(requestHud);}
 function syncQuoteBusy(){
  const busy=activeQuotes.size>0;
  for(const d of document.querySelectorAll('.mir-cart-drawer')){d.classList.toggle('is-quote-busy',busy);d.setAttribute('aria-busy',String(busy));}
  if(!busy){clearTimeout(loadingDelay);loadingDelay=null;requestHud?.remove();requestHud=null;}
  else if(!loadingDelay&&!requestHud)loadingDelay=setTimeout(()=>{
   loadingDelay=null;if(!activeQuotes.size||!document.querySelector('.mir-cart-drawer[open]'))return;
   requestHud=node('div',null,'mir-cart-request-loading');requestHud.setAttribute('role','status');requestHud.setAttribute('aria-live','polite');
   const spinner=node('span',null,'mir-cart-request-spinner');spinner.setAttribute('aria-hidden','true');requestHud.append(spinner,node('span','Yüklənir…'));placeRequestHud();
  },350);
 }
 function closeCartNotice(entry){
  if(entry.closing||!addedNotices.has(entry.row))return;entry.closing=true;clearTimeout(entry.timer);
  const row=entry.row;row.style.height=row.getBoundingClientRect().height+'px';row.getBoundingClientRect();row.classList.add('is-leaving');
  const finish=()=>{if(!addedNotices.has(row))return;clearTimeout(entry.exitTimer);row.remove();addedNotices.delete(row);if(!addedNotices.size){addedStack?.remove();addedStack=null;}};
  entry.exitTimer=setTimeout(finish,reduceNoticeMotion()?0:240);
 }
 function showCartAdded(text='Məhsul səbətə əlavə edildi'){
  if(!addedStack){addedStack=node('div',null,'mir-cart-notices');addedStack.setAttribute('aria-label','Səbət bildirişləri');}
  const row=node('div',null,'mir-cart-notice-row'),notice=node('div',null,'mir-cart-added'),status=node('span',text),entry={row,at:performance.now(),timer:null,exitTimer:null,closing:false};
  const close=action('×',()=>closeCartNotice(entry),'mir-cart-added-close');close.setAttribute('aria-label','Bildirişi bağla');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
  const mark=node('span',null,'mir-cart-added-icon'),bar=node('span',null,'mir-cart-added-bar');mark.setAttribute('aria-hidden','true');bar.setAttribute('aria-hidden','true');
  mark.innerHTML='<svg viewBox="0 0 24 24" fill="none"><path pathLength="1" d="m5.5 12 4 4L18.5 7" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  notice.append(mark,status,close,bar);row.append(notice);addedStack.append(row);addedNotices.set(row,entry);placeCartAdded(document.querySelector('.mir-cart-drawer[open]')||document.body);
  entry.timer=setTimeout(()=>closeCartNotice(entry),5000);
 }
 const previewKey='mirpanel.cart.preview.v1';
 const catalog=()=>typeof DATA==='undefined'?[]:DATA.products||[];
 function catalogRow(p,idx){
  const plan=p?.plans?.[idx];if(!plan)return null;const cents=Math.round(Number(window.MirpanelPricing?.standard(plan)??plan.price)*100);
  const old=Number(plan.regularPrice),oldUnitCents=Number.isFinite(old)&&old>0?Math.round(old*100):null;
  return {title:p.title,planName:plan.label||plan.name||(plan.months?plan.months+' aylıq':'Paket'),image:p.image||'',oldUnitCents,unitCents:Number.isSafeInteger(cents)&&cents>0?cents:null};
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
  const generation=priceEpoch,quoteSignal=quoteLife.signal,ticket={};activeQuotes.add(ticket);syncQuoteBusy();const request=(async()=>{
   const {withRequestSignal}=await import('/request-lifecycle.mjs?v=abort-compat-1');
   const q=await withRequestSignal([quoteSignal],12000,async signal=>{
   const res=await (window.MirpanelRecovery?.read||fetch)('/api/payments/shop/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items}),signal,cache:'no-store'},{quote:true});
   const data=await res.json();if(!res.ok||!Array.isArray(data.items)||!Number.isSafeInteger(data.totalCents))throw Error('Qiymət və stoku yoxlamaq mümkün olmadı.');return data;
   });
   if(generation!==priceEpoch)throw Error('Account changed.');
   if(JSON.stringify(read().filter(x=>!isToken(x)))===key)for(const x of q.items){const k=itemKey(x);if(seen.size>=60)seen.delete(seen.keys().next().value);seen.set(k,x);}
   if(JSON.stringify(read())===key){const next={};for(const x of q.items){const k=itemKey(x);next[k]={title:x.title,planName:x.planName,image:x.image,available:x.available,salesDisabled:x.salesDisabled,oldUnitCents:x.oldUnitCents??null,unitCents:Number.isSafeInteger(x.standardCents)?x.standardCents:preview[k]?.unitCents??null};}savePreview(next);}
   return q;
  })().finally(()=>{if(pending.get(key)===request)pending.delete(key);activeQuotes.delete(ticket);syncQuoteBusy();});pending.set(key,request);return request;
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
 cart.open=({inline=true}={})=>{
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
  const pageCart=isCartPage(),d=node('dialog',null,'mir-cart-drawer'+(pageCart?' mir-cart-page':''));drawer=d;d.setAttribute('aria-label','Səbət');d.dataset.cartWindow='viewport-3';d.dataset.shellPersistent='';
  const layer=pageCart?null:node('dialog',null,'mir-cart-modal-layer');
  if(layer){layer.setAttribute('aria-label','Səbət pəncərəsi');layer.dataset.shellPersistent='';layer.addEventListener('cancel',e=>{e.preventDefault();d.close();});layer.addEventListener('click',e=>{if(e.target===layer)d.close();});}
  d.addEventListener('click',e=>{if(activeQuotes.size&&e.target.closest('.mir-cart-controls,.mir-cart-next,.mir-cart-offer,.mir-cart-info button,.mir-cart-retry')){e.preventDefault();e.stopImmediatePropagation();}},true);
  const scrollPosition={x:scrollX,y:scrollY},oldBodyStyle={position:document.body.style.position,top:document.body.style.top,width:document.body.style.width,overflow:document.body.style.overflow};
  const lockScroll=()=>{document.body.style.position='fixed';document.body.style.top=-scrollPosition.y+'px';document.body.style.width='100%';document.body.style.overflow='hidden';document.documentElement.classList.add('mir-cart-open');};
  const unlockScroll=()=>{Object.assign(document.body.style,oldBodyStyle);document.documentElement.classList.remove('mir-cart-open');window.scrollTo(scrollPosition.x,scrollPosition.y);};
  const heading=node('header'),title=node('strong','Səbət'),badge=node('span',null,'mir-cart-heading'),close=action('×',()=>d.close());
  badge.innerHTML=icon;badge.append(title);close.setAttribute('aria-label','Səbəti bağla');close.autofocus=true;heading.append(badge,close);
  const festive=node('span',null,'mir-cart-festive');festive.setAttribute('aria-hidden','true');festive.inert=true;
  for(const edge of ['top','right','bottom','left']){
   const strand=node('span',null,'mir-cart-lights is-'+edge);
   for(let i=0;i<9;i++){const bulb=node('i');bulb.style.setProperty('--bulb-position',((i+1)*10)+'%');bulb.style.setProperty('--bulb-delay',(-i*.37)+'s');strand.append(bulb);}
   festive.append(strand);
  }
  const hat=node('span',null,'mir-cart-hat');hat.innerHTML='<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M8 29C10 13 20 5 34 5c-3 6-2 11 3 15l-7 5-5-9-3 14Z" fill="#c91e32" stroke="#f35764" stroke-width="1.2"/><path d="M6 28q12-4 25-2l1 9q-13-2-26 2Z" fill="#fff4e6"/><circle cx="38" cy="21" r="6" fill="#fff4e6"/><path d="M12 25q2-10 10-14" fill="none" stroke="#ee4556" stroke-width="2" stroke-linecap="round"/></svg>';festive.append(hat);
  const body=node('div',null,'mir-cart-body'),foot=node('footer'),life=new AbortController(),notice=node('p',null,'mir-cart-notice'),total=node('strong','—'),sum=node('div',null,'mir-cart-sum'),next=action('Ödənişə keç',()=>location.assign(tokenPresent?'/odenis?mode=wallet&token=1':requiresLogin?'/hesab?next=%2Fsebet&from=cart':'/odenis'),'mir-cart-next'),other=action('Digər məhsullar üçün ödənişə keç',()=>location.assign('/odenis'),'mir-cart-retry'),retry=action('Yenidən yoxla',()=>void draw(),'mir-cart-retry');
  const jump=action('Ödənişə keç · —',()=>{const target=document.querySelector('#mirpanel-order-summary,[data-order-summary],#orderSummary')||foot;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});},'mir-cart-jump');
  if(pageCart){heading.insertBefore(jump,close);foot.dataset.cartSummary='';foot.id='mirpanel-order-summary';body.id='mirpanel-cart-edit';foot.prepend(node('h2','Sifarişiniz'));}
  if(pageCart){const down=node('span',null,'mir-cart-jump-down');down.innerHTML=svg('<path d="M12 5v14m-6-6 6 6 6-6"/>');down.setAttribute('aria-hidden','true');jump.append(down);}
  const nextArrow=node('span',null,'mir-cart-arrow');nextArrow.innerHTML=arrow;next.append(nextArrow);
  const savings=node('div',null,'mir-cart-savings'),savingsText=node('span','Səbətin səni gözləyir');
  savings.innerHTML=svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');savings.append(savingsText);
  notice.setAttribute('role','status');sum.append(node('span','Cəmi'),total);foot.append(notice,retry,savings,sum,next,other);d.append(heading,body,foot,festive);
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
  d.addEventListener('close',()=>{life.abort();resizeObserver.disconnect();if(!pageCart){quoteLife.abort();quoteLife=new AbortController();unlockScroll();}if(cartLayer===layer)cartLayer=null;placeCartAdded();placeRequestHud();layer?.close();layer?.remove();d.remove();if(drawer===d)drawer=null;if(isCartPage())location.replace(cartDestination());},{once:true});
  function render(items,quoted){
   const saved=items.reduce((sum,item)=>{const row=quoted.find(x=>itemKey(x)===itemKey(item));const old=row?.oldUnitCents,current=row?.unitCents;return sum+(Number.isSafeInteger(old)&&Number.isSafeInteger(current)?Math.max(0,old-current)*item.quantity:0);},0);
   savingsText.textContent='Səbətin səni gözləyir'+(saved>0?' — '+azMoney(saved)+' qənaət edirsən':'');savings.hidden=!items.length;
   const top=body.scrollTop,focus=document.activeElement?.dataset?.cartFocus;
   const rows=items.map(x=>{
    const p=quoted.find(y=>itemKey(y)===itemKey(x))||{},name=p.title||x.productId;
    const row=node('article',null,'mir-cart-item');row.dataset.cartProduct=x.productId;
    const product=catalog().find(product=>product.id===x.productId);
    const img=artwork(p.image||product?.image);
    const info=node('div',null,'mir-cart-info');info.append(node('strong',name),node('small',p.planName||'Seçilmiş paket'));
    const priceLine=node('div',null,'mir-cart-price-line'),price=node('b',p.unitCents==null?'—':azMoney(p.unitCents*x.quantity));if(pageCart){priceLine.append(price);info.append(priceLine);}else info.append(price);
    if(pageCart&&Number.isSafeInteger(p.unitCents)&&Number.isSafeInteger(p.oldUnitCents)&&p.oldUnitCents>p.unitCents){priceLine.append(node('del',azMoney(p.oldUnitCents*x.quantity)));info.append(node('small',azMoney((p.oldUnitCents-p.unitCents)*x.quantity)+' qənaət','mir-cart-saving'));}
    if(pageCart&&p.warrantyMode==='guaranteed'){
     const text=p.warrantyText||(Number.isSafeInteger(p.warrantyDuration)&&p.warrantyDuration>0?p.warrantyDuration+' '+(p.warrantyUnit==='day'?'gün':'ay')+' zəmanət':'');
     if(text){const warranty=node('small',text+' · təhvildən sonra','mir-cart-warranty');warranty.insertAdjacentHTML('afterbegin',svg('<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>'));info.append(warranty);}
    }
    if(p.supplierStock?.status==='unknown')info.append(node('small','Stok yoxlanıla bilmir'));
    else if(p.salesDisabled||p.available===0)info.append(node('small',p.supplierStock?.status==='out'?'Stokda bitib':'Stokda yoxdur'));
    else if(p.available!=null&&p.available<x.quantity)info.append(node('small',p.supplierStock&&p.supplierStock.count===null?'Bu paket seçilmiş sayda əlçatan deyil.':'Stokda '+p.available+' ədəd var.'));
    for(const field of p.maskedDetails||[])info.append(node('small',field.label+': '+field.value));
    if(x.draftId&&(p.termsMissing||p.fields?.length))info.append(action(p.termsMissing?'Şərtləri təsdiqlə':'Məlumatları redaktə et',()=>{
     void (window.MirpanelRecovery?window.MirpanelRecovery.module('/community-assets/cart-entry.js?v=game-validation-1'):import('/community-assets/cart-entry.js?v=game-validation-1')).then(m=>m.editCartLine(x)).catch(e=>{notice.textContent=e.message;});
    }));
    const controls=node('div',null,'mir-cart-controls'),qty=node('div',null,'mir-cart-qty'),change=n=>{try{cart.set(x.productId,x.planIndex,n,undefined,undefined,x.lineId);}catch(e){notice.textContent=e.message;}};
    const minus=action('−',()=>change(x.quantity-1)),plus=action('+',()=>change(x.quantity+1)),del=action('',()=>change(0),'mir-cart-remove');del.innerHTML=trash;
    for(const [b,label] of [[minus,'Azalt'],[plus,'Artır'],[del,'Sil']]){b.setAttribute('aria-label',label+': '+name);b.dataset.cartFocus=itemKey(x)+label;}
    minus.disabled=x.quantity<=1;plus.disabled=p.renewalOnly===true||x.quantity>=20||p.available!=null&&x.quantity>=p.available;
    if(pageCart)controls.append(del);if(!isToken(x)){qty.append(minus,node('span',x.quantity),plus);controls.append(qty);}if(!pageCart)controls.append(del);
    if(pageCart){const bottom=node('div',null,'mir-cart-item-bottom'),saving=info.querySelector('.mir-cart-saving');if(saving)bottom.append(saving);bottom.append(controls);row.append(img,info,priceLine,bottom);}else row.append(img,info,controls);return row;
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
    info.append(node('strong',p.title),node('b',azMoney(price)));
    const choose=node('a',null,'mir-cart-offer');choose.innerHTML=svg('<path d="M12 4v16M4 12h16"/>');choose.href=p.path;choose.dataset.nativeNavigation='';
    choose.setAttribute('aria-label',p.title+' seç');row.append(img,info,choose);more.append(row);
   }
   if(more.children.length===1){const a=node('a','+ Məhsullara bax');a.href='/mehsul';more.append(a);}
   body.replaceChildren(...(rows.length?rows:[node('p','Səbətiniz boşdur.','mir-cart-empty')]),more);body.scrollTop=top;
   if(focus)[...body.querySelectorAll('[data-cart-focus]')].find(n=>n.dataset.cartFocus===focus)?.focus({preventScroll:true});
  }
  let readFailed=false;
  async function draw(){readFailed=false;
   const run=++generation,items=read();tokenPresent=items.some(isToken);other.hidden=true;remember(items);const count=items.reduce((s,x)=>s+x.quantity,0);if(pageCart)title.replaceChildren(node('span','Səbət','mir-cart-page-title'),node('span',' · '+count+' məhsul','mir-cart-page-count'));else title.textContent='Səbət ('+count+')';next.disabled=true;retry.hidden=true;
   const rows=previewRows(items),prices=rows.map(x=>[x.quantity,x.unitCents]);
   if(pageCart)jump.firstChild.textContent='Ödənişə keç · —';
   total.textContent=prices.every(([,c])=>Number.isSafeInteger(c))?azMoney(prices.reduce((s,[n,c])=>s+n*c,0)):'—';
   function show(rows){
    render(items,rows);
    const termsMissing=rows.some(x=>x.termsMissing),detailsMissing=rows.some(x=>x.detailsMissing);
    const stockUnknown=rows.some(x=>x.supplierStock?.status==='unknown');
    const short=stockUnknown||rows.some(x=>x.salesDisabled||x.available!=null&&x.available<x.quantity);
    next.disabled=tokenPresent?rows.some(x=>isToken(x)&&x.termsMissing):!items.length||rows.length!==items.length||short||termsMissing||detailsMissing;
    other.hidden=!tokenPresent||!items.some(x=>!isToken(x));
    other.disabled=rows.some(x=>!isToken(x)&&(x.termsMissing||x.detailsMissing||x.salesDisabled||x.supplierStock?.status==='unknown'||x.available!=null&&x.available<x.quantity));
    next.firstChild.textContent=other.hidden?'Ödənişə keç':'Token üçün ödənişə keç';
    notice.textContent=stockUnknown?'Stok yoxlanıla bilmir. Yenidən yoxlayın.':short?'Səbətdəki bəzi paketlər stokda bitib və ya seçilmiş sayda yoxdur.':termsMissing?'Məhsulun şərtlərini yenidən təsdiqləyin.':detailsMissing?'Sifariş məlumatlarını tamamlayın.':'';
    retry.hidden=!stockUnknown;
   }
   render(items,rows);
   notice.textContent=items.length?'Qiymət və stok yoxlanılır…':'';
   if(!items.length)return;
   try{
    const q=await verify(items);if(run!==generation||life.signal.aborted)return;
    requiresLogin=q.balanceCents===null;show(q.items);if(pageCart){d.cartQuote={quote:q,items};d.dispatchEvent(new CustomEvent('mirpanel:cart-quote',{bubbles:true,detail:d.cartQuote}));}total.textContent=azMoney(q.totalCents);if(pageCart)jump.firstChild.textContent='Ödənişə keç · '+azMoney(q.totalCents).replace(' ₼','\u00a0₼');
   }catch(error){if(run===generation&&!life.signal.aborted){readFailed=true;notice.textContent=error?.name==='TimeoutError'?'Sorğu vaxtında tamamlanmadı. Səbətiniz saxlanılıb. Yenidən yoxlayın.':'Qiymət və stoku yoxlamaq mümkün olmadı. Yenidən yoxlayın.';retry.hidden=false;if(tokenPresent){next.firstChild.textContent='Token üçün ödənişə keç';next.disabled=false;}}}
  }
  window.addEventListener('mirpanel:cart',draw,{signal:life.signal});window.addEventListener('storage',e=>{if(e.key===key)void draw();},{signal:life.signal});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void draw();},{signal:life.signal});
  window.addEventListener('online',()=>{if(readFailed)void draw();},{signal:life.signal});
  const stockTimer=setInterval(()=>{if(!document.hidden&&!readFailed)void draw();},15000);life.signal.addEventListener('abort',()=>clearInterval(stockTimer),{once:true});
  const viewport=window.visualViewport;
  const fit=()=>{d.style.setProperty('--cart-view-height',(viewport?.height||innerHeight)+'px');d.style.setProperty('--cart-view-top',(viewport?.offsetTop||0)+'px');};
  const resizeObserver=new ResizeObserver(fit);if(!pageCart)resizeObserver.observe(document.documentElement);
  window.addEventListener('resize',fit,{signal:life.signal});viewport?.addEventListener('resize',fit,{signal:life.signal});viewport?.addEventListener('scroll',fit,{signal:life.signal});fit();
  loading?.remove();if(pageCart){document.getElementById('shopApp').append(d);fit();d.show();}else{document.body.append(layer);layer.append(d);cartLayer=layer;lockScroll();fit();d.show();layer.showModal();}placeCartAdded();placeRequestHud();syncQuoteBusy();void draw();
 }
 document.addEventListener('click',event=>{
  if(activeQuotes.size&&event.target.closest('.checkout-final-submit,.cart-upper-controls button')){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download'))return;
  const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname!=='/sebet'||url.search||url.hash)return;
  event.preventDefault();cart.open();
 });
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
 const css=document.createElement('link');css.rel='stylesheet';css.href='/cart-store.css?v=cart-upper-design-20261126';if(!document.querySelector('link[href="/cart-store.css?v=cart-upper-design-20261126"]'))document.head.append(css);new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});window.addEventListener('mirpanel:cart',mount);window.addEventListener('pagehide',dismissCartAdded);window.addEventListener('storage',e=>{if(e.key===key)mount();});mount();if(isCartPage())mountDrawer();
})();
