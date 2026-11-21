/* Read-only sales figures are fetched near the viewport, not ahead of the next route. */
(()=>{'use strict';if(window.mirpanelCatalogSales)return;window.mirpanelCatalogSales=true;
 let scope=null;
 const deliveryModel=import('/ready-delivery.mjs?v=ready-sku-2');
 const transport=import('/request-lifecycle.mjs?v=abort-compat-1');
 async function paintStock(state){
  const [{withRequestSignal},{packageDeliveryText}]=await Promise.all([transport,deliveryModel]);
  const data=await withRequestSignal([state.controller.signal],10000,async signal=>{
   const response=await fetch('/api/payments/inventory',{signal,cache:'no-store'});
   return response.ok?response.json():null;
  });
  if(!data)throw Error('Inventory unavailable');
  const {products:inventory}=data;
  const source=document.getElementById('catalogCartProducts');
  if(state!==scope||!source||!Array.isArray(inventory))return;
  state.stockAt=performance.now();
  window.dispatchEvent(new CustomEvent('mirpanel:catalog-stock',{detail:{source,inventory,valid:true}}));
  if(new URLSearchParams(location.search).get('delivery')==='instant')return;
  const byId=new Map(inventory.map(row=>[row.productId,row]));
  for(const product of JSON.parse(source.textContent)){
   const ledger=byId.get(product.id);
   if(!ledger){document.querySelector('.catalog-grid [data-product-id="'+CSS.escape(product.id)+'"] .homeCardDelivery')?.remove();continue;}
   const price=product.id==='tiktok_jeton'?10:Math.min(...product.plans.filter(p=>Number(p.price)>0).map(p=>Number(p.price)));
   const index=product.plans.findIndex(p=>Number(p.price)===price);
   const plan=ledger.plans?.find(p=>p.planKey===String(index));
   const count=ledger.scope==='product'&&!ledger.unlimited?ledger.available:ledger.scope==='plan'&&plan?.tracked!==false?plan?.available:null;
   const card=document.querySelector('.catalog-grid [data-product-id="'+CSS.escape(product.id)+'"]');
   if(!card)continue;
   let delivery=card.querySelector('.homeCardDelivery');
   const deliveryLabel=packageDeliveryText(product,index,plan);
   if(!deliveryLabel)delivery?.remove();
   else{if(!delivery){delivery=document.createElement('p');delivery.className='homeCardDelivery';card.querySelector('.pad').append(delivery);}delivery.textContent=deliveryLabel;delivery.classList.toggle('is-instant',deliveryLabel==='Anında təqdim olunur');}
   const add=card.querySelector('.homeCardAdd');
   if(add){add.dataset.stockDisabled=String(!ledger.canOrder);add.disabled=!ledger.canOrder||add.dataset.busy==='true';}
   const line=card.querySelector('.cardStockLine');
   const stock=ledger.salesDisabled?0:count;
   if(!ledger.salesDisabled&&(ledger.needsSetup||!Number.isSafeInteger(stock)||stock<0)){line?.remove();continue;}
   const label=stock===0?'Stokda yoxdur':stock<10?'Son '+stock+' ədəd':'Stok: '+stock;
   if(line?.textContent===label)continue;
   const updated=document.createElement('div'),badge=document.createElement('span');
   updated.className='cardStockLine';badge.className='mpStockBadge cardStockBadge '+(stock===0?'out':stock<10?'low':'count');
   badge.textContent=label;updated.append(badge);
   if(line)line.replaceWith(updated);else card.querySelector('.pad').append(updated);
  }
 }
 function refreshStock(state){
  if(state.stockRequest||document.hidden||performance.now()-(state.stockAt??-Infinity)<10000)return;
  state.stockRequest=paintStock(state).catch(()=>{if(state===scope){document.querySelectorAll('.catalog-grid .homeCardDelivery').forEach(n=>n.remove());window.dispatchEvent(new CustomEvent('mirpanel:catalog-stock',{detail:{source:document.getElementById('catalogCartProducts'),valid:false}}));}}).finally(()=>{state.stockRequest=null;});
 }
 function stop(){clearInterval(scope?.stockTimer);clearInterval(scope?.salesTimer);scope?.controller.abort();scope?.observer?.disconnect();scope=null;}
 function start(){
  if(location.pathname!=='/mehsul'||scope)return;
  const nodes=[...document.querySelectorAll('.catalog-grid [data-home-sales-id]')];
  if(!document.getElementById('catalogCartProducts'))return;
  const state={controller:new AbortController(),observer:null,queue:[],pending:new Set(),busy:0};scope=state;
  refreshStock(state);
  state.stockTimer=setInterval(()=>refreshStock(state),10000);
  state.refreshSales=()=>{
   if(document.hidden||state!==scope)return;
   for(const line of document.querySelectorAll('.catalog-grid [data-home-sales-id]')){const box=line.closest('.card')?.getBoundingClientRect();if(box&&box.bottom>0&&box.top<innerHeight+160&&!state.pending.has(line)&&!state.queue.includes(line))state.queue.push(line);}
   drain();
  };
  state.salesTimer=setInterval(()=>state.refreshSales(),10000);
  const drain=()=>{while(state.busy<3&&state.queue.length&&!state.controller.signal.aborted){
   const line=state.queue.shift(),id=line.dataset.homeSalesId;state.busy++;state.pending.add(line);
   transport.then(({withRequestSignal})=>withRequestSignal([state.controller.signal],15000,async signal=>{
    const r=await fetch('https://mirpanel-frankfurt.onrender.com/api/product-sales?productId='+encodeURIComponent(id),{priority:'low',cache:'no-store',signal});
    return r.ok?r.json():null;
   })).then(v=>{
    if(!v)return;
    if(state!==scope||!line.isConnected||v.productId!==id||v.initialized!==true||!Number.isSafeInteger(v.productTotal)||v.productTotal<0)return;
    line.textContent=new Intl.NumberFormat('en-US').format(v.productTotal).replaceAll(',',' ')+' dəfə satılıb';line.hidden=false;line.dataset.salesReady='';
   }).catch(()=>{}).finally(()=>{state.busy--;state.pending.delete(line);drain();});
  }};
  if(typeof IntersectionObserver!=='function'){state.queue.push(...nodes);drain();return;}
  const lines=new Map(nodes.map(n=>[n.closest('.card'),n]));
  state.observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){state.observer.unobserve(entry.target);const line=lines.get(entry.target);if(!state.pending.has(line)&&!state.queue.includes(line))state.queue.push(line);}
   drain();
  },{rootMargin:'160px'});
  for(const card of lines.keys())if(card)state.observer.observe(card);
 }
 window.addEventListener('mirpanel:route-leave',stop);
 window.addEventListener('mirpanel:catalog-filtered',()=>scope?.refreshSales?.());
 window.addEventListener('mirpanel:catalog-stock-retry',()=>{if(scope){scope.stockAt=-Infinity;refreshStock(scope);}});
 window.addEventListener('mirpanel:route-ready',start);
 window.addEventListener('pagehide',stop);
 window.addEventListener('pageshow',start);
 const resume=()=>{start();if(scope){refreshStock(scope);scope.refreshSales?.();}};
 window.addEventListener('focus',resume);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume();});
 start();
})();

/* Listing cards enter the same verified cart form as product pages. */
document.addEventListener('click', async event => {
 const add=event.target.closest('.catalog-grid .homeCardAdd');
 if(!add||add.disabled)return;
 event.preventDefault();
 if(document.querySelector('dialog.cart-entry[open],dialog.homeCardPlanPicker[open]'))return;
 const source=document.getElementById('catalogCartProducts');
 const product=(window.MirpanelPricing?.attach(JSON.parse(source.textContent))||JSON.parse(source.textContent)).find(p=>p.id===add.closest('[data-product-id]').dataset.productId);
 if(!product)return;
 add.dataset.busy='true';add.disabled=true;
 const clickLife=new AbortController(),cancel=()=>clickLife.abort();
 window.addEventListener('mirpanel:route-leave',cancel,{once:true});
 let status=document.getElementById('catalogCartStatus');
 if(!status){status=document.createElement('p');status.id='catalogCartStatus';status.setAttribute('role','status');document.querySelector('.catalog-grid').before(status);}
 status.textContent='';
 try{
  const [inventory, entry, model]=await Promise.all([
   import('/request-lifecycle.mjs?v=abort-compat-1').then(({withRequestSignal})=>withRequestSignal([clickLife.signal],10000,async signal=>{
    const r=await fetch('/api/payments/inventory',{cache:'no-store',signal});
    if(!r.ok)throw Error('Stok məlumatı alınmadı.');return r.json();
   })),
   import('/community-assets/cart-entry.js?v=spotify-compact-1'),
   import('/inventory-availability.mjs?v=live-sale-switch-1')
  ]);
  if(!add.isConnected||clickLife.signal.aborted)return;
  const state=model.inventoryAvailability(product,inventory.products.find(p=>p.productId===product.id));
  const exact=add.closest('[data-instant-plan]')?.dataset.instantPlan;
  if(exact!==undefined){const {instantPlanIndices}=await import('/ready-delivery.mjs?v=instant-filter-1');const index=Number(exact);if(!instantPlanIndices(product,state.plans).includes(index))throw Error('Bu paket üçün hazır hesab artıq yoxdur.');await entry.startCartEntry(product,product.plans[index]);return;}
  const choices=product.plans.map((plan,index)=>({plan,available:state.plans[index].canOrder})).filter(x=>x.plan.active!==false&&Number(x.plan.price)>0);
  if(!choices.some(x=>x.available))throw Error('Stokda yoxdur.');
  if(choices.length===1){await entry.startCartEntry(product,choices[0].plan);return;}
  const dialog=document.createElement('dialog'),heading=document.createElement('h2');
  dialog.className='homeCardPlanPicker';heading.textContent='Paket seçin';heading.id='catalogPlanTitle';dialog.setAttribute('aria-labelledby',heading.id);dialog.append(heading);
  for(const {plan,available} of choices){
   const button=document.createElement('button'),label=document.createElement('span'),price=document.createElement('strong');
   button.type='button';button.disabled=!available;label.textContent=plan.label||plan.months+' ay';
   price.textContent=available?Number(plan.price).toFixed(2)+' '+(product.currency||'₼'):'Stokda yoxdur';
   button.append(label,price);
   button.onclick=()=>{dialog.close();void entry.startCartEntry(product,plan);};
   dialog.append(button);
  }
  const close=document.createElement('button');close.textContent='Bağla';close.type='button';close.onclick=()=>dialog.close();dialog.append(close);
  const life=new AbortController();
  window.addEventListener('mirpanel:route-leave',()=>dialog.close(),{signal:life.signal});
  dialog.addEventListener('close',()=>{life.abort();dialog.remove();},{once:true});
  document.body.append(dialog);dialog.showModal();
 }catch(error){if(add.isConnected&&!clickLife.signal.aborted)status.textContent=error.name==='TimeoutError'?'Stok cavabı gecikir. Yenidən + düyməsinə basın.':error.message||'Sifariş açıla bilmədi.';}
 finally{window.removeEventListener('mirpanel:route-leave',cancel);delete add.dataset.busy;add.disabled=add.dataset.stockDisabled==='true';}
});

// A category link narrows only the catalog list, preserving each product URL.
(async function(){
 const [{instantPlanIndices},{inventoryAvailability}]=await Promise.all([import('/ready-delivery.mjs?v=instant-filter-1'),import('/inventory-availability.mjs?v=epinby-stock-1')]);
 const originals=new WeakMap();let snapshot=null;
 function filterCategory(){
  if(location.pathname!=='/mehsul')return;
  const grid=document.querySelector('.catalog-grid'),source=document.getElementById('catalogCartProducts');
  if(!grid||!source)return;
  if(!originals.has(grid))originals.set(grid,grid.innerHTML);
  const selected=new URLSearchParams(location.search).get('category');
  const instant=new URLSearchParams(location.search).get('delivery')==='instant';
  let products;try{products=JSON.parse(source.textContent);}catch{return;}
  const name=[...document.querySelectorAll('[data-catalog-category]')].find(n=>n.dataset.catalogCategory===selected)?.textContent;
  const title=document.querySelector('main h1');
  if(title)title.textContent=instant?'Anında təhvil':selected==='featured'?'Hamı bunu alır':name||'Premium rəqəmsal məhsullar';
  let instantLink=document.querySelector('[data-catalog-instant]');
  const nav=document.querySelector('nav[aria-label="Məhsul kateqoriyaları"]');
  if(nav&&!instantLink){const all=document.createElement('a');all.href='/mehsul';all.textContent='Hamısı';instantLink=document.createElement('a');instantLink.href='/mehsul?delivery=instant';instantLink.textContent='⚡ Anında təhvil';instantLink.dataset.catalogInstant='';nav.prepend(all,instantLink);}
  if(nav){nav.classList.add('catalog-filter-tabs');for(const a of nav.querySelectorAll('a')){const u=new URL(a.href);const chosen=instant?a===instantLink:!u.searchParams.has('delivery')&&(u.searchParams.get('category')||'')===(selected||'');a.classList.toggle('active',chosen);a.setAttribute('aria-current',chosen?'true':'false');}}
  if(instant){
   if(!grid.dataset.instantScrolled){grid.dataset.instantScrolled='1';nav?.scrollIntoView({block:'start',behavior:'instant'});}
   document.getElementById('catalogCategoryEmpty')?.remove();
   if(snapshot?.source!==source||snapshot.valid!==true){grid.innerHTML='<p class="home-catalog-status" role="status">'+(snapshot?.source===source?'Stok yoxlanıla bilmir. <button type="button" data-instant-retry>Yenidən cəhd et</button>':'Hazır hesablar yoxlanılır…')+'</p>';grid.querySelector('[data-instant-retry]')?.addEventListener('click',()=>window.dispatchEvent(new Event('mirpanel:catalog-stock-retry')));return;}
   const byId=new Map(snapshot.inventory.map(p=>[p.productId,p]));
   const chosen=products.map(p=>({p,index:instantPlanIndices(p,inventoryAvailability(p,byId.get(p.id)).plans)[0]})).filter(v=>v.index!==undefined);
   grid.innerHTML=chosen.map(({p,index},i)=>{
    const url='/mehsul/'+String(p.seoSlug||p.id).replace(/-almaq$/,'')+'?plan='+index;
    return window.MirpanelCatalogCard.render(p,i,url,p.title,Number(p.plans[index].price),Number(p.plans[index].price).toFixed(2)+' '+(p.currency||'₼'),'',true).replace('<article ','<article data-instant-plan="'+index+'" ');
   }).join('')||'<p class="home-catalog-status">Hazırda anında təhvil verilən hesab yoxdur<br><a href="/mehsul">Bütün məhsullara bax</a></p>';
   window.dispatchEvent(new Event('mirpanel:catalog-filtered'));return;
  }
  if(grid.querySelector('[data-instant-plan],.home-catalog-status'))grid.innerHTML=originals.get(grid);
  delete grid.dataset.instantScrolled;
  const ids=new Set(products.filter(p=>!selected||p.category===selected||selected==='featured'&&p.bestSeller===true).map(p=>p.id));
  for(const card of grid.querySelectorAll('[data-product-id]'))card.hidden=!ids.has(card.dataset.productId);
  let empty=document.getElementById('catalogCategoryEmpty');
  if(!ids.size&&!empty){empty=document.createElement('p');empty.id='catalogCategoryEmpty';empty.textContent='Məhsul tapılmadı';grid.after(empty);}
  if(empty)empty.hidden=!!ids.size;
 }
 window.addEventListener('mirpanel:route-ready',filterCategory);
 window.addEventListener('mirpanel:catalog-stock',event=>{snapshot=event.detail;filterCategory();});
 window.addEventListener('mirpanel:prices',()=>{if(new URLSearchParams(location.search).get('delivery')==='instant')filterCategory();});
 window.addEventListener('popstate',filterCategory);
 filterCategory();
})();
