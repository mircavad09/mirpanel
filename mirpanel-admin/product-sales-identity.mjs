// Explicit product-ID rename proved by commit 9cca336a (2026-11-18).
// Never infer identity from titles, images, package order or fuzzy matches.
export function salesProductId(id,catalogIds){
 return id==='mirpanel-token'&&catalogIds.has('mirpanel_token')&&!catalogIds.has(id)?'mirpanel_token':id;
}
