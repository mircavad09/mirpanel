// A failed native ESM dependency is cached per URL for the document lifetime.
// Propagate only our bounded recovery token through static same-origin imports.
export function withModuleRecovery(source,address){
 const base=new URL(address),token=base.searchParams.get('loadRetry');
 if(!/^[1-9]\d?$/.test(token||''))return source;
 return source.replace(/(\b(?:import|export)\s+(?:[^;'"`]*?\s+from\s+)?)(['"])([^'"\r\n]+)\2/g,(all,prefix,quote,specifier)=>{
  if(!/^(?:\.?\.?\/|https?:\/\/)/.test(specifier))return all;
  const target=new URL(specifier,base);if(target.origin!==base.origin||!/\.(?:m?js)$/.test(target.pathname)||target.pathname==='/request-recovery.js')return all;
  target.searchParams.set('loadRetry',token);
  return prefix+quote+(specifier.startsWith('http')?target.href:target.pathname+target.search)+quote;
 });
}
