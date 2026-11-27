// Browser-vendor transport is simulated; worker ownership checks/notifications are real code.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const handlers={},shown=[],opened=[],claims=new Set();let allowed=true;const self={location:{origin:'https://mirpanel.com'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting(){},clients:{claim(){},matchAll:async()=>[],openWindow:async u=>opened.push(u)},registration:{showNotification:async(...x)=>shown.push(x)}};
const indexedDB={open(){const r={};queueMicrotask(()=>{r.result={transaction(){const tx={};tx.objectStore=()=>({add(_,id){queueMicrotask(()=>{if(claims.has(id))tx.onabort?.();else{claims.add(id);tx.oncomplete?.();}});}});return tx;}};r.onsuccess();});return r;}};
vm.runInNewContext(fs.readFileSync('support-push-worker.js','utf8'),{self,indexedDB,URL,fetch:async()=>({ok:allowed,json:async()=>({allowed})})});let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const id='a82f6e37-19ed-42b3-b229-b652168f3c94',thread='b82f6e37-19ed-42b3-b229-b652168f3c94';
const push=async data=>{let task;handlers.push({data:{json:()=>data},waitUntil:p=>task=p});await task;};
await push({id,thread,body:'secret password must never show'});eq(shown.length,1);eq(shown[0][1].body,'MirPanel dəstəyi sizə cavab verdi');await push({id,thread});eq(shown.length,1);allowed=false;await push({id:'c82f6e37-19ed-42b3-b229-b652168f3c94',thread});eq(shown.length,1);allowed=true;await push({id:'not-an-id',thread});eq(shown.length,1);
let task;handlers.notificationclick({notification:{data:{thread},close(){}},waitUntil:p=>task=p});await task;eq(opened[0],'https://mirpanel.com/?support='+thread);handlers.notificationclick({notification:{data:{thread:'https://evil.test'},close(){}},waitUntil(){}});eq(opened.length,1);
console.log(JSON.stringify({checks,scope:'worker generic payload, current-owner denial, duplicate event, tab-closed openWindow, safe click target',realPushGateway:false}));
