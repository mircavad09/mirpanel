(()=>{'use strict';window.mountBrowserOrders=(options={})=>{const root=document.getElementById('browserOrders');if(!root)return;const life=new AbortController(),on=(t,n,f)=>t.addEventListener(n,f,{signal:life.signal});
 const error=document.getElementById('browserOrdersError'),more=document.getElementById('browserOrdersMore'),dialog=document.getElementById('browserReceipt'),content=document.getElementById('browserReceiptContent');
 let cursor=null,loading=false,loaded=false,generation=0,timer,focused=false,pageFingerprint=null,hasAppended=false,initialRequest=options.initialRequest;const seen=new Set(),requests=new Set(),prior=new Map();
 const target=new URLSearchParams(location.search).get('order');
 const sounds=import('/checkout-sounds.js?v=1').catch(()=>null);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function clear(){generation++;for(const c of requests)c.abort();requests.clear();cursor=null;loading=false;loaded=false;hasAppended=false;pageFingerprint=null;seen.clear();prior.clear();root.replaceChildren();content.replaceChildren();if(dialog.open)dialog.close();more.hidden=true;error.hidden=true;root.setAttribute('aria-busy','false');}
 function gate(){clear();options.onData?.(null);root.classList.remove('browser-orders-list');root.innerHTML='<div class="browser-orders-message"><h2>Sifarişlərinizi görmək üçün hesabınıza daxil olun.</h2><p>Hesabınız yoxdur? Qeydiyyatdan keçin.</p><div class="orders-login-actions"><a class="orders-action" href="/owner-login?next=%2Fsifarislerim">Daxil ol</a> <a class="orders-action" href="/hesab?mode=signup&amp;next=%2Fsifarislerim">Qeydiyyatdan keç</a></div></div>';}
 async function api(path){const c=new AbortController(),t=setTimeout(()=>c.abort(),20000);requests.add(c);try{const r=await fetch('/api/payments/'+path,{cache:'no-store',credentials:'same-origin',signal:c.signal,headers:{Accept:'application/json'}});const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||'Server cavab vermədi.'),{status:r.status});return d;}finally{clearTimeout(t);requests.delete(c);}}
 const money=v=>Number.isFinite(Number(v))?Number(v).toFixed(2).replace('.',',')+' ₼':'—';
 const date=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Baku'}).format(d).replaceAll('/','.').replace(',',''):'Tarix məlum deyil';};
 const statuses={reviewing:'Yoxlanılır',pending:'Yoxlanılır',submitted:'Yoxlanılır',new_receipt_requested:'Yeni çek tələb olunur',preparing:'Hazırlanır',approved:'Hazırlanır',completed:'Tamamlandı',cancelled:'Ləğv edildi',rejected:'Rədd edildi',expired:'Müddəti bitdi'};
 const photo=url=>{let src='';try{const u=new URL(url||'',location.origin);if(url&&['http:','https:'].includes(u.protocol))src=u.href;}catch{}return '<span class="browser-order-image"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 3 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9"/></svg>'+(src?'<img src="'+esc(src)+'" alt="" loading="lazy">':'')+'</span>';};
 function card(o){
  const items=o.items?.length?o.items:[{title:o.product,planName:o.plan,quantity:o.quantity||1,unitCents:o.amount==null?null:Math.round(Number(o.amount)*100)/(o.quantity||1),image:o.image,warranty:o.warranty}];
  const rows=items.map((x,i)=>{const qty=Number(x.quantity),unit=x.unitCents==null?null:Number(x.unitCents)/100;const delivered=(o.deliveries||[]).filter(d=>d.line===i).map(d=>'<div class="browser-order-delivery"><button type="button" data-delivery="'+esc(d.id)+'" aria-expanded="false">Təhvil məlumatını göstər · '+esc(d.quantity)+' ədəd</button><pre hidden></pre></div>').join('');return '<div class="browser-order-line">'+photo(x.image)+'<div class="browser-order-item-info"><h2>'+esc(x.title)+'</h2><p>'+esc(x.planName)+'</p>'+(x.warranty?'<small class="browser-order-warranty">'+esc(x.warranty)+'</small>':'')+'<span class="browser-order-unit">'+esc(qty)+' × '+(unit==null?'—':esc(money(unit)))+'</span>'+delivered+'</div><strong class="browser-order-line-total">'+(unit==null?'—':esc(money(qty*unit)))+'</strong></div>';}).join('');
  return '<details class="browser-order" data-order-id="'+esc(o.id)+'" data-order-code="'+esc(o.orderCode)+'"><summary class="browser-order-header">'+photo(items[0]?.image)+'<div><strong>'+esc(o.product)+'</strong><span class="browser-order-code">Sifariş № '+esc(o.orderCode)+'</span><time>'+esc(date(o.createdAt))+'</time></div><span class="browser-order-status" data-status="'+esc(o.status)+'">'+esc(statuses[o.status]||'Status məlum deyil')+'</span><strong class="browser-order-price">'+(o.amount==null?'—':esc(money(o.amount)))+'</strong><span class="browser-order-arrow" aria-hidden="true">⌄</span></summary><div class="browser-order-items">'+rows+'</div><footer class="browser-order-actions">'+(o.receiptAvailable?'<button type="button" data-receipt="'+esc(o.id)+'">Çekə bax</button>':'')+'</footer></details>';
 }
 function topup(t){const status={reviewing:'Yoxlanılır',approved:'Təsdiqləndi',rejected:'Rədd edildi'}[t.status];if(!status)return '';return '<article class="browser-order browser-order-topup" data-topup-id="'+esc(t.id)+'"><header class="browser-order-header"><div><span class="browser-order-code">Balans artırma</span><time>'+esc(date(t.created_at))+'</time></div><span class="browser-order-status" data-status="'+esc(t.status)+'">'+status+'</span><strong class="browser-order-price">'+esc(money(Number(t.approved_cents??t.requested_cents)/100))+'</strong></header></article>';}
 root.addEventListener('error',e=>{if(e.target.matches?.('.browser-order-image img'))e.target.hidden=true;},{capture:true,signal:life.signal});
 function paint(d,append=false,{live=false}={}){
  if(append)hasAppended=true;else pageFingerprint=JSON.stringify([d.orders,d.topups]);
  const expanded=new Set([...root.querySelectorAll('[data-order-id][open]')].map(x=>x.dataset.orderId));
  if(!append){root.replaceChildren();seen.clear();for(const t of d.topups||[])root.insertAdjacentHTML('beforeend',topup(t));}
  for(const o of d.orders){
   if(seen.has(o.id))continue;seen.add(o.id);root.insertAdjacentHTML('beforeend',card(o));
   const node=root.lastElementChild;
   if(expanded.has(o.id)||(!focused&&target===String(o.orderCode)))node.open=true;
   if(!focused&&target===String(o.orderCode)){focused=true;node.scrollIntoView({block:'nearest'});}
   if(live&&['reviewing','submitted','pending','new_receipt_requested'].includes(prior.get(o.id))&&['preparing','completed'].includes(o.status))void sounds.then(m=>m?.playCheckoutSound('order',o.orderCode));
   prior.set(o.id,o.status);
  }
  loaded=true;root.classList.add('browser-orders-list');if(!seen.size&&!root.querySelector('[data-topup-id]'))root.innerHTML='<div class="browser-orders-message"><h2>Hələ sifarişiniz yoxdur</h2><p>Hesabınıza bağlı sifarişlər burada görünəcək.</p><a class="orders-action" href="/mehsul">Məhsullara bax</a></div>';cursor=d.nextCursor;more.hidden=!cursor;window.dispatchEvent(new CustomEvent('mirpanel:orders-loaded',{detail:{empty:!seen.size&&!root.querySelector('[data-topup-id]')}}));if(!append)options.onData?.(d);
 }
 async function load(append=false,live=false){if(loading)return;const run=generation;loading=true;root.setAttribute('aria-busy','true');more.disabled=true;error.hidden=true;
  try{const started=!append?initialRequest:null;if(started)initialRequest=null;const d=await(started||api('my-orders'+(append&&cursor?'?cursor='+encodeURIComponent(cursor):target?'?order='+encodeURIComponent(target):'')));if(run!==generation)return;options.validate?.(d);
   if(!root.closest('.account-panel')){if(window.MirpanelNavigation)void window.MirpanelNavigation.go('/profil?tab=orders');else location.replace('/profil?tab=orders');return;}
   if(!live||JSON.stringify([d.orders,d.topups])!==pageFingerprint)paint(d,append,{live});
  }catch(e){if(run!==generation)return;if(e.status===401||e.status===403){gate();return;}error.replaceChildren(document.createTextNode('Sifarişləri yükləmək mümkün olmadı. '));error.hidden=false;if(!loaded)root.innerHTML='<div class="browser-orders-message"><button type="button" data-retry>Yenidən cəhd et</button></div>';else{const retry=document.createElement('button');retry.type='button';retry.textContent='Yenidən cəhd et';on(retry,'click',()=>load(append));error.append(retry);}
  }finally{if(run===generation){loading=false;more.disabled=false;root.setAttribute('aria-busy','false');}}
 }
 on(more,'click',()=>load(!!cursor));
 on(root,'click',async e=>{const b=e.target.closest('[data-delivery]');if(!b||b.disabled)return;const p=b.nextElementSibling;
  if(!p.hidden){p.hidden=true;p.textContent='';b.setAttribute('aria-expanded','false');b.textContent=b.dataset.label;return;}
  b.dataset.label=b.textContent;b.disabled=true;const run=generation;
  try{const d=await api('my-orders/codes/'+b.dataset.delivery);if(run!==generation||!b.isConnected)return;p.textContent=d.text;p.hidden=false;b.textContent='Gizlət';b.setAttribute('aria-expanded','true');}
  catch{if(run===generation){error.textContent='Təhvil məlumatını açmaq mümkün olmadı.';error.hidden=false;}}finally{b.disabled=false;}
 });
 root.addEventListener('click',async e=>{if(e.target.closest('[data-retry]'))return void load();const b=e.target.closest('[data-receipt]');if(!b||b.disabled)return;const run=generation;b.disabled=true;try{const d=await api('my-orders/'+encodeURIComponent(b.dataset.receipt)+'/receipt');if(run!==generation)return;const u=new URL(d.url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw Error();content.replaceChildren();const view=document.createElement(d.mime==='application/pdf'?'iframe':'img');view.src=u.href;view.referrerPolicy='no-referrer';if(view.tagName==='IMG')view.alt='Sifarişin ödəniş çeki';else{view.title='Ödəniş çeki PDF';view.setAttribute('sandbox','allow-same-origin');}content.append(view);dialog.showModal();}catch(e){if(run!==generation)return;if(e.status===401||e.status===403)return void gate();error.textContent=e.status===410?'Çek artıq mövcud deyil':'Çeki açmaq mümkün olmadı. Yenidən cəhd edin.';error.hidden=false;}finally{b.disabled=false;}});
 document.getElementById('browserReceiptClose').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('close',()=>content.replaceChildren());
 const start=()=>{clearInterval(timer);timer=setInterval(()=>{if(!document.hidden&&!hasAppended&&!dialog.open&&root.querySelector('[data-status="reviewing"],[data-status="preparing"],[data-status="pending"],[data-status="submitted"],[data-status="new_receipt_requested"]'))load(false,true);},12000);};
 on(window,'mirpanel:account',e=>{if(!e.detail)gate();else if(!loaded)load();});
 on(window,'storage',e=>{if(e.key==='mirpanel.auth.signedOut')gate();});
 // Clear private DOM before bfcache/backgrounding; revalidate on return.
 on(document,'visibilitychange',()=>{if(document.hidden)clear();else load();});
 const dispose=()=>{clearInterval(timer);clear();life.abort();};on(window,'pagehide',dispose);on(window,'pageshow',()=>{start();load();});start();if(options.initial)paint(options.initial);load();window.mirpanelPageDispose=dispose;return dispose;
 };if(!window.mirpanelNavigationMounting&&!window.mirpanelAccountMounting)window.mountBrowserOrders();
})();
