(()=>{'use strict';window.mountBrowserOrders=(options={})=>{const root=document.getElementById('browserOrders');if(!root)return;const life=new AbortController(),on=(t,n,f)=>t.addEventListener(n,f,{signal:life.signal});
 const error=document.getElementById('browserOrdersError'),more=document.getElementById('browserOrdersMore'),dialog=document.getElementById('browserReceipt'),content=document.getElementById('browserReceiptContent');
 let cursor=null,loading=false,loaded=false,generation=0,timer,focused=false,pageFingerprint=null,hasAppended=false,initialRequest=options.initialRequest,autoOrder=null;const seen=new Set(),requests=new Set(),prior=new Map();
 const target=new URLSearchParams(location.search).get('order');
 const sounds=import('/checkout-sounds.js?v=1').catch(()=>null);
 const repeatDialog=document.createElement('dialog');repeatDialog.className='browser-order-repeat';
 const guideDialog=document.createElement('dialog'),guideItems=new WeakMap();
 guideDialog.className='browser-order-guide';guideDialog.setAttribute('aria-labelledby','browserOrderGuideTitle');
 let guideTurn=0;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function clear(){generation++;guideTurn++;for(const c of requests)c.abort();requests.clear();cursor=null;loading=false;loaded=false;hasAppended=false;pageFingerprint=null;seen.clear();prior.clear();autoOrder=null;focused=false;if(guideDialog.open)guideDialog.close();guideDialog.remove();root.replaceChildren();content.replaceChildren();if(dialog.open)dialog.close();if(repeatDialog.open)repeatDialog.close();repeatDialog.remove();more.hidden=true;error.hidden=true;root.setAttribute('aria-busy','false');}
 function gate(){clear();options.onData?.(null);root.classList.remove('browser-orders-list');root.innerHTML='<div class="browser-orders-message"><h2>Sifarişlərinizi görmək üçün hesabınıza daxil olun.</h2><p>Hesabınız yoxdur? Qeydiyyatdan keçin.</p><div class="orders-login-actions"><a class="orders-action" href="/owner-login?next=%2Fsifarislerim">Daxil ol</a> <a class="orders-action" href="/hesab?mode=signup&amp;next=%2Fsifarislerim">Qeydiyyatdan keç</a></div></div>';}
 async function api(path){const c=new AbortController(),t=setTimeout(()=>c.abort(),options.profile?12000:20000);requests.add(c);try{const r=await fetch('/api/payments/'+path,{cache:'no-store',credentials:'same-origin',signal:c.signal,headers:{Accept:'application/json'}});if(r.status===401&&!life.signal.aborted)options.onUnauthorized?.();const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||'Server cavab vermədi.'),{status:r.status});return d;}finally{clearTimeout(t);requests.delete(c);}}
 const money=v=>Number.isFinite(Number(v))?Number(v).toFixed(2).replace('.',',')+' ₼':'—';
 const date=value=>{const d=new Date(value);return value&&Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Baku'}).format(d).replaceAll('/','.').replace(',',''):'Tarix məlum deyil';};
 const statuses={reviewing:'Yoxlanılır',pending:'Yoxlanılır',submitted:'Yoxlanılır',new_receipt_requested:'Yeni çek tələb olunur',preparing:'Hazırlanır',approved:'Hazırlanır',completed:'Tamamlandı',cancelled:'Ləğv edildi',rejected:'Rədd edildi',expired:'Müddəti bitdi'};
 const photo=url=>{let src='';try{const u=new URL(url||'',location.origin);if(url&&['http:','https:'].includes(u.protocol))src=u.href;}catch{}return '<span class="browser-order-image"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 3 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9"/></svg>'+(src?'<img src="'+esc(src)+'" alt="" loading="lazy">':'')+'</span>';};
 const icons={completed:'✅',preparing:'⏳',approved:'⏳',rejected:'❌'};
 const lineIcon=path=>'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';
 const docIcon=lineIcon('M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6');
 const copyIcon=lineIcon('M8 8h12v12H8z M16 8V4H4v12h4');
 const repeatIcon=lineIcon('M3 12a9 9 0 1 1 2.6 6.4 M3 4v8h8');
 const clockIcon=lineIcon('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2');
 const bakuCalendar=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'});
 function expiryBar(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
  const end=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(+end)||end.toISOString().slice(0,10)!==value)return '';
  const parts=Object.fromEntries(bakuCalendar.formatToParts(new Date()).map(x=>[x.type,x.value]));
  const days=(+end-Date.UTC(+parts.year,+parts.month-1,+parts.day))/86400000;
  const label=days<=0?'Paketin müddəti bitib':days>=28&&days<=31?'Bu paketin müddəti təxminən 1 ay sonra bitir':'Bu paketin müddəti '+days+' gün sonra bitir';
  return '<div class="browser-order-expiry"'+(days<=0?' data-expired':'')+'>'+clockIcon+'<span>'+label+'</span><time datetime="'+value+'">'+value.split('-').reverse().join('.')+' · Bakı vaxtı</time></div>';
 }
 const repeats=new WeakMap();
 function orderItems(o){return o.items?.length?o.items:[{title:o.product,planName:o.plan,quantity:o.quantity||1,unitCents:o.amount==null?null:Math.round(Number(o.amount)*100)/(o.quantity||1),image:o.image,warranty:o.warranty,durationMonths:o.durationMonths,repeat:o.repeat,expiresOn:o.expiresOn}];}
 function card(o,items){
  const rows=items.map((x,i)=>{
   const qty=Number(x.quantity),unit=x.unitCents==null?null:Number(x.unitCents)/100;
   const duration=Number(x.durationMonths);
   const extraDuration=Number.isInteger(duration)&&duration>0&&!new RegExp('(?:^|\\D)'+duration+'\\s*ay','iu').test(x.planName||'')?' · '+duration+' ay':'';
   const delivered=(['preparing','completed'].includes(o.status)?o.deliveries||[]:[]).filter(d=>d.line===i).map(d=>'<article class="browser-order-delivery" data-delivery="'+esc(d.id)+'"><header><span>'+esc(x.title)+' · '+esc(x.planName)+(d.quantity>1?' · '+esc(d.quantity)+' ədəd':'')+'</span><button type="button" data-copy-delivery disabled>'+copyIcon+'Kopyala</button></header><div class="browser-delivery-credentials"></div><pre hidden></pre><span role="status" data-delivery-status></span></article>').join('');
   return '<section class="browser-order-line"><div class="browser-order-line-main"><div class="browser-order-item-info"><h2>'+esc(x.title)+'</h2><div class="browser-order-line-meta"><span>'+esc(x.planName)+esc(extraDuration)+'</span>'+(x.warranty?'<small class="browser-order-warranty">'+esc(x.warranty)+'</small>':'')+'<strong class="browser-order-unit">'+esc(qty)+' × '+(unit==null?'—':esc(money(unit)))+'</strong></div></div><div class="browser-order-line-buttons"><button type="button" data-order-info="'+i+'" aria-haspopup="dialog" aria-expanded="false">'+docIcon+'Məlumat və təlimat</button><button type="button" data-buy-again="'+i+'">'+repeatIcon+'Yenidən al</button></div></div>'+(delivered?expiryBar(x.expiresOn):'')+'<div class="browser-order-instructions" hidden>'+(delivered?'<h3>Alınmış hesablar</h3>'+delivered:'<p>'+(o.status==='completed'?'Status: Tamamlandı. Bu məhsul üçün ayrıca təhvil məlumatı yoxdur.':'Status: '+esc(statuses[o.status]||'Status məlum deyil')+'. Təhvil məlumatı hazır deyil.')+'</p>')+'<span role="status" data-line-feedback></span></div></section>';
  }).join('');
  const total=o.amount==null?'—':esc(money(o.amount));
  return '<details class="browser-order" data-order-id="'+esc(o.id)+'" data-order-code="'+esc(o.orderCode)+'"><summary class="browser-order-header">'+photo(items[0]?.image)+'<div class="browser-order-heading"><div class="browser-order-meta"><span class="browser-order-status" data-status="'+esc(o.status)+'">'+(icons[o.status]?'<span aria-hidden="true">'+icons[o.status]+'</span> ':'')+esc(statuses[o.status]||'Status məlum deyil')+'</span><span class="browser-order-code">№ '+esc(o.orderCode)+'</span><time>'+esc(date(o.createdAt))+'</time></div><strong>'+esc(o.product)+'</strong></div><strong class="browser-order-price">'+total+'</strong><svg class="browser-order-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div class="browser-order-items">'+rows+'</div><div class="browser-order-actions browser-order-footer"><div class="browser-order-total"><span>Cəmi</span><strong class="browser-order-price">'+total+'</strong></div>'+(o.receiptAvailable?'<button type="button" data-receipt="'+esc(o.id)+'">Qəbzə bax</button>':'')+'</div></details>';
 }
 function topup(t){const status={reviewing:'Yoxlanılır',approved:'Təsdiqləndi',rejected:'Rədd edildi'}[t.status];if(!status)return '';return '<article class="browser-order browser-order-topup" data-topup-id="'+esc(t.id)+'"><header class="browser-order-header"><div><span class="browser-order-code">Balans artırma</span><time>'+esc(date(t.created_at))+'</time></div><span class="browser-order-status" data-status="'+esc(t.status)+'">'+status+'</span><strong class="browser-order-price">'+esc(money(Number(t.approved_cents??t.requested_cents)/100))+'</strong></header></article>';}
 root.addEventListener('error',e=>{if(e.target.matches?.('.browser-order-image img'))e.target.hidden=true;},{capture:true,signal:life.signal});
 const latestCompleted=d=>d.orders.find(order=>order.status==='completed')?.id??null;
 function paint(d,append=false,{live=false}={}){
  hasAppended=append;
  if(!append)pageFingerprint=JSON.stringify([d.orders,d.topups]);
  const expanded=new Set([...root.querySelectorAll('[data-order-id][open]')].map(x=>x.dataset.orderId));
  if(!target&&(!append||!autoOrder)){
   const newest=latestCompleted(d);
   if(newest!==autoOrder){
    expanded.delete(autoOrder);
    if(newest)expanded.add(newest);
    autoOrder=newest;
   }
  }
  if(!append){root.replaceChildren();seen.clear();for(const t of d.topups||[])root.insertAdjacentHTML('beforeend',topup(t));}
  for(const o of d.orders){
   if(seen.has(o.id))continue;seen.add(o.id);const items=orderItems(o);root.insertAdjacentHTML('beforeend',card(o,items));
   const node=root.lastElementChild;
   repeats.set(node,items.map(x=>x.repeat));guideItems.set(node,items);
   if(expanded.has(o.id)||(!focused&&target===String(o.orderCode)))node.open=true;
   if(node.open)showAccounts(node);
   if(!focused&&target===String(o.orderCode)){
    focused=true;node.scrollIntoView({block:'nearest'});
   }
   if(node.open)showAccounts(node);
   if(live&&['reviewing','submitted','pending','new_receipt_requested'].includes(prior.get(o.id))&&['preparing','completed'].includes(o.status))void sounds.then(m=>m?.playCheckoutSound('order',o.orderCode));
   prior.set(o.id,o.status);
  }
  loaded=true;root.classList.add('browser-orders-list');if(!seen.size&&!root.querySelector('[data-topup-id]'))root.innerHTML='<div class="browser-orders-message"><h2>Hələ sifarişiniz yoxdur</h2><p>Hesabınıza bağlı sifarişlər burada görünəcək.</p><a class="orders-action" href="/mehsul">Məhsullara bax</a></div>';cursor=d.nextCursor;more.hidden=!cursor;window.dispatchEvent(new CustomEvent('mirpanel:orders-loaded',{detail:{empty:!seen.size&&!root.querySelector('[data-topup-id]')}}));if(!append)options.onData?.(d);
 }
 async function load(append=false,live=false){if(loading)return;const run=generation;loading=true;root.setAttribute('aria-busy','true');more.disabled=true;error.hidden=true;
  try{const started=!append?initialRequest:null;if(started)initialRequest=null;const d=await(started||api('my-orders'+(append&&cursor?'?cursor='+encodeURIComponent(cursor):target?'?order='+encodeURIComponent(target):'')));if(run!==generation)return;options.validate?.(d);
   if(live&&(dialog.open||guideDialog.open||repeatDialog.open))return;
   if(!root.closest('.account-panel')){if(window.MirpanelNavigation)void window.MirpanelNavigation.go('/profil?tab=orders');else location.replace('/profil?tab=orders');return;}
   if(live&&hasAppended&&(target||!latestCompleted(d)||latestCompleted(d)===autoOrder))return;
   if(append||!loaded||JSON.stringify([d.orders,d.topups])!==pageFingerprint)paint(d,append,{live});
  }catch(e){if(run!==generation)return;if(e.status===401||e.status===403){if(e.status===401&&options.onUnauthorized)options.onUnauthorized();else gate();return;}error.replaceChildren(document.createTextNode('Sifarişləri yükləmək mümkün olmadı. '));error.hidden=false;if(!loaded)root.innerHTML='<div class="browser-orders-message"><button type="button" data-retry>Yenidən cəhd et</button></div>';else{const retry=document.createElement('button');retry.type='button';retry.textContent='Yenidən cəhd et';on(retry,'click',()=>load(append));error.append(retry);}
  }finally{if(run===generation){loading=false;more.disabled=false;root.setAttribute('aria-busy','false');}}
 }
 on(more,'click',()=>load(!!cursor));
 const deliveryData=new WeakMap(),deliveryLoads=new WeakMap(),copyTimers=new WeakMap();
 function hideInfo(panel){
  panel.hidden=true;
  for(const box of panel.querySelectorAll('[data-delivery]')){
   deliveryData.delete(box);deliveryLoads.delete(box);
   clearTimeout(copyTimers.get(box));box.querySelector('[data-delivery-status]').replaceChildren();
   box.querySelector('.browser-delivery-credentials').replaceChildren();
   const pre=box.querySelector('pre');pre.textContent='';pre.hidden=true;box.querySelector('[data-copy-delivery]').disabled=true;
  }
  panel.closest('.browser-order-line').querySelector('[data-order-info]').setAttribute('aria-expanded','false');
 }
 function showAccounts(order){
  if(document.hidden)return;
  for(const panel of order.querySelectorAll('.browser-order-instructions')){
   const boxes=panel.querySelectorAll('[data-delivery]');if(!boxes.length)continue;
   panel.hidden=false;panel.closest('.browser-order-line').querySelector('[data-order-info]').setAttribute('aria-expanded','true');
   for(const box of boxes)void loadDelivery(box);
  }
 }
 root.addEventListener('toggle',e=>{if(e.target.matches?.('[data-order-id]')){if(e.target.open)showAccounts(e.target);else e.target.querySelectorAll('.browser-order-instructions').forEach(hideInfo);}},{capture:true,signal:life.signal});
 async function loadDelivery(box){
  if(deliveryLoads.has(box)||deliveryData.has(box))return;
  const token={},status=box.querySelector('[data-delivery-status]');
  deliveryLoads.set(box,token);status.textContent='Təhvil məlumatı yüklənir…';
  const valid=()=>deliveryLoads.get(box)===token&&box.isConnected&&box.closest('details').open&&!document.hidden;
  try{
   const d=await api('my-orders/codes/'+encodeURIComponent(box.dataset.delivery));
   if(!valid())return;
   if(typeof d.text!=='string')throw Error();
   const rows=[['email','E-poçt'],['password','Şifrə']].filter(([key])=>typeof d[key]==='string'&&d[key]);
   box.querySelector('.browser-delivery-credentials').innerHTML=rows.map(([key,label])=>'<div><span>'+label+'</span><strong>'+esc(d[key])+'</strong><button type="button" data-copy-delivery-field="'+key+'" aria-label="'+label+' kopyala">'+copyIcon+'</button></div>').join('');
   const pre=box.querySelector('pre');pre.textContent=d.text;pre.hidden=false;
   deliveryData.set(box,{d,rows});box.querySelector('[data-copy-delivery]').disabled=false;status.textContent='';
  }catch(e){
   if(valid()&&(e.status===401||e.status===403)){gate();return;}
   if(valid())status.innerHTML='Təhvil məlumatı alınmadı. <button type="button" data-retry-delivery>Yenidən cəhd et</button>';
  }finally{if(deliveryLoads.get(box)===token)deliveryLoads.delete(box);}
 }
 async function copyDelivery(button){
  const box=button.closest('[data-delivery]'),data=deliveryData.get(box);if(!data)return;
  const {d,rows}=data,field=button.dataset.copyDeliveryField,status=box.querySelector('[data-delivery-status]');
  const text=field?d[field]:[...rows.map(([key,label])=>label+': '+d[key]),...(rows.length?['']:[]),d.text].join('\n');
  try{
   if(navigator.clipboard?.write&&typeof ClipboardItem==='function')await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'})})]);
   else await navigator.clipboard.writeText(text);
   if(deliveryData.get(box)!==data)return;
   status.textContent='Kopyalandı';clearTimeout(copyTimers.get(box));copyTimers.set(box,setTimeout(()=>{status.textContent='';},1800));
  }catch{if(deliveryData.get(box)===data)status.textContent='Kopyalamaq mümkün olmadı.';}
 }
 function renderInformation(text){
  const content=document.createElement('div');
  content.className='browser-guide-information';
  let block=null;
  for(const raw of text.split(/\r?\n/)){
   const line=raw.trim();
   if(!line){block=null;continue;}
   const heading=line.match(/^#{1,6}\s+(.+)$/);
   if(heading){
    const title=document.createElement('h3');title.textContent=heading[1];content.append(title);block=null;continue;
   }
   const bullet=line.match(/^([-*•]|\d+[.)])\s+(.+)$/);
   const tag=bullet?(/^\d/.test(bullet[1])?'ol':'ul'):'p';
   if(block?.localName!==tag){
    block=document.createElement(tag);
    if(tag==='p')block.className='browser-guide-text';
    if(tag==='ol')block.start=parseInt(bullet[1],10);
    content.append(block);
   }
   if(bullet){
    const item=document.createElement('li');item.textContent=bullet[2];block.append(item);
   }else block.append((block.textContent?'\n':'')+line);
  }
  return content;
 }
 function openGuide(trigger,accounts){
  const order=trigger.closest('[data-order-id]'),index=Number(trigger.dataset.orderInfo),item=guideItems.get(order)?.[index];
  if(!item||guideDialog.open)return;
  const create=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(label,action)=>{const b=create('button',label);b.type='button';b.onclick=action;return b;};
  const wrap=create('div',null,'browser-guide-frame'),header=create('header',null,'browser-guide-header'),title=create('h2',item.title);title.id='browserOrderGuideTitle';
  const identity=create('div');identity.append(title,create('p',item.planName));
  const close=button('×',()=>guideDialog.close());close.setAttribute('aria-label','Təlimatı bağla');
  const head=create('div',null,'browser-guide-identity');head.append(identity,close);
  const tabs=create('div',null,'browser-guide-tabs'),body=create('div',null,'browser-guide-body'),footer=create('footer');
  tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Təlimat bölmələri');
  footer.append(button('Bağla',()=>guideDialog.close()));
  let data=null,failed=false,active='info',track='',step=0,autoplay=false,advanceTimer;
  const info=button('Məlumat',()=>select('info')),how=button('Təlimat',()=>select('steps'));tabs.append(info,how);
  function select(mode){autoplay=false;active=mode;body.scrollTop=0;draw();}
  function draw(){
   clearTimeout(advanceTimer);
   info.setAttribute('aria-pressed',String(active==='info'));how.setAttribute('aria-pressed',String(active==='steps'));
   body.replaceChildren();
   if(failed){body.append(create('p','Təlimat alınmadı.'),button('Yenidən cəhd et',loadGuide));return;}
   if(!data){const loading=create('p','Məlumat hazırlanır…');loading.setAttribute('role','status');body.append(loading);return;}
   if(active==='info'){
    if(data.information)body.append(create('div','İstifadə etməzdən əvvəl oxuyun','browser-guide-note'));
    body.append(data.information?renderInformation(data.information):create('p','Bu məhsul üçün məlumat əlavə edilməyib.','browser-guide-text'));return;
   }
   const tracks=Object.entries({general:'Ümumi addımlar',phone:'Telefonda giriş',desktopQr:'Kompüterdə QR ilə giriş'}).filter(([key])=>data.tracks?.[key]?.length);
   if(!tracks.length){body.append(create('p','Bu paket üçün şəkilli təlimat əlavə edilməyib.'));return;}
   if(!tracks.some(([key])=>key===track))track=tracks[0][0];
   const choices=create('div',null,'browser-guide-choices');
   for(const [key,label] of tracks){const b=button(key==='phone'&&data.tracks[key].some(s=>s.animation)?'CapCut-a daxil ol':label,()=>{autoplay=false;track=key;step=0;draw();});b.setAttribute('aria-pressed',String(track===key));choices.append(b);}
   const steps=data.tracks[track],current=steps[step],layout=create('div',null,'browser-guide-step');
   const compact=track==='phone'&&steps.some(item=>item.animation);
   if(compact)layout.classList.add('browser-guide-compact');
   const visual=create('div',null,'browser-guide-visual');
   try{
    const u=new URL(current.image,location.origin);
    if((u.protocol==='https:'||u.origin===location.origin)&&!u.username&&!u.password){
     const img=create('img');img.src=u.href;img.alt='Addım '+(step+1);img.referrerPolicy='no-referrer';
     const frame=create('div',null,'browser-guide-phone');
     frame.append(img);
     if(['ben','sign-in','email','password','pro'].includes(current.animation)){
      frame.dataset.animation=current.animation;
      const highlight=create('span',null,'browser-guide-highlight');
      highlight.setAttribute('aria-hidden','true');frame.append(highlight);
      if(current.animation==='email'||current.animation==='password'){
       const typing=create('span',current.animation==='email'?'numune@example.com':'********','browser-guide-typing');
       typing.setAttribute('aria-hidden','true');frame.append(typing);
      }
      if(current.animation==='password')frame.append(create('span',null,'browser-guide-continue'));
     }
     img.addEventListener('error',()=>visual.replaceChildren(create('span','Şəkil açıla bilmədi.')),{once:true});
     visual.append(frame);
    }
   }catch{}
   const details=create('div');
   const description=create('p',current.description,'browser-guide-text');description.setAttribute('aria-live','polite');
   if(compact){
    const number=create('strong',String(step+1),'browser-guide-step-number');
    number.setAttribute('aria-label','Addım '+(step+1)+' / '+steps.length);
    description.prepend(number);
   }else details.append(create('strong','Addım '+(step+1)+' / '+steps.length,'browser-guide-note'));
   const nav=create('div',null,'browser-guide-controls');
   const go=(index,focus)=>{
    if(index<0||index>=steps.length)return;
    autoplay=false;step=index;draw();
    if(focus)body.querySelector('.browser-guide-controls button'+focus+':not(:disabled),.browser-guide-controls button:not(:disabled)')?.focus({preventScroll:true});
   };
   const back=button('‹ Əvvəlki',()=>go(step-1,':first-child')),next=button('Növbəti ›',()=>go(step+1,':last-child'));
   if(compact){
    for(const [arrow,icon,label] of [[back,'‹','Əvvəlki'],[next,'›','Növbəti']]){
     const glyph=create('span',icon);
     glyph.setAttribute('aria-hidden','true');
     arrow.replaceChildren(glyph);arrow.setAttribute('aria-label',label);
    }
   }
   back.disabled=step===0;next.disabled=step===steps.length-1;
   nav.append(back,next);details.append(description,nav);
   if(steps.length>1){
    const dots=create('div',null,'browser-guide-dots');dots.setAttribute('role','group');dots.setAttribute('aria-label','Təlimat addımları');
    steps.forEach((_,index)=>{
     const dot=button('',()=>{go(index);body.querySelector('.browser-guide-dots [aria-current="step"]')?.focus({preventScroll:true});});
     dot.setAttribute('aria-label','Addım '+(index+1));
     if(index===step)dot.setAttribute('aria-current','step');
     dots.append(dot);
    });
    const play=button(autoplay?'Dayandır':'Avtomatik göstər',()=>{
     autoplay=!autoplay;
     if(autoplay&&step===steps.length-1)step=0;
     draw();body.querySelector('.browser-guide-play')?.focus({preventScroll:true});
    });
    play.className='browser-guide-play';
    if(compact){
     const icon=create('span',autoplay?'Ⅱ':'▶');icon.setAttribute('aria-hidden','true');play.prepend(icon);
     next.before(dots);details.append(play);
    }else details.append(dots,play);
    let touch;
    layout.addEventListener('touchstart',e=>{touch=e.touches.length===1?e.touches[0]:null;},{passive:true});
    layout.addEventListener('touchcancel',()=>{touch=null;});
    layout.addEventListener('touchend',e=>{
     if(!touch||!e.changedTouches.length)return;
     const {clientX,clientY}=e.changedTouches[0],dx=clientX-touch.clientX,dy=clientY-touch.clientY;
     touch=null;
     if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.3)go(step+(dx<0?1:-1));
    },{passive:true});
   }
   layout.append(visual,details);body.append(choices,layout);
   if(autoplay&&step<steps.length-1)advanceTimer=setTimeout(()=>{
    if(!guideDialog.open||!guideDialog.isConnected)return;
    step++;autoplay=step<steps.length-1;draw();
   },4200);
  }
  async function loadGuide(){
   const turn=++guideTurn;failed=false;draw();
   try{const result=await api('my-orders/'+encodeURIComponent(order.dataset.orderId)+'/guide/'+index);if(turn===guideTurn&&guideDialog.open){data=result;draw();}}
   catch(e){if(turn!==guideTurn||!guideDialog.open)return;if(e.status===401||e.status===403){gate();return;}failed=true;draw();}
  }
  header.append(head,tabs);
  if(!accounts.querySelector('[data-delivery]'))header.append(create('p',accounts.querySelector('p')?.textContent,'browser-guide-delivery-status'));
  wrap.append(header,body,footer);guideDialog.replaceChildren(wrap);root.after(guideDialog);
  guideDialog.addEventListener('close',()=>{clearTimeout(advanceTimer);guideTurn++;guideDialog.remove();if(trigger.isConnected)trigger.focus({preventScroll:true});},{once:true});
  guideDialog.showModal();void loadGuide();
 }
 function buyAgain(selection){
  if(repeatDialog.open)return;
  repeatDialog.innerHTML='<h2 id="browserOrderRepeatTitle">Yenidən almaq</h2><p>Bu, yeni sifariş olacaq. Məhsul ödənişdən sonra ayrıca təqdim olunur. Əvvəlki sifarişiniz dəyişmir.</p><p role="status" data-repeat-status></p><div><button type="button" data-repeat-cancel autofocus>Ləğv et</button><button type="button" data-repeat-add>Səbətə əlavə et</button></div>';
  repeatDialog.setAttribute('aria-labelledby','browserOrderRepeatTitle');root.after(repeatDialog);
  const cancel=repeatDialog.querySelector('[data-repeat-cancel]'),add=repeatDialog.querySelector('[data-repeat-add]'),status=repeatDialog.querySelector('[data-repeat-status]');
  cancel.onclick=()=>repeatDialog.close();
  if(!selection){add.disabled=true;status.textContent='Bu məhsul və ya əvvəlki paket hazırda satışda deyil və ya müəyyən edilə bilmədi.';}
  add.onclick=async()=>{if(add.disabled)return;add.disabled=true;
   try{const {startCartEntry}=await import('/community-assets/cart-entry.js?v=order-cards-20261108');if(!repeatDialog.open||!add.isConnected)return;
    const plan={label:selection.planName},plans=[];plans[selection.planIndex]=plan;
    repeatDialog.close();
    await startCartEntry({id:selection.productId,title:selection.title,plans},plan,{repeatPlanName:selection.planName,repeatPlanKey:selection.planKey??null});
   }catch{const msg='Sifariş pəncərəsini açmaq mümkün olmadı. Yenidən cəhd edin.';if(repeatDialog.open&&add.isConnected)status.textContent=msg;else if(root.isConnected){error.textContent=msg;error.hidden=false;}}
   finally{add.disabled=!selection;}
  };
  repeatDialog.showModal();
 }
 on(root,'click',e=>{
  const info=e.target.closest('[data-order-info]'),again=e.target.closest('[data-buy-again]');
  if(info)return openGuide(info,info.closest('.browser-order-line').querySelector('.browser-order-instructions'));
  if(again)return buyAgain(repeats.get(again.closest('[data-order-id]'))?.[Number(again.dataset.buyAgain)]);
  const b=e.target.closest('[data-copy-delivery],[data-copy-delivery-field]');if(b)void copyDelivery(b);
  const retry=e.target.closest('[data-retry-delivery]');if(retry)void loadDelivery(retry.closest('[data-delivery]'));
 });
 root.addEventListener('click',async e=>{if(e.target.closest('[data-retry]'))return void load();const b=e.target.closest('[data-receipt]');if(!b||b.disabled)return;const run=generation;b.disabled=true;try{const d=await api('my-orders/'+encodeURIComponent(b.dataset.receipt)+'/receipt');if(run!==generation)return;const u=new URL(d.url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw Error();content.replaceChildren();const view=document.createElement(d.mime==='application/pdf'?'iframe':'img');view.src=u.href;view.referrerPolicy='no-referrer';if(view.tagName==='IMG')view.alt='Sifarişin ödəniş çeki';else{view.title='Ödəniş çeki PDF';view.setAttribute('sandbox','allow-same-origin');}content.append(view);dialog.showModal();}catch(e){if(run!==generation)return;if(e.status===401||e.status===403)return void gate();error.textContent=e.status===410?'Çek artıq mövcud deyil':'Çeki açmaq mümkün olmadı. Yenidən cəhd edin.';error.hidden=false;}finally{b.disabled=false;}});
 document.getElementById('browserReceiptClose').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('close',()=>content.replaceChildren());
 const start=()=>{clearInterval(timer);timer=setInterval(()=>{if(loaded&&!document.hidden&&!dialog.open&&!guideDialog.open&&!repeatDialog.open)load(false,true);},12000);};
 on(window,'mirpanel:account',e=>{if(!e.detail)gate();else if(!loaded)load();});
 on(window,'storage',e=>{if(e.key==='mirpanel.auth.signedOut')gate();});
 // Keep the verified profile list in place, not the revealed credentials or receipt.
 on(document,'visibilitychange',()=>{
  if(!document.hidden){root.querySelectorAll('[data-order-id][open]').forEach(showAccounts);if(loaded&&!guideDialog.open&&!repeatDialog.open)void load(false,true);return;}
  generation++;for(const c of requests)c.abort();requests.clear();loading=false;more.disabled=false;root.setAttribute('aria-busy','false');
  root.querySelectorAll('.browser-order-instructions').forEach(hideInfo);
  content.replaceChildren();if(dialog.open)dialog.close();
 });
 const dispose=()=>{clearInterval(timer);clear();life.abort();};on(window,'pagehide',e=>{if(e.persisted){clearInterval(timer);root.querySelectorAll('.browser-order-instructions').forEach(hideInfo);}else dispose();});on(window,'pageshow',e=>{if(e.persisted){start();root.querySelectorAll('[data-order-id][open]').forEach(showAccounts);load(false,true);}});start();if(options.initial)paint(options.initial);load();window.mirpanelPageDispose=dispose;return dispose;
 };if(!window.mirpanelNavigationMounting&&!window.mirpanelAccountMounting)window.mountBrowserOrders();
})();
