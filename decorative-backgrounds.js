(()=>{'use strict';if(window.mirpanelDecorations)return;window.mirpanelDecorations=true;
 const style=document.createElement('link');style.rel='stylesheet';style.href='/decorative-backgrounds.css?v=header-buttons-20261103-2';document.head.append(style);
 const selectors={'wallet-card':'.shop-wallet-hero','header-cart':'#cartHeaderLink,.desktop-cart','header-balance':'.desktop-balance'};
 const desktop=matchMedia('(min-width:1000px)');
 let backgrounds={},last=0,pending=null,scheduled=false;const failed=new Set(),bounds=new Map();
 function positionHeaderArt(img,node){
  if(!img.naturalWidth||!img.naturalHeight)return;let box=bounds.get(img.src);
  if(!box){try{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const{data}=ctx.getImageData(0,0,canvas.width,canvas.height);let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}if(x1<0)return;x0=Math.max(0,x0-4);y0=Math.max(0,y0-4);x1=Math.min(canvas.width-1,x1+4);y1=Math.min(canvas.height-1,y1+4);box={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};bounds.set(img.src,box);if(globalThis.crypto?.subtle){crypto.subtle.digest('SHA-256',data).then(value=>{box.hash=Array.from(new Uint8Array(value),v=>v.toString(16).padStart(2,'0')).join('');syncHeaderIcons();}).catch(()=>{});}}catch{box={x:0,y:0,w:img.naturalWidth,h:img.naturalHeight};}}
  node.style.setProperty('--header-art-ratio',box.w+'/'+box.h);img.style.width=(100*img.naturalWidth/box.w)+'%';img.style.height=(100*img.naturalHeight/box.h)+'%';img.style.left=(-100*box.x/box.w)+'%';img.style.top=(-100*box.y/box.h)+'%';
  syncHeaderIcons();
 }
 function syncHeaderIcons(){
  const cart=document.querySelector('#cartHeaderLink.hasSiteDecoration>.siteDecoration'),hash=cart&&bounds.get(cart.src)?.hash;
  for(const node of document.querySelectorAll('.desktop-balance')){const image=node.querySelector(':scope>.siteDecoration');node.classList.toggle('headerWalletFallback',!!(desktop.matches&&hash&&image&&bounds.get(image.src)?.hash===hash));}
 }
 const valid=(k,url)=>typeof url==='string'&&new RegExp('^/api/payments/backgrounds/'+k+'\\?v=[A-Za-z0-9%_.:-]+$').test(url);
 function draw(){scheduled=false;for(const[k,selector]of Object.entries(selectors))for(const node of document.querySelectorAll(selector)){
  const url=backgrounds[k];let img=node.querySelector(':scope>.siteDecoration');
  if((k!=='wallet-card'&&!desktop.matches)||!valid(k,url)||failed.has(url)){img?.remove();node.classList.remove('hasSiteDecoration','headerWalletFallback');node.style.removeProperty('--header-art-ratio');continue;}
  if(!img){img=document.createElement('img');img.className='siteDecoration';img.alt='';img.setAttribute('aria-hidden','true');img.decoding='async';img.addEventListener('load',()=>{if(k!=='wallet-card')positionHeaderArt(img,node);});img.addEventListener('error',()=>{failed.add(img.getAttribute('src'));node.classList.remove('hasSiteDecoration');img.remove();});node.prepend(img);}
  if(img.getAttribute('src')!==url){node.classList.remove('headerWalletFallback');img.src=url;}if(!node.classList.contains('hasSiteDecoration'))node.classList.add('hasSiteDecoration');
 }}
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(draw);}}
 async function refresh(force=false){if(pending)return pending;if(!force&&Date.now()-last<30000)return;pending=(async()=>{try{const r=await fetch('/api/payments/backgrounds',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)return;const data=await r.json();if(!data.backgrounds||typeof data.backgrounds!=='object')return;backgrounds=data.backgrounds;last=Date.now();schedule();}catch{/* Preserve standard/current view on a transient metadata failure. */}})();try{await pending;}finally{pending=null;}}
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
 window.addEventListener('pageshow',()=>void refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 window.addEventListener('storage',e=>{if(e.key==='mirpanel.decorations.updated')void refresh(true);});
 window.addEventListener('mirpanel:decorations',()=>void refresh(true));window.addEventListener('mirpanel:account',schedule);
 desktop.addEventListener('change',schedule);
 void refresh();schedule();
})();
