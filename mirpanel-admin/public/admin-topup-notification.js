(() => {
 const soundPath='/10-mirpanel-imzasi.wav',enabledKey='mirpanel.admin.notifications.enabled';
 const waiting=new Map(),observed=new Set();
 let baseline=false,audio,sound,database,playing,reading,timer,registration,panel,status,activate,test,disable,enabled=false,authorized=false,gesture=false,stopped=false;
 // Restore the preference before the first ordinary click can arrive.
 let preference;
 try{preference=localStorage.getItem(enabledKey);}catch{}
 enabled=preference==='true'||preference===null&&'Notification' in window&&Notification.permission==='granted';
 const pushFailure=error=>{
  if(['NotAllowedError','NotSupportedError','AbortError','InvalidStateError'].includes(error.name)||/Registration|permission|push service/i.test(error.message||''))
   return 'Brauzer Web Push abunəliyini qəbul etmədi. Saytın bildiriş icazəsini və cihazın fon ayarlarını yoxlayın. Xüsusi səsi açıq admin səhifəsində sınaqdan keçirə bilərsiniz.';
  return error.message||'Bildiriş aktivləşmədi. Yenidən cəhd edin.';
 };
 const supportsPush=()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const message=text=>{if(status)status.textContent=text;};
 function db(){
  database??=new Promise((resolve,reject)=>{
   const r=indexedDB.open('mirpanel-admin-topup-notifications',1);
   r.onupgradeneeded=()=>{for(const name of ['played'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });return database;
 }
 async function claim(id){
  const store=await db();
  return new Promise(resolve=>{
   const tx=store.transaction('played','readwrite');tx.objectStore('played').add(true,id);
   tx.oncomplete=()=>resolve(true);tx.onabort=()=>resolve(false);
  });
 }
 async function setEnabled(value,persist=true){
  if(value&&stopped)return;
  const store=await db();
  if(value&&stopped)return;
  await new Promise((resolve,reject)=>{
   const tx=store.transaction('played','readwrite');tx.objectStore('played').put(value,'enabled');
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
  });
  if(value&&stopped)return;
  enabled=value;if(persist)try{localStorage.setItem(enabledKey,String(value));}catch{}
  if(disable)disable.hidden=!value;
 }
 function prepareAudio(event){
  if(!event?.isTrusted)return;
  gesture=true;
  if(!enabled||stopped)return;
  startAudio();
 }
 function startAudio(){
  if(!enabled||stopped)return;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context){message('Bu brauzerdə xüsusi səs dəstəklənmir.');return;}
  try{
   if(!audio){
    audio=new Context();
    audio.onstatechange=()=>{if(enabled&&audio.state==='suspended')message('Xüsusi səs brauzer tərəfindən dayandırılıb. Səhifədə adi klik və ya toxunuş edin.');};
   }
   void audio.resume().then(()=>{if(audio.state==='running'){if(activate)activate.textContent='Bildiriş ayarlarını yenilə';message(supportsPush()&&Notification.permission==='denied'?'Xüsusi 10-cu səs hazırdır. Sistem bildirişləri brauzerdə bloklanıb.':'Xüsusi 10-cu səs hazırdır. Web Push sistem bildirişindən istifadə edir.');}return playWaiting();}).catch(()=>message('Səs üçün səhifədə yenidən klik edin.'));
   sound??=fetch(soundPath).then(r=>{if(!r.ok)throw Error();return r.arrayBuffer();})
    .then(async bytes=>{const buffer=await audio.decodeAudioData(bytes);queueMicrotask(()=>void playWaiting());return buffer;}).catch(()=>{sound=null;message('10-cu səs yüklənmədi. Yenidən sınaqdan keçirin.');return null;});
  }catch{message('Brauzer səsi dayandırıb. Səsi sına düyməsinə basın.');}
 }
 async function playWaiting(){
  if(!authorized||stopped||!enabled||!waiting.size||!sound||audio?.state!=='running'||playing)return;
  playing=true;
  try{
   const buffer=await sound;if(!buffer)return;
   for(const [id,added] of waiting){
    if(stopped||!authorized||!enabled||audio.state!=='running')break;
    waiting.delete(id);
    if(Date.now()-added>120000||!await claim(id))continue;
    await new Promise(resolve=>{
     const source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);
     source.onended=()=>{source.disconnect();resolve();};source.start();
    });
   }
  }catch{message('Səs çalınmadı. Brauzer və cihazın səs ayarlarını yoxlayın.');}
  finally{playing=false;}
 }
 async function api(data){
  const options={credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)};
  if(data){
   const session=await fetch('/api/session',options);
   if(!session.ok)throw Error('Admin hesabınıza yenidən daxil olun.');
   Object.assign(options,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':(await session.json()).csrfToken},body:JSON.stringify(data)});
  }
  const r=await fetch('/api/admin/push',options);
  if(!r.ok)throw Error(r.status===403?'Bildirişlər yalnız sahib-admin üçündür.':'Bildiriş xidməti hazır deyil. Yenidən cəhd edin.');
  return r.json();
 }
 async function worker(){
  registration??=await navigator.serviceWorker.register('/admin-push-worker.js',{scope:'/'});
  await navigator.serviceWorker.ready;
  return registration;
 }
 async function subscribe(publicKey){
  const r=await worker();
  const subscription=await r.pushManager.getSubscription()||await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey});
  await api({subscription:subscription.toJSON()});
  if(stopped)return;
  await setEnabled(true);
  return subscription;
 }
 async function enable(event){
  // Both permission and audio activation begin in the explicit user gesture.
  if(stopped||!enabled){baseline=false;observed.clear();waiting.clear();}
  stopped=false;authorized=true;enabled=true;prepareAudio(event);
  if(!timer)timer=setInterval(poll,30000);
  void refresh();
  const permission=supportsPush()?Notification.requestPermission():Promise.resolve('unsupported');
  activate.disabled=true;
  try{
   const result=await permission;
   await setEnabled(true);
   const config=await api();
   if(result==='granted'){
    await subscribe(config.publicKey);
    message('Web Push abunəliyi aktivdir. Cihazda yoxlama üçün yeni sınaq müraciəti göndərin.');
   }else{
    await setEnabled(true);
    message(result==='denied'?'Səs aktivdir. Sistem bildirişi bloklanıb. Brauzerin sayt icazələrində bildirişləri açın.':'Səs aktivdir. Bu brauzerdə Web Push əlçatan deyil.');
   }
  }catch(e){message(pushFailure(e));}
  finally{activate.disabled=false;activate.textContent=enabled?'Bildiriş ayarlarını yenilə':'Bildirişləri və səsi aktiv et';}
 }
 async function stop(persist=false){
  stopped=true;authorized=false;
  clearInterval(timer);timer=null;enabled=false;waiting.clear();
  await setEnabled(false,persist);
  if(supportsPush()){
   const r=await navigator.serviceWorker.getRegistration('/admin-push-worker.js');
   const s=await r?.pushManager.getSubscription();
   if(s)await s.unsubscribe();
   for(const n of await r?.getNotifications()||[])n.close();
  }
  await audio?.suspend();
  message('Bu brauzerin bildirişləri və səsi dayandırılıb.');
 }
 window.stopAdminTopupNotifications=stop;
 async function turnOff(){
  if(supportsPush()){
   const r=await navigator.serviceWorker.getRegistration('/admin-push-worker.js');
   const s=await r?.pushManager.getSubscription();
   if(s)await api({action:'disable',endpoint:s.endpoint});
  }
  await stop(true);
 }
 async function refresh(){
  if(stopped)return;
  if(reading)return reading;
  reading=(async()=>{
   try{
    const r=await fetch('/api/admin/community/shop?only=topup-count',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(r.status===401||r.status===403){enabled=false;waiting.clear();void stop().catch(()=>{});return;}
    if(!r.ok)throw Error();
    const {pending,ids,recentIds}=await r.json();
    if(stopped)return;
    if(!Number.isSafeInteger(pending)||pending<0)throw Error();
    if(Array.isArray(ids)){
     for(const id of ids){if(typeof id!=='string'||observed.has(id))continue;observed.add(id);if(baseline&&enabled&&(!recentIds||recentIds.includes(id)))waiting.set(id,Date.now());}
     if(!baseline)await Promise.all(ids.filter(id=>typeof id==='string').map(claim));
     baseline=true;void playWaiting();
    }
    window.dispatchEvent(new CustomEvent('admin-topup-count',{detail:pending}));
   }catch{window.dispatchEvent(new CustomEvent('admin-topup-count',{detail:false}));}
   finally{reading=null;}
  })();return reading;
 }
 async function settings(){
  let config;try{config=await api();}catch{return;}
  if(stopped)return;
  authorized=true;
  panel=document.createElement('details');panel.className='admin-notification-settings';
  const title=document.createElement('summary');title.textContent='Balans bildirişləri';
  const box=document.createElement('div'),note=document.createElement('p');
  activate=document.createElement('button');activate.type='button';activate.className='btn';activate.textContent='Bildirişləri və səsi aktiv et';activate.onclick=enable;
  test=document.createElement('button');test.type='button';test.className='btn';test.textContent='10-cu səsi sına';
  test.onclick=async event=>{
   if(!enabled){message('Əvvəlcə bildirişləri və səsi aktiv edin.');return;}
   prepareAudio(event);
   try{const buffer=await sound;if(!buffer)return;const source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);source.onended=()=>source.disconnect();source.start();message('10-cu MirPanel səsi çalınır.');}catch{message('Səs çalınmadı. Brauzerin səs icazəsini yoxlayın.');}
  };
  disable=document.createElement('button');disable.type='button';disable.className='btn';disable.textContent='Bu brauzerdə dayandır';disable.onclick=()=>void turnOff().catch(e=>message(e.message));
  status=document.createElement('p');status.setAttribute('role','status');
  note.textContent='Xüsusi 10-cu səs açıq admin səhifəsində, ilk klikdən sonra işləyir. Brauzer səsi dayandıra bilər. Web Push sistemin bildiriş səsindən istifadə edir. Brauzer tam bağlı olanda çatdırılma cihazın və brauzerin fon icazələrindən asılıdır. iPhone/iPad-də sayt Ana ekrana əlavə edilməlidir. Admin sessiyası bitəndə və ya çıxış edəndə bildirişlər dayanır. Bu cihazda arxa plan çatdırılmasını sınaq müraciəti ilə yoxlayın.';
  box.append(activate,test,disable,status,note);panel.append(title,box);
  const host=document.querySelector('.topbar')||document.querySelector('main')||document.body;
  host.append(panel);
  try{
   const store=await db();
   const saved=await new Promise(resolve=>{const r=store.transaction('played').objectStore('played').get('enabled');r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(undefined);});
   if(preference==null&&typeof saved==='boolean')enabled=saved;
  }catch{}
  if(stopped)return;
  activate.textContent=enabled?'Bildiriş ayarlarını yenilə':'Bildirişləri və səsi aktiv et';
  disable.hidden=!enabled;
  if(enabled){await setEnabled(true);if(gesture)startAudio();}
  void refresh();
  if(enabled&&supportsPush()&&Notification.permission==='granted'){
   try{
    const r=await worker(),subscription=await r.pushManager.getSubscription();
    if(subscription)await api({subscription:subscription.toJSON()});
    else await subscribe(config.publicKey);
    message(audio?.state==='running'?'Web Push aktivdir. Xüsusi 10-cu səs hazırdır.':'Web Push aktivdir. Xüsusi 10-cu səs ilk adi klik və ya toxunuşla hazırlanacaq.');
   }catch(e){message(pushFailure(e));}
  }else message(enabled?(supportsPush()&&Notification.permission==='denied'
   ?'Sistem bildirişləri brauzerdə bloklanıb. Xüsusi səs ilk adi klikdən sonra hazırlanacaq.'
   :'Xüsusi səs ilk adi klikdən sonra hazırlanacaq. Sistem bildirişləri üçün icazə verin.'):'Bildirişlər bu brauzerdə dayandırılıb.');
 }
 let configuring=false;
 async function loadSettings(){
  if(configuring||authorized||stopped)return;
  configuring=true;
  try{await settings();}catch(e){message(pushFailure(e));}finally{configuring=false;}
 }
 function poll(){if(!authorized)void loadSettings();else void refresh();window.dispatchEvent(new Event('admin-topup-poll'));}
 window.refreshAdminTopups=refresh;
 for(const name of ['pointerup','click','keydown'])window.addEventListener(name,prepareAudio,{capture:true,passive:true});
 navigator.serviceWorker?.addEventListener('message',event=>{
  if(event.data?.type==='mirpanel-topup'&&/^[a-f0-9-]{36}$/i.test(event.data.id||'')&&authorized&&!stopped&&enabled){waiting.set(event.data.id,Date.now());void playWaiting();void refresh();}
 });
 window.addEventListener('storage',event=>{if(event.key===enabledKey){enabled=event.newValue==='true';if(!enabled){waiting.clear();void audio?.suspend();}else if(authorized){stopped=false;if(gesture)startAudio();void refresh();}}});
 window.addEventListener('mirpanel:session-expired',()=>void stop().catch(()=>{}));
 document.addEventListener('visibilitychange',poll);
 window.addEventListener('admin-topup-changed',refresh);
 window.addEventListener('pagehide',()=>clearInterval(timer));
 window.addEventListener('pageshow',event=>{if(event.persisted&&!stopped){timer=setInterval(poll,30000);poll();}});
 timer=setInterval(poll,30000);
 void loadSettings();
 // The first authenticated settings response starts polling without an activation click.
})();
