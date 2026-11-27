// No fetch cache. Show no message text; verify current cookie ownership first.
self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
const openDb=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('mirpanel-support-push',1);r.onupgradeneeded=()=>r.result.createObjectStore('shown');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function once(id){const db=await openDb();return new Promise(resolve=>{const t=db.transaction('shown','readwrite');t.objectStore('shown').add(true,id);t.oncomplete=()=>resolve(true);t.onabort=()=>resolve(false);});}
self.addEventListener('push',event=>event.waitUntil((async()=>{let d;try{d=event.data.json();}catch{return;}if(!/^[a-f0-9-]{36}$/i.test(d?.id||'')||!/^[a-f0-9-]{36}$/i.test(d?.thread||''))return;
 try{const r=await fetch('/api/community/support/push/check?id='+d.thread+'&event='+d.id,{credentials:'include',cache:'no-store'});if(!r.ok||!(await r.json()).allowed||!await once(d.id))return;}catch{return;}
 await self.registration.showNotification('MirPanel canlı dəstək',{body:'MirPanel dəstəyi sizə cavab verdi',icon:'/assets/logo.png',tag:'mirpanel-support-'+d.id,renotify:false,data:{thread:d.thread}});
})()));
self.addEventListener('notificationclick',e=>{e.notification.close();const id=e.notification.data?.thread;if(!/^[a-f0-9-]{36}$/i.test(id||''))return;e.waitUntil((async()=>{const url=self.location.origin+'/?support='+id,windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const c of windows)if(new URL(c.url).origin===self.location.origin){await c.navigate(url);await c.focus();return;}await self.clients.openWindow(url);})());});
