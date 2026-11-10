/* Private session prices never enter the public catalog or persistent storage. */
(()=>{'use strict';if(window.MirpanelPricing)return;
 let prices=new Map(),epoch=0,owner=null,known=false,request=null,paused=false;
 const bases=new WeakMap(),key=(id,index)=>JSON.stringify([id,index]);
 const value=(product,index)=>{const row=prices.get(key(product.id,index));return row?row.cents/100:undefined;};
 function attach(products){for(const p of products||[])for(const [index,plan] of (p.plans||[]).entries()){
  if(bases.has(plan))continue;const standard=Number(plan.price);bases.set(plan,standard);
  Object.defineProperty(plan,'price',{enumerable:true,configurable:true,get:()=>value(p,index)??standard});
 }return products;}
 function paint(){
  if(typeof DATA!=='undefined')attach(DATA.products);
  if(typeof renderGrid==='function'&&document.getElementById('grid'))renderGrid();
  for(const card of document.querySelectorAll('.catalog-grid [data-product-id]')){
   const rows=[...prices.values()].filter(x=>x.productId===card.dataset.productId&&x.standardCents>0);
   const minimum=rows.length?Math.min(...rows.map(x=>x.cents)):null;
   if(minimum!==null){const strong=card.querySelector('.homeCardPrices strong');if(strong)strong.textContent=(minimum/100).toFixed(2)+' ₼';}
  }
  window.dispatchEvent(new Event('mirpanel:prices'));
 }
 async function refresh(){
  if(paused)return;if(request)return request;const run=epoch;
  request=(async()=>{try{
   const r=await fetch('/api/payments/shop/prices',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error('PRICES_UNAVAILABLE');const data=await r.json();
   if(run!==epoch||!Array.isArray(data.prices))return;

   owner=data.accountId??null;known=true;prices=new Map(data.prices.map(x=>[key(x.productId,x.planIndex),x]));paint();
  }catch{if(run===epoch){prices.clear();paint();}}
  finally{if(run===epoch)request=null;}})();return request;
 }
 window.MirpanelPricing={attach,refresh,minimum:(id,fallback)=>{const rows=[...prices.values()].filter(x=>x.productId===id&&x.standardCents>0);return rows.length?Math.min(...rows.map(x=>x.cents)):fallback;},standard:plan=>bases.get(plan)??Number(plan.price)};
 window.addEventListener('mirpanel:account',e=>{
  const next=e.detail?.user_id??e.detail?.id??null;if(known&&next===owner)return;known=true;
  ++epoch;request=null;owner=next;prices.clear();paint();void refresh();
 });
 window.addEventListener('mirpanel:route-ready',()=>{paint();void refresh();});
 window.addEventListener('storage',e=>{if(e.key==='mirpanel.auth.signedOut'){++epoch;request=null;prices.clear();owner=null;known=true;paint();void refresh();}});
 window.addEventListener('pagehide',()=>{paused=true;++epoch;request=null;prices.clear();});
 window.addEventListener('pageshow',e=>{paused=false;if(e.persisted){++epoch;request=null;prices.clear();paint();}void refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 void refresh();
})();
