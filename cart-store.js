(()=>{'use strict';if(window.MirpanelCart)return;const key='mirpanel.cart.v1';
 const clean=x=>({productId:x.productId,planIndex:x.planIndex,quantity:x.quantity,...(x.draftId?{draftId:x.draftId,lineId:x.lineId||x.draftId}:{}),...(x.termsVersion?{termsVersion:x.termsVersion}:{})});
 const read=()=>{try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.filter(x=>typeof x.productId==='string'&&Number.isInteger(x.planIndex)&&x.planIndex>=0&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=20).slice(0,20).map(clean):[];}catch{return[];}};
 function save(items){localStorage.setItem(key,JSON.stringify(items.map(clean)));window.dispatchEvent(new Event('mirpanel:cart'));}
 const line=(id,idx)=>JSON.stringify([id,idx]);
 sessionStorage.removeItem('mirpanel.cart.details.v1');
 const draftPost=(path,body)=>fetch('/api/payments/shop/'+path,{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Qaralama yenilənmədi.');return r.json();});
 const removedKey='mirpanel.cart.removed.v2';
 const removed=()=>{try{return JSON.parse(localStorage.getItem(removedKey)||'[]');}catch{return[];}};
 function retire(ids){localStorage.setItem(removedKey,JSON.stringify([...new Set([...removed(),...ids])].slice(-200)));if(ids.length)void draftPost('draft/remove',{ids}).catch(()=>{});}
 const cart={read,checkout:read,
 commitDraft(d,meta){const a=read(),x=clean({...meta,...d}),at=a.findIndex(n=>n.lineId===x.lineId);if(at<0)a.push(x);else a[at]=x;if(a.length>20||a.reduce((s,x)=>s+x.quantity,0)>40)throw Error('Səbət limiti: 20 sətir, 40 ədəd.');save(a);},
 set(productId,planIndex,quantity,values,termsVersion,lineId){if(values&&Object.keys(values).length)throw Error('Məlumatları qorunan sifariş formasında daxil edin.');if(!Number.isInteger(quantity)||quantity<0||quantity>20)throw Error('Say 1–20 aralığında olmalıdır.');const a=read(),at=a.findIndex(x=>lineId?x.lineId===lineId:x.productId===productId&&x.planIndex===planIndex);if(at<0)throw Error('Məhsulu əvvəlcə sifariş formasında təsdiqləyin.');if(quantity)a[at].quantity=quantity;else{retire([a[at].draftId].filter(Boolean));a.splice(at,1);}if(a.reduce((s,x)=>s+x.quantity,0)>40)throw Error('Bir sifarişdə ən çox 40 ədəd.');save(a);},
 add(){throw Error('Məhsulu əvvəlcə sifariş formasında təsdiqləyin.');},
 clear(){retire(read().map(x=>x.draftId).filter(Boolean));save([]);}};window.MirpanelCart=cart;
 async function restore(){try{const r=await fetch('/api/payments/shop/drafts',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const d=await r.json(),a=read(),gone=new Set(removed());for(const x of d.items||[])if(!gone.has(x.draftId)&&!a.some(n=>n.lineId===x.lineId)&&a.length<20)a.push(clean(x));save(a);}catch{}}
 const azMoney=c=>(c/100).toFixed(2).replace('.',',')+' ₼';
 function node(tag,value,cls){const n=document.createElement(tag);if(value!=null)n.textContent=value;if(cls)n.className=cls;return n;}
 function action(label,fn,cls){const b=node('button',label,cls);b.type='button';b.onclick=fn;return b;}
 const previewKey='mirpanel.cart.preview.v1';
 const catalog=()=>typeof DATA==='undefined'?[]:DATA.products||[];
 function catalogRow(p,idx){
  const plan=p?.plans?.[idx];if(!plan)return null;const cents=Math.round(Number(plan.price)*100);
  return {title:p.title,planName:plan.label||plan.name||(plan.months?plan.months+' aylıq':'Paket'),image:p.image||'',unitCents:Number.isSafeInteger(cents)&&cents>0?cents:null};
 }
 let preview={};try{preview=JSON.parse(localStorage.getItem(previewKey)||'{}')||{};}catch{}
 function savePreview(next){preview=next;try{const json=JSON.stringify(next);if(localStorage.getItem(previewKey)!==json)localStorage.setItem(previewKey,json);}catch{}}
 const seen=new Map(),pending=new Map(),itemKey=x=>x.lineId||line(x.productId,x.planIndex);
 function remember(items){
  const products=catalog();if(!products.length)return;
  const next={};for(const x of items){const k=itemKey(x),p=products.find(p=>p.id===x.productId);const row=catalogRow(p,x.planIndex)||preview[k];if(row)next[k]=row;}
  savePreview(next);
 }
 function verify(items){
  const key=JSON.stringify(items);if(pending.has(key))return pending.get(key);
  const request=(async()=>{
   const res=await fetch('/api/payments/shop/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items}),signal:AbortSignal.timeout(12000),cache:'no-store'});
   const q=await res.json();if(!res.ok||!Array.isArray(q.items)||!Number.isSafeInteger(q.totalCents))throw Error('Qiymət və stoku yoxlamaq mümkün olmadı.');
   for(const x of q.items){const k=itemKey(x);if(seen.size>=60)seen.delete(seen.keys().next().value);seen.set(k,x);}
   if(JSON.stringify(read())===key){const next={};for(const x of q.items){const k=itemKey(x);next[k]={title:x.title,planName:x.planName,image:x.image,unitCents:Number.isSafeInteger(x.standardCents)?x.standardCents:preview[k]?.unitCents??null};}savePreview(next);}
   return q;
  })().finally(()=>pending.delete(key));pending.set(key,request);return request;
 }
 function prefetch(){const items=read();remember(items);if(items.length)void verify(items).catch(()=>{});}
 const svg=path=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
 const trash=svg('<path d="M4 7h16m-14 0 1 13h10l1-13M9 7V4h6v3m-5 3v6m4-6v6"/>'),arrow=svg('<path d="M5 12h14m-6-6 6 6-6 6"/>');
 let drawer;
 cart.open=()=>{
  if(drawer?.open)return;
  const d=node('dialog',null,'mir-cart-drawer');drawer=d;d.setAttribute('aria-label','Səbət');
  const heading=node('header'),title=node('strong','Səbət'),badge=node('span',null,'mir-cart-heading'),close=action('×',()=>d.close());
  badge.innerHTML=icon;badge.append(title);close.setAttribute('aria-label','Səbəti bağla');heading.append(badge,close);
  const body=node('div',null,'mir-cart-body'),foot=node('footer'),life=new AbortController(),notice=node('p',null,'mir-cart-notice'),total=node('strong','—'),sum=node('div',null,'mir-cart-sum'),next=action('Ödənişə keç',()=>location.assign('/odenis'),'mir-cart-next'),retry=action('Yenidən yoxla',()=>void draw(),'mir-cart-retry');
  const nextArrow=node('span',null,'mir-cart-arrow');nextArrow.innerHTML=arrow;next.append(nextArrow);
  notice.setAttribute('role','status');sum.append(node('span','Cəmi'),total);foot.append(notice,retry,sum,next);d.append(heading,body,foot);
  let generation=0;
  const initial=read(),products=catalog(),source=products.find(p=>p.id===initial.at(-1)?.productId);
  const related=products.filter(p=>p.active!==false&&!p.soldOut&&p.plans?.length&&!initial.some(x=>x.productId===p.id))
   .map(p=>({p,rank:Number(!!source?.category&&p.category===source.category),random:Math.random(),price:Math.min(...p.plans.map((plan,i)=>!plan.soldOut&&window.MirpanelInventory?.planState(p,i)?.canOrder!==false?catalogRow(p,i)?.unitCents:null).filter(Number.isSafeInteger))}))
   .filter(x=>Number.isFinite(x.price)).sort((a,b)=>b.rank-a.rank||a.random-b.random).slice(0,3);
  d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
  d.addEventListener('close',()=>{life.abort();d.remove();if(drawer===d)drawer=null;},{once:true});
  function render(items,quoted){
   const top=body.scrollTop,focus=document.activeElement?.dataset?.cartFocus;
   const rows=items.map(x=>{
    const p=quoted?.find(y=>itemKey(y)===itemKey(x))||seen.get(itemKey(x))||preview[itemKey(x)]||{},name=p.title||x.productId;
    const row=node('article',null,'mir-cart-item');row.dataset.cartProduct=x.productId;
    const img=node('img');img.src=p.image||'/favicon.ico';img.alt='';
    const info=node('div',null,'mir-cart-info');info.append(node('strong',name),node('small',p.planName||'Seçilmiş paket'),node('b',p.unitCents==null?'—':azMoney(p.unitCents*x.quantity)));
    for(const field of p.maskedDetails||[])info.append(node('small',field.label+': '+field.value));
    if(x.draftId)info.append(action(p.termsMissing?'Şərtləri təsdiqlə':'Məlumatları redaktə et',()=>{d.close();void import('/community-assets/cart-entry.js?v=cart-v2').then(m=>m.editCartLine(x)).catch(e=>alert(e.message));}));
    const controls=node('div',null,'mir-cart-controls'),qty=node('div',null,'mir-cart-qty'),change=n=>{try{cart.set(x.productId,x.planIndex,n,undefined,undefined,x.lineId);}catch(e){notice.textContent=e.message;}};
    const minus=action('−',()=>change(x.quantity-1)),plus=action('+',()=>change(x.quantity+1)),del=action('Sil',()=>change(0),'mir-cart-remove');del.insertAdjacentHTML('afterbegin',trash);
    for(const [b,label] of [[minus,'Azalt'],[plus,'Artır'],[del,'Sil']]){b.setAttribute('aria-label',label+': '+name);b.dataset.cartFocus=itemKey(x)+label;}
    minus.disabled=x.quantity<=1;plus.disabled=x.quantity>=20||quoted&&p.available!=null&&x.quantity>=p.available;
    qty.append(minus,node('span',x.quantity),plus);controls.append(qty,del);row.append(img,info,controls);return row;
   });
   const more=node('section',null,'mir-cart-more');more.append(node('p','Daha çox məhsul əlavə et'));
   for(const {p,price} of related.filter(({p})=>!items.some(x=>x.productId===p.id))){
    const row=node('article',null,'mir-cart-item mir-cart-suggestion'),img=node('img');img.src=p.image||'/favicon.ico';img.alt='';
    const info=node('div',null,'mir-cart-info');
    info.append(node('strong',p.title),node('b',azMoney(price)+(p.plans.length>1?'-dən başlayır':'')));
    const b=action('+',()=>{
     d.close();if(typeof window.openProductPage==='function')window.openProductPage(p.id);else location.assign('/mehsul');
    });
    b.setAttribute('aria-label',p.title+' seç');row.append(img,info,b);more.append(row);
   }
   if(more.children.length===1){const a=node('a','+ Məhsullara bax');a.href='/mehsul';a.onclick=()=>d.close();more.append(a);}
   body.replaceChildren(...(rows.length?rows:[node('p','Səbətiniz boşdur.')]),more);body.scrollTop=top;
   if(focus)[...body.querySelectorAll('[data-cart-focus]')].find(n=>n.dataset.cartFocus===focus)?.focus({preventScroll:true});
  }
  async function draw(){
   const run=++generation,items=read();remember(items);title.textContent='Səbət ('+items.reduce((s,x)=>s+x.quantity,0)+')';next.disabled=true;retry.hidden=true;
   const prices=items.map(x=>[x.quantity,(seen.get(itemKey(x))||preview[itemKey(x)])?.unitCents]);total.textContent=prices.every(([,c])=>Number.isSafeInteger(c))?azMoney(prices.reduce((s,[n,c])=>s+n*c,0)):'—';
   notice.textContent=items.length?'Qiymət və stok yoxlanılır…':'';render(items);
   if(!items.length)return;
   try{
    const q=await verify(items);if(run!==generation||life.signal.aborted)return;
    render(items,q.items);total.textContent=azMoney(q.totalCents);
    const termsOk=q.items.every(x=>!x.termsMissing&&!x.detailsMissing);
    const ok=q.items.length===items.length&&q.items.every(x=>x.available==null||x.available>=x.quantity);
    notice.textContent=!termsOk?'Məhsulun şərtlərini yenidən təsdiqləyin.':ok?'Sifarişiniz hazırdır — ödənişi tamamlayın':'Seçdiyiniz say stokda yoxdur.';next.disabled=!ok||!termsOk;
   }catch{if(run===generation&&!life.signal.aborted){notice.textContent='Yoxlama alınmadı. Səbətiniz qorunub.';retry.hidden=false;}}
  }
  window.addEventListener('mirpanel:cart',draw,{signal:life.signal});window.addEventListener('storage',e=>{if(e.key===key)void draw();},{signal:life.signal});
  document.body.append(d);void draw();d.showModal();
 };
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('#cartHeaderLink,[data-browser-nav=cart]');if(!a||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
  e.preventDefault();e.stopImmediatePropagation();cart.open();
 },true);
 window.addEventListener('mirpanel:cart',()=>{if(!drawer?.open)prefetch();});
 window.addEventListener('mirpanel:route-ready',()=>remember(read()));
 prefetch();void restore();
 const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h2l3 13h11l3-9H6 M10 21h.01 M18 21h.01"/></svg>';
 function fly(b,p){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const target=[...document.querySelectorAll('#cartHeaderLink,[data-browser-nav=cart]')].find(n=>n.getClientRects().length),image=document.getElementById('pp-main-img')?.currentSrc||p.image;if(!target||!image||!b.animate)return;
  const a=b.getBoundingClientRect(),z=target.getBoundingClientRect(),n=document.createElement('img'),x=a.left+a.width/2-24,y=a.top+a.height/2-24;n.className='cart-flight';n.alt='';n.src=image;n.style.left=x+'px';n.style.top=y+'px';document.body.append(n);
  const motion=n.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${z.left+z.width/2-x-24}px,${z.top+z.height/2-y-24}px) scale(.28)`,opacity:.35}],{duration:550,easing:'cubic-bezier(.22,.65,.36,1)'});motion.finished.then(()=>n.remove(),()=>n.remove());
 }
 function mount(){const order=document.getElementById('pp-order-btn');if(order&&!document.getElementById('cartAddProduct')){const b=document.createElement('button'),about=order.parentElement.querySelector('.product-page-action.is-about'),label=document.createElement('span');b.id='cartAddProduct';b.type='button';b.className='cart-add-product'+(about?' product-page-action is-cart':'');b.innerHTML=icon;label.textContent='Səbətə əlavə et';b.append(label);b.onclick=()=>{try{if(typeof currentProduct==='undefined'||!currentProduct||!Number.isInteger(currentPlanIdx))throw Error('Əvvəlcə məhsul və planı seçin.');if(order.disabled)throw Error('Seçilmiş paket hazırda stokda yoxdur.');cart.add(currentProduct.id,currentPlanIdx);fly(b,currentProduct);label.textContent='Əlavə edildi';clearTimeout(b.feedbackTimer);b.feedbackTimer=setTimeout(()=>label.textContent='Səbətə əlavə et',1400);}catch(e){alert(e.message);}};if(about)about.replaceWith(b);else order.before(b);}
 const header=document.querySelector('.site-header-tools');if(header&&!document.getElementById('cartHeaderLink')){const a=document.createElement('a');a.id='cartHeaderLink';a.href='/sebet';a.className='cart-header-link';a.setAttribute('aria-label','Səbət');a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h2l3 13h11l3-9H6 M10 21h.01 M18 21h.01"/></svg><span>Səbət</span><small></small>';header.append(a);}const n=document.querySelector('#cartHeaderLink small'),count=read().reduce((s,x)=>s+x.quantity,0),text=count>99?'99+':count?String(count):'';if(n&&n.textContent!==text)n.textContent=text;const link=document.getElementById('cartHeaderLink');if(link)link.setAttribute('aria-label',count?'Səbət, '+count+' məhsul':'Səbət');}
 const css=document.createElement('link');css.rel='stylesheet';css.href='/cart-store.css?v=guest-order-20261106';document.head.append(css);new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});window.addEventListener('mirpanel:cart',mount);window.addEventListener('storage',e=>{if(e.key===key)mount();});mount();
})();
