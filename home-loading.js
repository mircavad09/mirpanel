// Public media metadata only. Neither identity nor inventory gates this transport.
(()=>{if(window.mirpanelHomeMedia)return;
 const base=window.MIRPANEL_ADMIN_BASE||'https://mirpanel.onrender.com',entries=new Map(),listeners=new Map();
 window.prepareHomeHeader=()=>{if(innerWidth<1000)return;const inner=document.querySelector('.site-header-inner'),tools=inner?.querySelector('.site-header-tools'),search=tools?.querySelector(':scope>.site-header-search');if(search)inner.insertBefore(search,tools);};window.prepareHomeHeader();
 const primed=new Set(),images=[];
 function prime(kind,data){const urls=kind==='banners'?[...(data.banners||[])].filter(b=>b.active===true&&b.placement!=='side').sort((a,b)=>a.order-b.order).slice(0,1).map(b=>innerWidth<768&&b.mobileImage?b.mobileImage:b.image):(data.stories||[]).filter(s=>s.active!==false).slice(0,4).map(s=>s.coverUrl);
  for(const url of urls){if(!url||primed.has(url))continue;primed.add(url);const image=new Image();image.fetchPriority=kind==='banners'?'high':'auto';image.decoding='async';image.src=url;images.push(image);}
 }
 function stored(kind){try{const v=JSON.parse(sessionStorage.getItem('mirpanel-home-'+kind)||'null');return v&&Date.now()-v.at<120000?v.data:null;}catch{return null;}}
 function entry(kind){if(!['banners','stories'].includes(kind))throw Error('Unknown media');if(!entries.has(kind))entries.set(kind,{data:stored(kind),version:0,failures:0});return entries.get(kind);}
 function notify(kind,e){window.dispatchEvent(new CustomEvent('mirpanel:home-media-state',{detail:{kind,failed:!!e.failed}}));}
 function schedule(kind,e){clearTimeout(e.timer);if(document.hidden)return;e.timer=setTimeout(()=>void request(kind).catch(()=>{}),Math.min(15000,750*2**Math.min(e.failures-1,5)));}
 function request(kind,{force=false}={}){
  const e=entry(kind);if(e.pending)return e.pending;if(!force&&!e.failed&&e.at&&Date.now()-e.at<15000)return Promise.resolve(e.data);
  clearTimeout(e.timer);const version=++e.version,controller=e.controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
  const pending=fetch(base+'/api/'+(kind==='banners'?'homepage-banners':'stories'),{credentials:'omit',mode:'cors',cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error('MEDIA_'+response.status);const data=await response.json();
   if(kind==='stories'?!Array.isArray(data.stories):data.managed!==false&&(data.managed!==true||!Array.isArray(data.banners)))throw Error('Invalid media payload');
   if(version!==e.version)return e.data;
   e.data=data;e.at=Date.now();e.failed=false;e.failures=0;try{sessionStorage.setItem('mirpanel-home-'+kind,JSON.stringify({at:e.at,data}));}catch{}
   prime(kind,data);for(const fn of listeners.get(kind)||[])try{fn(data);}catch(error){console.warn('HOME_MEDIA_RENDER_RETRY',kind);}
   notify(kind,e);return data;
  }).catch(error=>{if(version===e.version){e.failed=true;e.failures++;notify(kind,e);schedule(kind,e);}throw error;}).finally(()=>{clearTimeout(timeout);if(e.pending===pending)e.pending=null;});
  e.pending=pending;void pending.catch(()=>{});return pending;
 }
 window.mirpanelHomeMedia={request,cached:kind=>entry(kind).data,failed:kind=>!!entry(kind).failed,subscribe(kind,fn){if(!listeners.has(kind))listeners.set(kind,new Set());listeners.get(kind).add(fn);return()=>listeners.get(kind).delete(fn);}};
 function resume(){if(document.hidden)return;for(const kind of ['banners','stories'])void request(kind).catch(()=>{});}
 for(const kind of ['banners','stories']){const data=entry(kind).data;if(data)prime(kind,data);}
 resume();document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);window.addEventListener('pageshow',resume);window.addEventListener('mirpanel:route-ready',e=>{if(e.detail.path==='/')resume();});
})();
