// Only real input renews idle expiry. Polling and an open tab are not activity.
(()=>{let lastSent=0,pending=false,csrf='',expired=false;
 async function activity(event){
  if(!event.isTrusted||document.hidden||pending||expired||Date.now()-lastSent<30000)return;
  pending=true;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   if(!csrf){const r=await fetch('/api/session',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(r.status===401){expired=true;window.dispatchEvent(new Event('mirpanel:session-expired'));return;}if(!r.ok)return;csrf=(await r.json()).csrfToken;}
   const r=await fetch('/api/session/activity',{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'X-CSRF-Token':csrf}});
   if(r.ok)lastSent=Date.now();else if(r.status===401){expired=true;window.dispatchEvent(new Event('mirpanel:session-expired'));}
  }catch{/* A failed keepalive must not discard the editor or claim success. */}finally{clearTimeout(timer);pending=false;}
 }
 for(const name of ['pointerdown','keydown','input','change','wheel','touchstart'])document.addEventListener(name,activity,{capture:true,passive:true});
})();
