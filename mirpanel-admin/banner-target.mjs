import {productSeoSlug} from './product-pages.mjs';
export const bannerProducts = catalog => (catalog.products || []).filter(p=>p.id && productSeoSlug(p)).map(p=>({id:p.id,title:p.title,image:p.image || '',active:p.active!==false,path:`/mehsul/${productSeoSlug(p)}`}));
export function resolveBannerTarget(options={}, products=[]) {
  let linkType=options.linkType || (options.productId?'product':''), productId=options.productId || '';
  if(!linkType) {
    let path='';try {const u=new URL(options.url || '', 'https://mirpanel.com');if(u.origin==='https://mirpanel.com')path=u.pathname.replace(/\/$/,'');}catch{}
    const matches=products.filter(p=>p.path===path);
    if(matches.length===1){linkType='product';productId=matches[0].id;}
    else linkType=options.url?'custom':'none';
  }
  const product=products.find(p=>p.id===productId);
  return {linkType,productId:linkType==='product'?productId:'',url:linkType==='product'?(product?.active?product.path:''):linkType==='custom'?(options.url || ''):'',productTitle:linkType==='product'?(product?.title || ''):''};
}
