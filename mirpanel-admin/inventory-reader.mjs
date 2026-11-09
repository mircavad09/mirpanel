// Coalesce public reads. Never fabricate stock or bypass the atomic reservation RPC.
export const inventoryUnavailable=()=>Object.assign(Error('Stok xidməti müvəqqəti əlçatan deyil. Bir qədər sonra yenidən cəhd edin.'),{status:503,code:'INVENTORY_UNAVAILABLE'});
export function createInventoryReader({snapshot,ready,enabled,onReady,now=Date.now,cacheMs=2000,retryMs=3000}){
 let cached,until=0,pending=null,retryAt=0,revision=0;
 async function read({fresh=false}={}){
  if(pending)return pending;
  if(now()<retryAt)throw inventoryUnavailable();
  if(!fresh&&cached&&now()<until)return structuredClone(cached);
  const startedAt=revision;
  pending=Promise.resolve().then(async()=>{try{
   if(!enabled()){if(!ready||Number(await ready())<5)throw inventoryUnavailable();onReady();}
   const rows=await snapshot();if(!Array.isArray(rows))throw inventoryUnavailable();
   if(startedAt===revision){cached=structuredClone(rows);until=now()+cacheMs;retryAt=0;}
   return structuredClone(rows);
  }catch{if(startedAt===revision){cached=undefined;until=0;retryAt=now()+retryMs;}throw inventoryUnavailable();}}).finally(()=>{if(startedAt===revision)pending=null;});return pending;
 }
 read.invalidate=()=>{revision++;cached=undefined;until=0;retryAt=0;pending=null;};
 return read;
}
