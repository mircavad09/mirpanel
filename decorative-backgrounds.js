(()=>{'use strict';if(window.mirpanelDecorations)return;window.mirpanelDecorations=true;
 const style=document.createElement('link');style.rel='stylesheet';style.href='/decorative-backgrounds.css?v=decorations-20261103';document.head.append(style);
 const selectors={'wallet-card':'.shop-wallet-hero','header-cart':'#cartHeaderLink,.desktop-cart','header-balance':'.desktop-balance'};
 let backgrounds={},last=0,pending=null,scheduled=false;const failed=new Set();
 const valid=(k,url)=>typeof url==='string'&&new RegExp('^/api/payments/backgrounds/'+k+'\\?v=[A-Za-z0-9%_.:-]+$').test(url);
 function draw(){scheduled=false;for(const[k,selector]of Object.entries(selectors))for(const node of document.querySelectorAll(selector)){
  const url=backgrounds[k];let img=node.querySelector(':scope>.siteDecoration');
  if(!valid(k,url)||failed.has(url)){img?.remove();node.classList.remove('hasSiteDecoration');continue;}
  if(!img){img=document.createElement('img');img.className='siteDecoration';img.alt='';img.setAttribute('aria-hidden','true');img.decoding='async';img.addEventListener('error',()=>{failed.add(img.getAttribute('src'));node.classList.remove('hasSiteDecoration');img.remove();});node.prepend(img);}
  if(img.getAttribute('src')!==url)img.src=url;if(!node.classList.contains('hasSiteDecoration'))node.classList.add('hasSiteDecoration');
 }}
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(draw);}}
 async function refresh(force=false){if(pending)return pending;if(!force&&Date.now()-last<30000)return;pending=(async()=>{try{const r=await fetch('/api/payments/backgrounds',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)return;const data=await r.json();if(!data.backgrounds||typeof data.backgrounds!=='object')return;backgrounds=data.backgrounds;last=Date.now();schedule();}catch{/* Preserve standard/current view on a transient metadata failure. */}})();try{await pending;}finally{pending=null;}}
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
 window.addEventListener('pageshow',()=>void refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 window.addEventListener('storage',e=>{if(e.key==='mirpanel.decorations.updated')void refresh(true);});
 window.addEventListener('mirpanel:decorations',()=>void refresh(true));window.addEventListener('mirpanel:account',schedule);
 void refresh();schedule();
})();
