export function advanceSupportCursor(state,value,{enabled=true}={}){
 const next=String(value||'0');if(!/^\d{1,18}$/.test(next))return false;
 if(!state.ready){state.ready=true;state.last=next;return false;}
 const fresh=BigInt(next)>BigInt(state.last||'0');if(fresh)state.last=next;return fresh&&enabled;
}
export function createSupportNotifier(button,status,testButton){
 const cursor={ready:false,last:'0'};let enabled=false,audio,actor='',db,stopped=false,nextToneAt=0;
 const claims=new Set(),preference=()=> 'mirpanel.support.sound:'+actor;
 const stored=()=>{try{return localStorage.getItem(preference())==='on';}catch{return false;}};
 function label(){button.textContent=enabled?'Bildiriş səsini söndür':'Bildiriş səsini aktiv et';button.setAttribute('aria-pressed',String(enabled));}
 async function claim(key){if(claims.has(key))return false;claims.add(key);try{
  db??=new Promise((resolve,reject)=>{const r=indexedDB.open('mirpanel-support-notifications',1);r.onupgradeneeded=()=>r.result.createObjectStore('played');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const store=await db;return await new Promise(resolve=>{const tx=store.transaction('played','readwrite');tx.objectStore('played').add(true,key);tx.oncomplete=()=>resolve(true);tx.onabort=()=>resolve(false);});
 }catch{status.textContent='Tablararası səs qorunması açılmadı. Görünən bildirişlər işləyir.';return false;}}
 async function unlock(){try{const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error();audio??=new Context();await audio.resume();if(audio.state!=='running')throw Error();return true;}catch{status.textContent='Brauzer səsi bloklayıb. Bildiriş səsini aktiv et düyməsinə toxunun. Görünən bildirişlər işləyir.';return false;}}
 function ding(){try{if(!audio||audio.state!=='running')throw Error();const at=Math.max(audio.currentTime,nextToneAt);nextToneAt=at+.38;const gain=audio.createGain(),tone=audio.createOscillator();gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.08,at+.018);gain.gain.exponentialRampToValueAtTime(.0001,at+.3);tone.frequency.value=880;tone.type='sine';tone.connect(gain);gain.connect(audio.destination);tone.start(at);tone.stop(at+.32);tone.onended=()=>{tone.disconnect();gain.disconnect();};return true;}catch{status.textContent='Bildiriş səsi çalınmadı. Görünən bildirişlər işləyir.';return false;}}
 button.type='button';label();button.onclick=async()=>{
  if(enabled){enabled=false;try{localStorage.setItem(preference(),'off');}catch{}label();status.textContent='Canlı dəstək səsi söndürülüb.';return;}
  if(!await unlock())return;enabled=true;try{localStorage.setItem(preference(),'on');}catch{}label();status.textContent='Bildiriş səsi aktivdir.';
 };
 if(testButton){testButton.type='button';testButton.onclick=async()=>{if(await unlock()){ding();status.textContent='Sınaq səsi çalındı. Mesaj bildirişi seçimi dəyişməyib.';}};}
 const gesture=event=>{if(event.target===button||event.target===testButton)return;if(!enabled&&actor&&stored())void unlock().then(ok=>{if(ok&&!stopped){enabled=true;label();status.textContent='Yadda saxlanmış səs seçimi aktivdir.';}});};
 window.addEventListener('pointerdown',gesture,{passive:true});window.addEventListener('keydown',gesture);
 return {get cursor(){return cursor.ready?cursor.last:null;},async update(snapshot){
  if(stopped)return;
  if(status.textContent.startsWith('Bağlantı kəsilib;'))status.textContent=enabled?'Bildiriş səsi aktivdir.':'Bağlantı bərpa olundu. Görünən bildirişlər işləyir.';
  if(actor!==snapshot.actor){const known=!!actor;actor=snapshot.actor;cursor.ready=false;if(known)enabled=false;else if(enabled)try{localStorage.setItem(preference(),'on');}catch{}label();if(stored()&&!enabled)status.textContent='Səs seçiminiz yadda saxlanıb. Aktivləşdirmək üçün panelə bir dəfə toxunun.';}
  if(!cursor.ready){advanceSupportCursor(cursor,snapshot.event_seq);return;}
  const events=Array.isArray(snapshot.events)?snapshot.events:[{seq:snapshot.event_seq}];
  for(const event of events){if(!advanceSupportCursor(cursor,event.seq))continue;
   if(!enabled||document.hidden)continue;
   if(!audio||audio.state!=='running'){status.textContent='Brauzer səsi dayandırıb. Səsi yenidən aktiv edin.';enabled=false;label();continue;}
   if(await claim(actor+':'+event.seq))ding();
  }
 },disconnect(){status.textContent='Bağlantı kəsilib; əvvəlki göstəricilər saxlanır, bərpa gözlənilir.';},stop(){stopped=true;enabled=false;window.removeEventListener('pointerdown',gesture);window.removeEventListener('keydown',gesture);void audio?.close();}};
}
