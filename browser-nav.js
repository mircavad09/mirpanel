(()=>{'use strict';if(window.mirpanelSharedNav)return;window.mirpanelSharedNav=true;
 const paths={home:'M3 11 12 4l9 7M5 10v10h14V10M9 20v-6h6v6',products:'m4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7m-8 4v10',group:'M4 4h16v12H9l-5 4V4Z',orders:'M5 7h14v14H5V7Zm4 0V5a3 3 0 0 1 6 0v2',profile:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2'};
 paths.balance='M12 4v16 M4 12h16';
 paths.payments='M3 5h18v14H3z M3 10h18 M7 15h3';paths.cart='M3 3h2l3 13h11l3-9H6 M10 21h.01 M18 21h.01';
 const items=[['home','/','Ana səhifə'],['products','/mehsul','Məhsullar'],['payments','/profil?tab=payments','Ödənişlər'],['balance','/balans','Balans'],['orders','/profil?tab=orders','Sifarişlər'],['cart','/sebet','Səbət']],profile=['profile','/profil','Profilim'];
 const headerItems=[['group','/qrup','Qrup/Söhbət'],['orders','/profil?tab=orders','Sifarişlərim']];
 const accountId=p=>p?.user_id??p?.id;
 let signed=!!window.mirpanelAccountProfile,accountGeneration=0,refreshing,sessionModule,retryTimer;
 const sessionImport=import('/session-state.js?v=header-session-1').then(m=>sessionModule=m);
 const icon=k=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[k]}"/></svg>`;
 const current=()=>location.pathname.replace(/\/$/,'')||'/';const active=href=>current()===href||href==='/mehsul'&&current().startsWith('/mehsul/');
 const css=document.createElement('link');css.rel='stylesheet';css.href='/browser-nav.css?v=verify-session-20261108';document.head.append(css);const cartScript=document.createElement('script');cartScript.src='/cart-store.js?v=cart-artwork-1';cartScript.addEventListener('load',cartBadge);document.head.append(cartScript);
 function notices(){if(document.querySelector('script[data-community-notices]'))return;const script=document.createElement('script');script.src='/community-notices.js?v=public-community-v1';script.dataset.communityNotices='true';document.head.append(script);const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/community-notices.css?v=public-community-v1';document.head.append(sheet);}
 if(!document.querySelector('script[data-page-navigation-loader]')){const navigationScript=document.createElement('script');navigationScript.src='/page-navigation.js?v=delivery-stable-2';navigationScript.dataset.pageNavigationLoader='';document.head.append(navigationScript);}const desktopScript=document.createElement('script');desktopScript.src='/desktop-header.js?v=profile-orders-link-1';document.head.append(desktopScript);const accountScript=document.createElement('script');accountScript.src='/account-header.js?v=storefront-identity-1';document.head.append(accountScript);
 const nav=document.querySelector('.browser-bottom-nav')||document.createElement('nav');nav.className='browser-bottom-nav';nav.setAttribute('aria-label','Aşağı menyu');if(!nav.isConnected)document.body.append(nav);document.body.classList.add('has-bottom-nav');
 function header(){for(const target of document.querySelectorAll('.site-header-nav,.site-header-drawer-nav')){for(const [key,href,label] of [...headerItems,...(signed?[profile]:[])]){if(target.querySelector(`[data-browser-nav="${key}"]`))continue;const a=document.createElement('a');a.href=href;a.dataset.browserNav=key;a.innerHTML=icon(key)+'<span>'+label+'</span>';if(active(href))a.setAttribute('aria-current','page');target.append(a);}if(!signed)target.querySelector('[data-browser-nav="profile"]')?.remove();for(const a of target.querySelectorAll('a[href]')){const u=new URL(a.href,location.href);if(u.origin===location.origin&&(a.dataset.browserNav==='orders'?navActive('orders',u.pathname):active(u.pathname)))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}}}
 function cartBadge(){const a=nav.querySelector('[data-browser-nav=cart]');if(!a)return;const count=(window.MirpanelCart?.read()||[]).reduce((n,x)=>n+x.quantity,0);let badge=a.querySelector('[data-cart-count]');if(!count){badge?.remove();a.setAttribute('aria-label','Səbət');return;}if(!badge){badge=document.createElement('b');badge.dataset.cartCount='';badge.className='browser-cart-count';a.append(badge);}const text=String(count);if(badge.textContent!==text)badge.textContent=text;a.setAttribute('aria-label','Səbət, '+text+' məhsul');}
 function navActive(key,href){const payments=current()==='/profil'&&new URLSearchParams(location.search).get('tab')==='payments';if(key==='profile'&&payments)return false;if(key==='payments')return payments;if(key==='orders')return current()==='/profil'&&new URLSearchParams(location.search).get('tab')==='orders';return active(href);}
 function draw(){nav.innerHTML=[...items,profile].map(([k,h,t])=>`<a href="${h}" data-browser-nav="${k}"${navActive(k,h)?' aria-current="page"':''}>${icon(k)}<span>${t}</span></a>`).join('');nav.style.setProperty('--nav-columns',7);nav.dataset.signed=String(signed);cartBadge();header();}
 function updateActive(){for(const a of nav.querySelectorAll('[data-browser-nav]')){if(navActive(a.dataset.browserNav,a.getAttribute('href')))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}cartBadge();header();}
 window.addEventListener('mirpanel:cart',cartBadge);window.addEventListener('storage',e=>{if(e.key==='mirpanel.cart.v1'||e.key===null)cartBadge();});window.addEventListener('hashchange',updateActive);window.addEventListener('mirpanel:route-change',updateActive);
 let publishedEvent,lastProfile=window.mirpanelAccountProfile;
 function remember(p){
  lastProfile=window.mirpanelAccountProfile=p;
  const next=!!p;
  try{if(next)sessionStorage.setItem('mirpanel.account.present','1');else sessionStorage.removeItem('mirpanel.account.present');}catch{}
  if(next!==signed){signed=next;draw();}
 }
 function publish(p){
  clearTimeout(retryTimer);
  remember(p);
  const event=new CustomEvent('mirpanel:account',{detail:p});
  publishedEvent=event;window.dispatchEvent(event);publishedEvent=null;
 }
 function invalidate(){
  accountGeneration++;refreshing=null;clearTimeout(retryTimer);
  if(sessionModule)sessionModule.invalidateCommunityState();
  else void sessionImport.then(m=>m.invalidateCommunityState()).catch(()=>{});
 }
 function refresh(force=false,initial=false){
  if(refreshing&&(!force||refreshing.force))return refreshing.promise;
  if(force)invalidate();
  const flight={force},run=accountGeneration;
  refreshing=flight;
  return flight.promise=(async()=>{
   try{
    const {getCommunityState}=await sessionImport;
    if(run!==accountGeneration)return;
    const r=await getCommunityState({maxAge:force?0:initial?10000:750});
    if(run!==accountGeneration)return;
    if(r.ok&&(r.data?.profile===null||accountId(r.data?.profile))){
     publish(r.data.profile);
     if(Object.hasOwn(r.data,'unreadTags'))notices();
    }else if(r.status===401)publish(null);
    else throw Error('Session unavailable');
   }catch{
    // Keep the verified account (or the neutral initial state) on transient failures.
    if(run===accountGeneration&&lastProfile===undefined)retryTimer=setTimeout(()=>void refresh(),1500);
   }finally{if(refreshing===flight)refreshing=null;}
  })();
 }
 window.addEventListener('mirpanel:profile-updated',e=>{const p=e.detail;if(!accountId(p)||accountId(lastProfile)!==accountId(p))return;invalidate();publish(p);});
 window.addEventListener('mirpanel:account',e=>{if(e===publishedEvent||e.detail!==null&&!accountId(e.detail))return;if(e.detail===null||accountId(lastProfile)!==accountId(e.detail))invalidate();remember(e.detail);});
 window.addEventListener('storage',e=>{if(e.key==='mirpanel.auth.signedOut'&&e.newValue)window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:null}));});
 let lastPresenceAt=0,lastPresenceUser=null;
 function reportPresence(){
  const user=window.mirpanelAccountProfile?.user_id;
  if(!user||document.hidden||(user===lastPresenceUser&&Date.now()-lastPresenceAt<90000))return;
  lastPresenceAt=Date.now();lastPresenceUser=user;
  void fetch('/api/community/presence',{method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({site:true})}).catch(()=>{});
 }
 window.addEventListener('mirpanel:account',reportPresence);
 document.addEventListener('visibilitychange',reportPresence);
 setInterval(reportPresence,90000);
 window.refreshCommunityNav=()=>refresh(true);draw();void refresh(false,true);window.addEventListener('pageshow',e=>{if(e.persisted)refresh();});window.addEventListener('online',()=>refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;header();});}).observe(document.getElementById('mainHeader')||document.querySelector('.site-header')||document.body,{childList:true,subtree:true});
})();
