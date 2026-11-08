/* Progressive customer router. HTML shells contain no private account data. */
(()=>{'use strict';if(window.mirpanelPageNavigation)return;window.mirpanelPageNavigation=true;
 const routes=new Set(['/','/mehsul','/haqqimizda','/sertler','/elaqe','/balans','/sebet','/odenis','/sifarislerim','/profil','/qrup','/hesab','/owner-login']);
 const shared=/\/(?:site-header|site-header-menu|desktop-header|account-header|browser-nav|support-widget|cart-store|decorative-backgrounds|community-notices)\.(?:js|css)$/;
 const allowedScripts=new Set(['home-loading.js','display-labels.js','catalog-card.js','catalog-listing.js','app.js','cms-site.js','stories.js','payment-flow.js','order-confirmation.js','stock-display-fix.js','search-suggestions-fix.js','frontend-routing-detail-fix.js','seo-router.js','i18n.js','webmcp.js','site-sections-render.js','browser-orders.js']);
 const cache=new Map(),templates=new Map(),styles=new Map(),loaded=new Map(),scrolls=new Map(),routeClasses=new Set(document.body.classList);let current=location.pathname+location.search+location.hash,generation=0,controller,dispose,loading=false,view,mounted=true;
 const templateKey=p=>['/balans','/sebet','/odenis'].includes(p)?'shop':['/qrup','/profil','/hesab'].includes(p)?'community':null;
 // A checkout return can open its verification sheet before the router loads.
 // Moving an open modal out of the body would remove it from the top layer.
 const persistent=n=>n.matches?.('.site-header,.browser-bottom-nav,#supportWidget,#accountDropdown,#accountNotifications,#accountGuest,#newSplashScreen,#splashLoadStatus,dialog.auth-code-sheet[open],[data-shell-persistent]');
 function rememberStyles(doc,base){const keys=[];for(const n of doc.head.querySelectorAll('link[rel=stylesheet],style')){const url=n.tagName==='LINK'?new URL(n.getAttribute('href'),base):null;if(n.hasAttribute('data-shell-persistent')||n.hasAttribute('data-cart-entry-css')||url&&shared.test(url.pathname))continue;const key=url?url.pathname:'inline:'+n.textContent;keys.push(key);if(!styles.has(key)){const copy=n.ownerDocument===document?n:n.cloneNode(true);if(url)copy.href=url.href;if(!copy.isConnected)document.head.insertBefore(copy,document.head.querySelector('link[href*="site-header.css"]'));styles.set(key,copy);}}return keys;}
 const initialStyles=rememberStyles(document,location.href);for(const s of document.scripts)if(s.src)loaded.set(new URL(s.src).pathname,Promise.resolve());
 for(const n of [...document.head.querySelectorAll('link[rel=stylesheet]')])if(shared.test(new URL(n.href).pathname))document.head.append(n);
 const root=document.createElement('div');root.id='sitePageContent';root.style.display='contents';document.body.insertBefore(root,document.querySelector('.site-header')?.nextSibling||document.body.firstChild);
 for(const n of [...document.body.children])if(n!==root&&n.tagName!=='SCRIPT'&&n.tagName!=='LINK'&&!persistent(n))root.append(n);
 const isStatic=p=>p==='/'||p==='/mehsul';view={fragment:null,styles:initialStyles,title:document.title,body:document.body.className,html:document.documentElement.className,started:true};
 const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/page-navigation.css?v=shell-20261104';document.head.append(sheet);
 const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const authModule='/community-assets/auth-forms.js?v=verify-session-20261108';
 const profileModule='/community-assets/profile-entry.js?v=codes-view-1';
 let profileReady;
 const prepareProfile=()=>profileReady??=(moduleWithin(profileModule).catch(e=>{profileReady=null;throw e;}));
 window.addEventListener('mirpanel:account',e=>{if(e.detail)void prepareProfile().catch(()=>{});});
 if(window.mirpanelAccountProfile)void prepareProfile().catch(()=>{});
 void import(authModule).catch(()=>{});
 function emptyStatus(){const app=root.querySelector('#shopApp:empty,#communityApp:empty:not([data-profile-entry])');if(app){const p=document.createElement('p');p.setAttribute('role','status');p.className='site-route-pending';p.textContent='Məlumatlar yüklənir…';app.append(p);}}emptyStatus();
 async function moduleWithin(url){let timer;try{return await Promise.race([import(url),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Bölmə resursu gecikir. Yenidən cəhd edin.')),15000);})]);}finally{clearTimeout(timer);}}
 function active(){window.dispatchEvent(new Event('mirpanel:route-change'));for(const a of document.querySelectorAll('.site-header a[href]')){const u=new URL(a.href);if(u.origin===location.origin&&u.pathname===location.pathname)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}}
 function guard(){const e=new Event('mirpanel:before-navigate',{cancelable:true});window.dispatchEvent(e);if(e.defaultPrevented)return false;if(document.body.classList.contains('paymentCheckoutOpen')||document.querySelector('.paymentFlow')&&document.querySelector('.modal.show')){window.alert('Aktiv ödənişi tamamlayın və ya pəncərədə “Ləğv et” seçin. Seçilmiş çek qorunur.');return false;}return true;}
 function leave(){window.dispatchEvent(new CustomEvent('mirpanel:route-leave',{detail:{from:current}}));(dispose||window.mirpanelPageDispose)?.();dispose=null;window.mirpanelPageDispose=null;
 if(view&&isStatic(new URL(current,location.origin).pathname)){const fragment=document.createDocumentFragment();while(root.firstChild)fragment.append(root.firstChild);view.fragment=fragment;cache.set(new URL(current,location.origin).pathname,view);}else root.replaceChildren();mounted=false;view=null;}
 function skeleton(u){const titles={'/':'Ana səhifə','/mehsul':'Məhsullar','/balans':u.hash==='#emeliyyatlar'?'Ödənişlər':'Balans','/sebet':'Səbət','/odenis':'Ödəniş','/sifarislerim':'Sifarişlərim','/profil':'Profil','/qrup':'Ümumi söhbət','/hesab':'Giriş'};const main=document.createElement('main');main.className='site-route-loading';main.setAttribute('aria-busy','true');const h=document.createElement('h1');h.textContent=titles[u.pathname]||'Giriş';const p=document.createElement('p');p.setAttribute('role','status');p.textContent='Məlumatlar yüklənir…';main.append(h,p);for(let i=0;i<3;i++){const bar=document.createElement('div');bar.className='site-route-placeholder';main.append(bar);}root.replaceChildren(main);}
 function resource(src,run){const u=new URL(src,location.href),key=u.pathname;if(u.origin!==location.origin||!allowedScripts.has(key.split('/').at(-1)))return Promise.resolve();if(loaded.has(key))return loaded.get(key);
 const promise=fetch(u.href,{signal:controller?.signal,cache:'default'}).then(async r=>{if(!r.ok)throw Error('Ümumi resurs yüklənmədi.');const code=await r.text();if(run!==generation)throw new DOMException('Stale route','AbortError');const s=document.createElement('script');s.dataset.routeResource=key;s.textContent=code;document.head.append(s);}).catch(e=>{loaded.delete(key);throw e;});loaded.set(key,promise);return promise;}
 async function mount(v,run){if(run!==generation)return;window.mirpanelNavigationMounting=true;try{
 if(document.getElementById('shopApp')){const m=await moduleWithin('/community-assets/shop-ui.js?v=verify-session-20261108');if(run!==generation)return;dispose=m.mountShop();}
 else if(document.getElementById('communityApp')){const m=await moduleWithin('/community-assets/community.js?v=order-delivery-20261108');if(run!==generation)return;dispose=m.mountCommunity();}
 else if(document.getElementById('browserOrders')){await resource('/browser-orders.js?v=order-receipt-20261108',run);if(run!==generation)return;dispose=window.mountBrowserOrders?.();}
 else if(!v.started){for(const src of v.scripts||[]){if(run!==generation)return;await resource(src,run);}v.started=true;}
 if(location.pathname==='/')window.mirpanelRestoreCatalog?.();
 }finally{window.mirpanelNavigationMounting=false;}}
 async function mountProfileRoute(u,run){
  const app=document.createElement('main');app.id='communityApp';app.className='community-shell';root.replaceChildren(app);mounted=true;
  routeClasses.add('community-page');document.body.classList.add('community-page','profile-screen');
  const labels={orders:'Sifarişlərim',codes:'Kodlarım',payments:'Ödənişlərim',expenses:'Xərclərim',subscriptions:'Abunəliklərim'};
  const tab=new URLSearchParams(u.search).get('tab'),heading=document.createElement('h1');heading.textContent=Object.hasOwn(labels,tab)?labels[tab]:'Profil';
  const card=document.createElement('div');card.className='site-route-placeholder';card.setAttribute('aria-busy','true');
  const section=document.createElement('section');section.className='site-route-loading';section.append(heading,card);app.append(section);
  for(const n of styles.values())if(!n.hasAttribute('data-shell-persistent')&&!n.hasAttribute('data-cart-entry-css')){if(n.tagName==='LINK'){if(new URL(n.href).origin===location.origin)n.disabled=true;}else n.media='not all';}
  window.scrollTo(0,0);
  const mod=prepareProfile();void import('/session-state.js?v=auth-recovery-20261107').then(m=>run===generation?m.getCommunityState():null).catch(()=>{});
  try{
   const m=await mod;if(run!==generation)return false;
   dispose=m.mountProfile(app);loading=false;active();
   window.dispatchEvent(new CustomEvent('mirpanel:route-ready',{detail:{path:u.pathname}}));return true;
  }catch{
   if(run!==generation)return false;loading=false;
   card.remove();const retry=document.createElement('button');retry.textContent='Yenidən cəhd et';retry.onclick=()=>go(u.href,{retry:true});section.append(retry);return false;
  }
 }
 async function go(href,{pop=false,retry=false}={}){const u=new URL(href,location.href);if(u.origin!==location.origin||!routes.has(u.pathname)){location.assign(u.href);return false;}const key=u.pathname+u.search+u.hash;if(!retry&&key===current&&!loading)return true;if(!retry&&!guard()){if(pop)history.pushState({mirpanel:true},'',current);return false;}
 if(mounted&&location.pathname==='/profil'&&new URL(current,location.origin).pathname==='/profil'&&u.pathname==='/profil'&&window.mirpanelAccountNavigate){if(!pop)history.pushState({mirpanel:true},'',key);current=key;active();await window.mirpanelAccountNavigate(u.href);return true;}
 const run=++generation;controller?.abort();controller=new AbortController();const requestController=controller,timeout=setTimeout(()=>requestController.abort(),20000);scrolls.set(current,{x:scrollX,y:scrollY});if(mounted)leave();loading=true;if(!pop&&!retry)history.pushState({mirpanel:true},'',key);current=key;active();
 document.querySelector('.site-header')?.classList.remove('is-menu-open');document.body.classList.remove('site-header-menu-open','home-page','profile-screen','wallet-page-active','auth-screen');document.body.style.overflow='';document.documentElement.classList.remove('community-chat-screen');
 if(u.pathname==='/profil'){try{return await mountProfileRoute(u,run);}finally{clearTimeout(timeout);}}
 if(u.pathname==='/hesab'){
  const app=document.createElement('main');app.className='community-shell';root.replaceChildren(app);document.body.classList.add('community-page','auth-screen');mounted=true;window.scrollTo(0,0);
  try{const m=await moduleWithin(authModule);if(run!==generation)return false;const cleanup=await m.mountAuth(app);if(run!==generation){cleanup();return false;}dispose=cleanup;loading=false;active();return true;}catch{if(run===generation){loading=false;const b=document.createElement('button');b.textContent='Giriş formasını yenidən aç';b.onclick=()=>location.reload();app.replaceChildren(b);}return false;}finally{clearTimeout(timeout);}
 }
 skeleton(u);window.scrollTo(0,0);
 if(templateKey(u.pathname))void import('/session-state.js?v=auth-recovery-20261107').then(m=>run===generation?m.getCommunityState():null).catch(()=>{});
 try{let next=isStatic(u.pathname)?cache.get(u.pathname):null;const savedTemplate=templates.get(templateKey(u.pathname));if(!next&&savedTemplate)next={...savedTemplate,fragment:savedTemplate.fragment.cloneNode(true),html:u.pathname==='/qrup'?'community-chat-screen':''};
 if(!next){const r=await fetch(u.href,{signal:controller.signal,credentials:'same-origin',cache:isStatic(u.pathname)?'default':'no-store',headers:{Accept:'text/html','X-Mirpanel-Navigation':'content'}});
 if(run!==generation)return false;if([401,403].includes(r.status)&&u.pathname==='/profil')return go('/hesab');if(!r.ok)throw Error('Bölmə hazırda yüklənmir. Yenidən cəhd edin.');const final=new URL(r.url);if(final.origin!==location.origin)throw Error('Giriş üçün səhifəni yenidən açın.');if(r.redirected&&routes.has(final.pathname)){u.href=final.href;current=u.pathname+u.search+u.hash;history.replaceState({mirpanel:true},'',current);if(u.pathname==='/hesab')return go(u.href,{pop:true,retry:true});active();}
 const text=await r.text();if(run!==generation)return false;const doc=new DOMParser().parseFromString(text,'text/html');const expected=templateKey(u.pathname);if(expected&&!doc.querySelector(expected==='community'?'#communityApp':'#shopApp'))throw Error('Hesab xidməti düzgün səhifə qaytarmadı. Yenidən cəhd edin.');if(document.getElementById('supportWidget'))for(const duplicate of doc.querySelectorAll('#waFab,.waFab'))duplicate.remove();next={fragment:document.createDocumentFragment(),styles:rememberStyles(doc,u.href),title:doc.title,body:doc.body.className,html:doc.documentElement.className,scripts:[]};for(const s of doc.querySelectorAll('script[src]'))next.scripts.push(new URL(s.getAttribute('src'),u.href).href);for(const n of [...doc.body.children])if(!persistent(n)&&!['SCRIPT','LINK'].includes(n.tagName)){for(const s of n.querySelectorAll('script'))s.remove();next.fragment.append(document.importNode(n,true));}if(!next.fragment.childNodes.length)throw Error('Bölmənin məzmunu alınmadı.');
 // Cache only verified empty public shells, never rendered profile/wallet/orders.
 const tk=templateKey(u.pathname);if(tk&&next.fragment.querySelector('#shopApp:empty,#communityApp:empty'))templates.set(tk,{...next,fragment:next.fragment.cloneNode(true)});}
 if(run!==generation)return false;for(const[k,n]of styles){if(n.hasAttribute('data-shell-persistent')||n.hasAttribute('data-cart-entry-css'))continue;if(n.tagName==='LINK'&&new URL(n.href).origin!==location.origin)continue;const enabled=next.styles.includes(k);if(n.tagName==='LINK')n.disabled=!enabled;else n.media=enabled?'all':'not all';}root.replaceChildren(next.fragment);next.fragment=null;view=next;mounted=true;emptyStatus();
 for(const c of next.body.split(/\s+/).filter(Boolean))routeClasses.add(c);const classes=[...document.body.classList].filter(c=>!routeClasses.has(c)||['has-bottom-nav','has-account-header'].includes(c));document.body.className=[...new Set([...classes,...next.body.split(/\s+/).filter(Boolean)])].join(' ');document.documentElement.classList.toggle('community-chat-screen',next.html.includes('community-chat-screen'));document.title=next.title;
 await mount(next,run);if(run!==generation)return false;loading=false;active();const search=new URLSearchParams(u.search).get('search');if(u.pathname==='/mehsul')for(const card of root.querySelectorAll('.grid .card'))card.hidden=!!search&&!card.textContent.toLocaleLowerCase('az').includes(search.toLocaleLowerCase('az'));
 await frame();if(run!==generation)return false;const saved=scrolls.get(current);if(saved)window.scrollTo(saved.x,saved.y);else if(u.hash)document.getElementById(decodeURIComponent(u.hash.slice(1)))?.scrollIntoView();else window.scrollTo(0,0);window.dispatchEvent(new CustomEvent('mirpanel:route-ready',{detail:{path:u.pathname}}));return true;
 }catch(e){if(run!==generation)return false;loading=false;mounted=false;view=null;const main=document.createElement('main');main.className='site-route-loading';const h=document.createElement('h1');h.textContent='Yükləmə alınmadı';const p=document.createElement('p');p.textContent=e.name==='AbortError'?'Serverin cavabı gecikdi. Yenidən cəhd edin.':e.message;const b=document.createElement('button');b.textContent='Yenidən cəhd et';b.onclick=()=>go(current,{retry:true});main.append(h,p,b);root.replaceChildren(main);return false;}finally{clearTimeout(timeout);}}
 window.MirpanelNavigation={go,replaceURL(href){const u=new URL(href,location.href);if(u.origin!==location.origin||u.pathname!==location.pathname)return;current=u.pathname+u.search+u.hash;history.replaceState({mirpanel:true},'',current);active();},get pending(){return loading;}};
 document.addEventListener('click',e=>{if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;const a=e.target.closest('a[href]');if(!a||(window.MirpanelCart?.open&&a.matches('#cartHeaderLink,[data-browser-nav=cart]'))||a.hasAttribute('download')||a.target&&a.target!=='_self'||a.dataset.nativeNavigation!==undefined)return;let u;try{u=new URL(a.href);}catch{return;}if(u.origin!==location.origin||!routes.has(u.pathname)||!/^https?:$/.test(u.protocol))return;if(a.closest('.account-tabs')?.dataset.dragging==='true'){e.preventDefault();return;}e.preventDefault();e.stopPropagation();void go(u.href);},true);
 history.replaceState({...history.state,mirpanel:true},'',location.href);history.scrollRestoration='manual';window.addEventListener('popstate',()=>void go(location.href,{pop:true}));active();
 window.addEventListener('pageshow',e=>{if(e.persisted){dispose=null;window.mirpanelPageDispose=null;void go(location.href,{retry:true});}});
})();
