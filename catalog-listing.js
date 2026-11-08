/* Read-only sales figures are fetched near the viewport, not ahead of the next route. */
(()=>{'use strict';if(window.mirpanelCatalogSales)return;window.mirpanelCatalogSales=true;
 let scope=null;
 function stop(){scope?.controller.abort();scope?.observer?.disconnect();scope=null;}
 function start(){
  if(location.pathname!=='/mehsul'||scope)return;
  const nodes=[...document.querySelectorAll('.catalog-grid [data-home-sales-id]:not([data-sales-ready])')];
  if(!nodes.length)return;
  const state={controller:new AbortController(),observer:null,queue:[],busy:0};scope=state;
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
