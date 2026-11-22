// Read/resource recovery only. Mutation callers retain their own operation keys.
(()=>{'use strict';if(window.MirpanelRecovery)return;
 const delays=[1000,3000,7000],imports=new Map(),failures=new Map();let serial=0;
 const abort=()=>new DOMException('Bölmə dəyişib.','AbortError');
 const check=signal=>{if(signal?.aborted)throw abort();};
 function retryAfter(value){if(!value)return 30000;const n=Number(value);return Number.isFinite(n)?Math.max(0,n*1000):Math.max(0,Date.parse(value)-Date.now())||30000;}
 const transient=e=>e?.name!=='AbortError'&&(e?.name==='TypeError'||e?.name==='TimeoutError'||e?.retryable===true||[408,429,500,502,503,504].includes(e?.status));
 function pause(ms,signal){check(signal);return new Promise((resolve,reject)=>{const timer=setTimeout(done,ms);function done(){signal?.removeEventListener('abort',cancel);resolve();}function cancel(){clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(abort());}signal?.addEventListener('abort',cancel,{once:true});});}
 function online(signal,notify){check(signal);if(navigator.onLine!==false)return Promise.resolve();notify?.('offline');return new Promise((resolve,reject)=>{function clean(){window.removeEventListener('online',ready);signal?.removeEventListener('abort',cancel);}function ready(){if(navigator.onLine===false)return;clean();resolve();}function cancel(){clean();reject(abort());}window.addEventListener('online',ready);signal?.addEventListener('abort',cancel,{once:true});ready();});}
 function message(id,phase){window.dispatchEvent(new CustomEvent('mirpanel:recovery',{detail:{id,phase}}));}
 async function run(task,{signal,onState,attempts=3}={}){
  const id=++serial,notify=phase=>{message(id,phase);onState?.(phase);};let last;
  try{for(let attempt=0;attempt<=attempts;attempt++){
   await online(signal,notify);check(signal);
   try{const value=await task(attempt);check(signal);return value;}catch(e){check(signal);last=e;if(!transient(e)||attempt===attempts)throw e;notify('recovering');await pause(Math.max(delays[attempt]||7000,e.retryAfterMs||0),signal);}
  }throw last;}finally{notify('done');}
 }
 async function once(url,options={},timeout=15000){
  const c=new AbortController(),signal=options.signal,stop=()=>c.abort();check(signal);signal?.addEventListener('abort',stop,{once:true});let timed=false;
  const timer=setTimeout(()=>{timed=true;c.abort();},timeout);
  try{const response=await fetch(url,{...options,signal:c.signal});await response.clone().arrayBuffer();return response;}catch(e){check(signal);if(timed)throw new DOMException('Serverin cavabı gecikir.','TimeoutError');throw e;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
 }
 async function read(url,options={},settings={}){
  const method=(options.method||'GET').toUpperCase();
  // A POST quote is an explicitly permitted read, never an order/payment write.
  const quote=settings.quote===true&&method==='POST'&&new URL(url,location.href).pathname==='/api/payments/shop/quote';
  if(!['GET','HEAD'].includes(method)&&!quote)return once(url,options,settings.timeout);
  return run(async()=>{const response=await once(url,options,settings.timeout);if([408,429,500,502,503,504].includes(response.status)){const e=Object.assign(Error('Server müvəqqəti əlçatan deyil.'),{status:response.status,retryAfterMs:response.status===429?retryAfter(response.headers.get('Retry-After')):0});void response.body?.cancel().catch(()=>{});throw e;}return response;},{...settings,signal:options.signal});
 }
 // Keep the physical import alive after a deadline: a slow evaluation must not
 // execute a second time. Only a rejected import gets a fresh URL on retry.
 async function module(url,{signal,timeout=15000,onState}={}){
  const absolute=new URL(url,location.href).href;
  return run(async()=>{
   let entry=imports.get(absolute);
   if(!entry){
    const count=failures.get(absolute)||0,u=new URL(absolute);
    if(count)u.searchParams.set('loadRetry',String(count));
    entry=(async()=>{
     // This physical load is shared; a departing subscriber cannot cancel
     // another route's resource. Subscriber signals still cancel every wait.
     const response=await once(u.href,{cache:count?'reload':'default'},timeout);
     if(!response.ok){void response.body?.cancel().catch(()=>{});throw Object.assign(Error('Bölmə resursu yüklənmədi.'),{status:response.status,retryAfterMs:response.status===429?retryAfter(response.headers.get('Retry-After')):0});}
     return import(u.href);
    })();imports.set(absolute,entry);
    void entry.catch(()=>{if(imports.get(absolute)===entry){imports.delete(absolute);failures.set(absolute,count+1);}});
   }
   let timer,stop;
   try{return await Promise.race([entry,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new DOMException('Bölmə resursu gecikir.','TimeoutError')),timeout);stop=()=>reject(abort());signal?.addEventListener('abort',stop,{once:true});check(signal);})]);}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
  },{signal,onState});
 }
 // Exhausted reads may resume on a real reconnect or hidden -> visible change.
 // One bounded batch per event, never polling or reloading a page/form.
 function watch(task,{signal}={}){let busy=false,failed=false,wasHidden=document.hidden;const start=async()=>{if(busy||signal?.aborted)return;busy=true;try{await task();failed=false;}catch(e){failed=transient(e);throw e;}finally{busy=false;}};const resume=()=>{if(failed&&!busy)void start().catch(()=>{});};window.addEventListener('online',resume,{signal});document.addEventListener('visibilitychange',()=>{const returned=wasHidden&&!document.hidden;wasHidden=document.hidden;if(returned)resume();},{signal});return start;}
 const scripts=new Map();
 function script(node){const url=node.src;if(scripts.has(url))return scripts.get(url);const page=location.href;
  const request=run(async()=>{if(location.href!==page)throw abort();const response=await once(url,{cache:'reload'});if(!response.ok)throw Object.assign(Error('Bölmə resursu yüklənmədi.'),{status:response.status,retryAfterMs:response.status===429?retryAfter(response.headers.get('Retry-After')):0});const code=await response.text();if(location.href!==page)throw abort();const next=document.createElement('script');next.dataset.recoveryScript='';if(node.nonce)next.nonce=node.nonce;next.textContent=code;node.after(next);}).finally(()=>scripts.delete(url));scripts.set(url,request);return request;
 }
 async function style(node,{signal}={}){const url=node.href,page=location.href;return run(async attempt=>{if(location.href!==page)throw abort();const response=await once(url,{signal,cache:'reload'});if(!response.ok)throw Object.assign(Error('Bölmənin üslubları yüklənmədi.'),{status:response.status,retryAfterMs:response.status===429?retryAfter(response.headers.get('Retry-After')):0});check(signal);if(location.href!==page)throw abort();
  return new Promise((resolve,reject)=>{const next=node.cloneNode(false),u=new URL(url);u.searchParams.set('styleRetry',String(attempt+1));next.href=u.href;next.dataset.recoveryScript='';const timer=setTimeout(()=>finish(new DOMException('Üslub gecikir.','TimeoutError')),15000),cancel=()=>finish(abort());function finish(error){clearTimeout(timer);signal?.removeEventListener('abort',cancel);next.onload=next.onerror=null;if(error){next.remove();reject(error);}else resolve();}next.onload=()=>finish();next.onerror=()=>finish(Object.assign(Error('Üslub yüklənmədi.'),{retryable:true}));signal?.addEventListener('abort',cancel,{once:true});if(node.isConnected)node.replaceWith(next);else document.head.append(next);node=next;});
 },{signal});}
 window.MirpanelRecovery={read,module,script,style,run,watch,retryAfter,transient,pause};
 // Covers initial-document entry failures too, before any route/module can run.
 const entries=new Set(['app.js','home-loading.js','catalog-card.js','catalog-listing.js','product-page.js','page-navigation.js','cart-store.js','browser-orders.js','site-header.js','account-header.js','shop-ui.js','profile-entry.js','community.js']);
 window.addEventListener('error',event=>{const node=event.target;if(node?.dataset?.routeManaged!==undefined)return;const isStyle=node?.tagName==='LINK'&&node.rel==='stylesheet';if(!isStyle&&(node?.tagName!=='SCRIPT'||!node.src)||node?.dataset.recoveryScript!==undefined)return;const u=new URL(isStyle?node.href:node.src);if(u.origin!==location.origin||!isStyle&&!entries.has(u.pathname.split('/').at(-1)))return;
  const life=new AbortController(),at=location.href;window.addEventListener('mirpanel:route-change',()=>{if(location.href!==at)life.abort();},{signal:life.signal});window.addEventListener('pagehide',()=>life.abort(),{once:true});let retry;
  const start=watch(async()=>{retry?.remove();try{if(isStyle)await style(node,{signal:life.signal});else if(node.type==='module')await module(node.src,{signal:life.signal});else await script(node);}catch(e){if(life.signal.aborted)return;if(!retry){retry=document.createElement('div');retry.dataset.shellPersistent='';retry.setAttribute('role','alert');retry.style.cssText='padding:12px;background:#191d22;color:#edf1f6;font:14px system-ui';document.body.append(retry);}retry.replaceChildren(document.createTextNode('Yükləmə alınmadı. '));const button=document.createElement('button');button.textContent='Yenidən cəhd et';button.onclick=()=>void start().catch(()=>{});retry.append(button);throw e;}},{signal:life.signal});void start().catch(()=>{});
 },true);
 const pending=new Set();let notice;
 window.addEventListener('mirpanel:recovery',e=>{const {id,phase}=e.detail;if(phase==='done')pending.delete(id);else pending.add(id);if(!notice&&document.body){notice=document.createElement('div');notice.dataset.shellPersistent='';notice.setAttribute('role','status');notice.style.cssText='position:fixed;z-index:1100;bottom:86px;left:50%;transform:translateX(-50%);max-width:90vw;padding:8px 12px;border-radius:10px;background:#191d22;color:#edf1f6;font:13px/1.4 system-ui;pointer-events:none';document.body.append(notice);}if(notice){notice.hidden=!pending.size;notice.textContent=phase==='offline'?'İnternet bağlantısı gözlənilir…':'Bağlantı bərpa olunur…';}});
})();
