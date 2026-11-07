const files={add:'06-sebete-elave',remove:'07-sil-ve-legv',order:'08-sifaris-ugurlu'};
const buffers=new Map(),seen=new Set();
let context,activation,player;
const silence='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA';
function load(kind){
 if(!buffers.has(kind))buffers.set(kind,fetch('/sounds/'+files[kind]+'.wav').then(r=>{
  if(!r.ok)throw Error('Sound unavailable');
  return r.arrayBuffer();
 }).then(bytes=>context.decodeAudioData(bytes)).catch(()=>null));
 return buffers.get(kind);
}
function activate(event){
 if(!event.isTrusted)return;
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio){
   // Reuse the same media element after unlocking it with a silent sample.
   if(event.type!=='pointerup'&&!player){player=new window.Audio(silence);void player.play().catch(()=>{});}
   return;
  }
  context??=new Audio();
  // Safari needs resume inside the actual gesture, not after the order request.
  if(context.state!=='running'&&!activation)activation=context.resume().catch(()=>{}).finally(()=>{activation=null;});
  for(const kind of Object.keys(files))void load(kind);
 }catch{}
}
for(const type of ['pointerup','click','keydown'])window.addEventListener(type,activate,{capture:true,passive:true});

// Only called by successful mutation handlers; never by rendering or recovery.
// Resolve after playback so an immediate WhatsApp redirect cannot cut it off.
export async function playCheckoutSound(kind,id){
 try{
  if(!files[kind]||!id)return;
  const key=kind+':'+id;
  if(seen.has(key))return;
  seen.add(key);if(seen.size>80)seen.delete(seen.values().next().value);
  try{const store='mirpanel.checkout-sounds',played=JSON.parse(sessionStorage.getItem(store)||'[]');if(played.includes(key))return;sessionStorage.setItem(store,JSON.stringify([...played,key].slice(-80)));}catch{}
  if(player){
   player.src='/sounds/'+files[kind]+'.wav';
   await new Promise(resolve=>{
    const done=()=>{clearTimeout(timer);player.removeEventListener('ended',done);resolve();};
    const timer=setTimeout(done,850);
    player.addEventListener('ended',done,{once:true});
    player.play().catch(done);
   });
   return;
  }
  if(!context)return;
  const buffer=await Promise.race([Promise.all([load(kind),activation]).then(([data])=>data),new Promise(resolve=>setTimeout(resolve,250))]);
  if(!buffer||context.state!=='running')return;
  const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
  await new Promise(resolve=>{
   const stop=setTimeout(resolve,Math.min(900,buffer.duration*1000+100));
   source.onended=()=>{clearTimeout(stop);source.disconnect();resolve();};
   source.start();
  });
 }catch{}
}
