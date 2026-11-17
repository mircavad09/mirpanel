/* Shared server/client shortcut identity. Logos add no information beyond the link text. */
(function(root){'use strict';
 function presentation(product){
  const id=String(product.id||'');
  const title=String(product.title||product.seoH1||'Məhsul').replace(/\s+almaq\s*$/i,'').trim()||'Məhsul';
  const brand=({youtube:'youtube',netflix:'netflix',netflix_umumi:'netflix',capcut:'capcut',spotify:'spotify'})[id]||'other';
  let logo=brand==='other'?String(product.image||''):'/assets/'+brand+'.png';
  if(logo&&!/^(?:https?:)?\/\//i.test(logo)&&!logo.startsWith('/'))logo='/'+logo;
  return {title,brand,logo};
 }
 if(typeof module==='object'&&module.exports)module.exports={presentation};else root.MirpanelHomeShortcuts={presentation};
})(globalThis);
