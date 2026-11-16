// Public, non-financial presentation reads only. Never cache authorization or checkout.
export function publicReadCache(load,{ttlMs=5000,cooldownMs=3000,now=Date.now}={}){
 let value,until=0,pending=null,retryAt=0,lastError,revision=0;
 const read=()=>{
  if(pending)return pending.then(structuredClone);
  if(value!==undefined&&now()<until)return Promise.resolve(structuredClone(value));
  if(now()<retryAt)return Promise.reject(lastError);
  const turn=revision;
  pending=Promise.resolve().then(load).then(result=>{if(turn===revision){value=structuredClone(result);until=now()+ttlMs;retryAt=0;}return result;},error=>{if(turn===revision){lastError=error;retryAt=now()+cooldownMs;}throw error;}).finally(()=>{if(turn===revision)pending=null;});
  return pending.then(structuredClone);
 };
 read.invalidate=()=>{revision++;value=undefined;until=0;retryAt=0;pending=null;};
 return read;
}
