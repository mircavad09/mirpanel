// Private state lives only in this document's memory; concurrent readers share it.
let pending,last,at=0,controller;
export function getCommunityState(){if(last&&performance.now()-at<750)return Promise.resolve(last);if(pending)return pending;controller=new AbortController();pending=fetch('/api/community/state',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async r=>{const value={ok:r.ok,status:r.status,data:await r.json()};if(r.ok){last=value;at=performance.now();}return value;}).finally(()=>{pending=null;});return pending;}
export function invalidateCommunityState(){last=null;at=0;}
window.addEventListener('pagehide',()=>{controller?.abort();invalidateCommunityState();});window.addEventListener('pageshow',e=>{if(e.persisted)invalidateCommunityState();});
