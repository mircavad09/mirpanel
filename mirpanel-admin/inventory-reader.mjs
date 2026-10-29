// Coalesce public reads. Never fabricate stock or bypass the atomic reservation RPC.
export const inventoryUnavailable=()=>Object.assign(Error('Stok xidməti müvəqqəti əlçatan deyil. Bir qədər sonra yenidən cəhd edin.'),{status:503,code:'INVENTORY_UNAVAILABLE'});
export function createInventoryReader({snapshot,ready,enabled,onReady,now=Date.now,cacheMs=2000,retryMs=3000}){
 let cached,until=0,pending=null,retryAt=0;
 return async function read({fresh=false}={}){
  if(pending)return pending;
  if(now()<retryAt)throw inventoryUnavailable();
  if(!fresh&&cached&&now()<until)return structuredClone(cached);
  pending=Promise.resolve().then(async()=>{try{
   if(!enabled()){if(!ready||Number(await ready())<5)throw inventoryUnavailable();onReady();}
   const rows=await snapshot();if(!Array.isArray(rows))throw inventoryUnavailable();
   cached=structuredClone(rows);until=now()+cacheMs;retryAt=0;return structuredClone(rows);
  }catch{cached=undefined;until=0;retryAt=now()+retryMs;throw inventoryUnavailable();}}).finally(()=>{pending=null;});return pending;
 };
}
