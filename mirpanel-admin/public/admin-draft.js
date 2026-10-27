// Local editor recovery only: never store auth/session state, passwords or keys.
window.MirpanelAdminDraft=(()=>{
 const forbidden=/^(?:password|password_confirm|csrfToken|session|sessionToken|accessToken|refreshToken|token|secret|apiKey|authorization|cookie)$/i;
 const clean=value=>JSON.parse(JSON.stringify(value,(key,v)=>forbidden.test(key)||key.startsWith('_')?undefined:v));
 const db=new Promise((resolve,reject)=>{const r=indexedDB.open('mirpanel-admin-editor',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('LOCAL_DRAFT_UNAVAILABLE'));});
 db.catch(()=>{}); // Methods surface a recovery warning; avoid an unhandled rejection.
 async function run(mode,fn){const d=await db;return new Promise((resolve,reject)=>{const tx=d.transaction('drafts',mode),s=tx.objectStore('drafts');let result;const r=fn(s);if(r)r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('LOCAL_DRAFT_FAILED'));});}
 return {
  save:({data,baseSha,selectedId})=>run('readwrite',s=>s.put({data:clean(data),baseSha,selectedId,at:Date.now()},'editor')),
  read:()=>run('readonly',s=>s.get('editor')),
  file:(file,productId,uploadedPath)=>run('readwrite',s=>s.put({file,productId,uploadedPath},'image:'+productId)),
  readFiles:async()=>(await run('readonly',s=>s.getAll())).filter(v=>v?.file instanceof Blob&&v.productId),
  clear:()=>run('readwrite',s=>s.clear())
 };
})();
