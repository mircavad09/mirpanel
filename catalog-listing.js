/* Read-only sales hydration for the shared static listing cards. */
(()=>{'use strict';const queue=[...document.querySelectorAll('.catalog-grid [data-home-sales-id]')];
 async function worker(){while(queue.length){const line=queue.shift(),id=line.dataset.homeSalesId;try{const r=await fetch('https://mirpanel.onrender.com/api/product-sales?productId='+encodeURIComponent(id),{signal:AbortSignal.timeout(15000)});if(!r.ok)continue;const v=await r.json();if(v.productId!==id||v.initialized!==true||!Number.isSafeInteger(v.productTotal)||v.productTotal<0)continue;line.textContent='≈ '+new Intl.NumberFormat('en-US').format(v.productTotal).replaceAll(',',' ')+'+ satılıb';line.hidden=false;}catch{/* Unknown is not zero. */}}}
 for(let i=0;i<Math.min(queue.length,4);i++)void worker();
})();
