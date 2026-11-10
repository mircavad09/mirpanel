/* This worker never caches authenticated admin pages or API responses. */
const database=()=>new Promise((resolve,reject)=>{
 const r=indexedDB.open('mirpanel-admin-topup-notifications',1);
 r.onupgradeneeded=()=>{for(const name of ['played'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};
 r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});
async function claim(id){
 const db=await database();
 return new Promise(resolve=>{const tx=db.transaction('played','readwrite');tx.objectStore('played').add(true,'shown:'+id);
 tx.oncomplete=()=>resolve(true);tx.onabort=()=>resolve(false);});
}
async function enabled(){
 const db=await database();
 return new Promise(resolve=>{const r=db.transaction('played').objectStore('played').get('enabled');r.onsuccess=()=>resolve(r.result===true);r.onerror=()=>resolve(false);});
}
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let data;try{data=event.data.json();}catch{return;}
 if(!/^[a-f0-9-]{36}$/i.test(data?.id||'')||!Number.isFinite(data.createdAt)||Date.now()-data.createdAt>300000||!await enabled()||!await claim(data.id))return;
 const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of clients)client.postMessage({type:'mirpanel-topup',id:data.id});
 await self.registration.showNotification(data.title,{
  body:data.body,tag:'mirpanel-topup-'+data.id,renotify:false,
  data:{topup:data.id},icon:'/push-icon.png'
 });
})()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const id=event.notification.data?.topup;
 if(!/^[a-f0-9-]{36}$/i.test(id||''))return;
 event.waitUntil((async()=>{
  const url=new URL('/admin.html?topup='+id+'&topupAction=approve',self.location.origin).href;
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const admin=clients.find(c=>new URL(c.url).pathname==='/admin.html');
  if(admin){await admin.navigate(url);await admin.focus().catch(()=>{});}
  else await self.clients.openWindow(url);
 })());
});
