/* Read-only sales figures are fetched near the viewport, not ahead of the next route. */
(()=>{'use strict';if(window.mirpanelCatalogSales)return;window.mirpanelCatalogSales=true;
 let scope=null;
 async function paintStock(state){
  const response=await fetch('/api/payments/inventory',{signal:AbortSignal.any([state.controller.signal,AbortSignal.timeout(10000)]),cache:'no-store'});
  if(!response.ok)return;
  const {products:inventory}=await response.json();
  const source=document.getElementById('catalogCartProducts');
  if(state!==scope||!source||!Array.isArray(inventory))return;
  const byId=new Map(inventory.map(row=>[row.productId,row]));
  for(const product of JSON.parse(source.textContent)){
   const ledger=byId.get(product.id);
   if(!ledger)continue;
   const price=product.id==='tiktok_jeton'?10:Math.min(...product.plans.filter(p=>Number(p.price)>0).map(p=>Number(p.price)));
   const index=product.plans.findIndex(p=>Number(p.price)===price);
   const plan=ledger.plans?.find(p=>p.planKey===String(index));
   const count=ledger.scope==='product'&&!ledger.unlimited?ledger.available:ledger.scope==='plan'&&plan?.tracked!==false?plan?.available:null;
   const card=document.querySelector('.catalog-grid [data-product-id="'+CSS.escape(product.id)+'"]');
   if(!card)continue;
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
  if(state.stockRequest||document.hidden)return;
  state.stockRequest=paintStock(state).catch(()=>{}).finally(()=>{state.stockRequest=null;});
 }
 function stop(){clearInterval(scope?.stockTimer);scope?.controller.abort();scope?.observer?.disconnect();scope=null;}
 function start(){
  if(location.pathname!=='/mehsul'||scope)return;
  const nodes=[...document.querySelectorAll('.catalog-grid [data-home-sales-id]:not([data-sales-ready])')];
  if(!document.getElementById('catalogCartProducts'))return;
  const state={controller:new AbortController(),observer:null,queue:[],busy:0};scope=state;
  refreshStock(state);
  state.stockTimer=setInterval(()=>refreshStock(state),2000);
  const drain=()=>{while(state.busy<3&&state.queue.length&&!state.controller.signal.aborted){
   const line=state.queue.shift(),id=line.dataset.homeSalesId;state.busy++;
   fetch('https://mirpanel.onrender.com/api/product-sales?productId='+encodeURIComponent(id),{
    priority:'low',signal:AbortSignal.any([state.controller.signal,AbortSignal.timeout(15000)])
   }).then(async r=>{
    if(!r.ok)return;const v=await r.json();
    if(state!==scope||!line.isConnected||v.productId!==id||v.initialized!==true||!Number.isSafeInteger(v.productTotal)||v.productTotal<0)return;
    line.textContent='≈ '+new Intl.NumberFormat('en-US').format(v.productTotal).replaceAll(',',' ')+'+ satılıb';line.hidden=false;line.dataset.salesReady='';
   }).catch(()=>{}).finally(()=>{state.busy--;drain();});
  }};
  if(typeof IntersectionObserver!=='function'){state.queue.push(...nodes);drain();return;}
  const lines=new Map(nodes.map(n=>[n.closest('.card'),n]));
  state.observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){state.observer.unobserve(entry.target);state.queue.push(lines.get(entry.target));}
   drain();
  },{rootMargin:'160px'});
  for(const card of lines.keys())if(card)state.observer.observe(card);
 }
 window.addEventListener('mirpanel:route-leave',stop);
 window.addEventListener('mirpanel:route-ready',start);
 window.addEventListener('pagehide',stop);
 window.addEventListener('pageshow',start);
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
 let status=document.getElementById('catalogCartStatus');
 if(!status){status=document.createElement('p');status.id='catalogCartStatus';status.setAttribute('role','status');document.querySelector('.catalog-grid').before(status);}
 status.textContent='';
 try{
  const [inventory, entry, model]=await Promise.all([
   fetch('/api/payments/inventory',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Stok məlumatı alınmadı.');return r.json();}),
   import('/community-assets/cart-entry.js?v=epinby-account-1'),
   import('/inventory-availability.mjs?v=live-sale-switch-1')
  ]);
  if(!add.isConnected)return;
  const state=model.inventoryAvailability(product,inventory.products.find(p=>p.productId===product.id));
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
 }catch(error){status.textContent=error.message||'Sifariş açıla bilmədi.';}
 finally{delete add.dataset.busy;add.disabled=add.dataset.stockDisabled==='true';}
});
