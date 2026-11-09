// Private state lives only in this document's memory; concurrent readers share it.
// Different page modules can import different versioned URLs in one document.
// Share transport state across those imports, but never across documents.
const key=Symbol.for('mirpanel.community.session-state');
const state=window[key]??=( {entries:new Map(),generation:0,listening:false} );
export async function communityJson(response){const type=(response.headers.get('Content-Type')||'').split(';')[0].trim();if(!/^application\/(?:[\w.-]+\+)?json$/i.test(type)||response.redirected&&new URL(response.url).origin!==location.origin)throw Error('Hesab xidməti düzgün cavab vermədi. Yenidən cəhd edin.');try{return await response.json();}catch{throw Error('Hesab məlumatı alınmadı. Yenidən cəhd edin.');}}
export function getCommunityState({group=false,maxAge=750}={}){
 const suffix=group?'?group=messages':'';
 let entry=state.entries.get(suffix);
 if(entry?.pending)return entry.pending;
 if(entry?.last&&performance.now()-entry.at<maxAge)return Promise.resolve(entry.last);
 const active=new AbortController(),run=state.generation,timer=setTimeout(()=>active.abort(),12000);
 entry={controller:active};state.entries.set(suffix,entry);
 const request=fetch('/api/community/state'+suffix,{credentials:'same-origin',cache:'no-store',signal:active.signal}).then(async r=>{
  const value={ok:r.ok,status:r.status,data:await communityJson(r)};
  if(run!==state.generation)throw new DOMException('Superseded state','AbortError');
  if(r.ok||r.status===401){entry.last=value;entry.at=performance.now();}return value;
 }).finally(()=>{clearTimeout(timer);entry.pending=null;});entry.pending=request;return request;
}
export function invalidateCommunityState(){state.generation++;for(const entry of state.entries.values())entry.controller.abort();state.entries.clear();}
if(!state.listening){state.listening=true;window.addEventListener('pagehide',invalidateCommunityState);window.addEventListener('pageshow',e=>{if(e.persisted)invalidateCommunityState();});}
