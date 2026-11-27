// A new snapshot after disconnect/history load is a baseline, not a new-message event.
export function advanceSupportCursor(state,value,{enabled=true}={}){
 const next=String(value||'0');if(!/^\d{1,18}$/.test(next))return false;
 const newer=(a,b)=>a.length>b.length||a.length===b.length&&a>b;
 if(!state.ready){state.ready=true;state.last=next;return false;}
 const fresh=newer(next,state.last||'0');if(fresh)state.last=next;return fresh&&enabled;
}
export function createSupportNotifier(button,status){
 const cursor={ready:false,last:'0'};let enabled=false,audio,actor='',db;
 const claims=new Set();
 async function claim(key){if(claims.has(key))return false;claims.add(key);try{
  db??=new Promise((resolve,reject)=>{const r=indexedDB.open('mirpanel-support-notifications',1);r.onupgradeneeded=()=>r.result.createObjectStore('played');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const store=await db;return await new Promise(resolve=>{const tx=store.transaction('played','readwrite');tx.objectStore('played').add(true,key);tx.oncomplete=()=>resolve(true);tx.onabort=()=>resolve(false);});
 }catch{return false;}}
 button.type='button';button.textContent='Səsi aktiv et';button.onclick=async()=>{if(enabled){enabled=false;button.textContent='Səsi aktiv et';status.textContent='Canlı dəstək səsi söndürülüb.';return;}try{const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error();audio??=new Context();await audio.resume();enabled=audio.state==='running';button.textContent=enabled?'Səssizə al':'Səsi aktiv et';status.textContent=enabled?'Yumşaq “ding” səsi açıq paneldə aktivdir.':'Brauzer səsi dayandırıb. Yenidən toxunun.';}catch{status.textContent='Bu brauzerdə səs açılmadı. Yazılı say göstəricisi işləyir.';}};
 return {async update(snapshot){if(actor!==snapshot.actor){cursor.ready=false;actor=snapshot.actor;}const fresh=advanceSupportCursor(cursor,snapshot.event_seq,{enabled:enabled&&!document.hidden});if(!fresh||!audio||audio.state!=='running'||!await claim(actor+':'+cursor.last))return;const gain=audio.createGain(),tone=audio.createOscillator();gain.gain.setValueAtTime(.0001,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.08,audio.currentTime+.018);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.3);tone.frequency.value=880;tone.type='sine';tone.connect(gain);gain.connect(audio.destination);tone.start();tone.stop(audio.currentTime+.32);tone.onended=()=>{tone.disconnect();gain.disconnect();};},disconnect(){cursor.ready=false;},stop(){enabled=false;cursor.ready=false;void audio?.close();}};
}
