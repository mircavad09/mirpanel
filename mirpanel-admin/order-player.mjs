import {createHash} from 'node:crypto';
// Only server-side checkout validation may mint a verified player snapshot.
const text=value=>typeof value==='string'&&!/[\x00-\x1f\x7f]/.test(value)?value.trim().slice(0,400):'';
const inputs=values=>createHash('sha256').update(JSON.stringify(Object.entries(values).sort(([a],[b])=>a.localeCompare(b)))).digest('hex');
export function sealOrderPlayer(security,line,check){
 if(!text(line.values?.player_id))return null;
 return security.encryptSecret(JSON.stringify({purpose:'order-player-v1',productId:line.productId,planKey:line.sourcePlanKey,inputs:inputs(line.values),name:check?.state==='verified'?text(check.name).slice(0,120):''}));
}
export function orderPlayer(security,snapshot,productId){
 if(!snapshot?.detailsCipher)return null;
 let values;try{values=JSON.parse(security.decryptSecret(snapshot.detailsCipher));}catch{return null;}
 const id=text(values?.player_id);if(!id)return null;
 let name='';
 if(snapshot.playerIdentityCipher)try{
  const proof=JSON.parse(security.decryptSecret(snapshot.playerIdentityCipher));
  if(proof.purpose==='order-player-v1'&&proof.productId===productId&&proof.planKey===snapshot.sourcePlanKey&&proof.inputs===inputs(values))name=text(proof.name).slice(0,120);
 }catch{} // Damaged/legacy proofs never turn into a verified name.
 return {id,name:name||null,verified:!!name};
}
