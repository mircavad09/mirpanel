// Reads verify expiry without extending the session. Only real input renews it.
(()=>{
 let lastSent=0,pending=false,csrf='',expired=false,expiryTimer,sessionRead;
 function expire(){
  if(expired)return;
  expired=true;clearTimeout(expiryTimer);
  window.dispatchEvent(new Event('mirpanel:session-expired'));
 }
 function schedule(value){
  const expiresAt=typeof value==='number'?value:Date.parse(value);
  if(!Number.isFinite(expiresAt)||expired)return;
  clearTimeout(expiryTimer);
  expiryTimer=setTimeout(()=>void verifySession(),Math.max(100,Math.min(2147483647,expiresAt-Date.now())));
 }
 async function verifySession(){
  if(expired)return;
  if(sessionRead)return sessionRead;
  const read=(async()=>{
   try{
    const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(response.status===401){expire();return;}
    if(!response.ok)throw Error('SESSION_UNAVAILABLE');
    const session=await response.json();
    csrf=session.csrfToken||csrf;schedule(session.expiresAt);
   }catch{
    if(!expired){clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>void verifySession(),15000);}
   }
  })();
  sessionRead=read;
  try{await read;}finally{if(sessionRead===read)sessionRead=undefined;}
 }
 async function activity(event){
  if(!event.isTrusted||document.hidden||pending||expired||Date.now()-lastSent<30000)return;
  pending=true;
  try{
   if(!csrf){await verifySession();if(!csrf||expired)return;}
   const response=await fetch('/api/session/activity',{method:'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'X-CSRF-Token':csrf}});
   if(response.status===401){expire();return;}
   if(response.ok){lastSent=Date.now();schedule((await response.json()).expiresAt);}
  }catch{/* A failed activity request does not prove the session ended. */}
  finally{pending=false;}
 }
 for(const name of ['pointerdown','keydown','input','change','wheel','touchstart'])document.addEventListener(name,activity,{capture:true,passive:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void verifySession();});
 window.addEventListener('pageshow',()=>void verifySession());
 for(const name of ['mirpanel:session-expired','mirpanel:admin-logout'])window.addEventListener(name,()=>{expired=true;csrf='';clearTimeout(expiryTimer);});
 void verifySession();
})();
