// Public business identity only. No physical-address or partnership claim.
export const siteIdentity = Object.freeze({
 name:'MirPanel',url:'https://mirpanel.com/',phone:'+994514113545',
 displayPhone:'+994 51 411 35 45',whatsapp:'https://wa.me/994514113545',
 market:'Azərbaycan',hours:'Hər gün 11:00–01:00 · Bakı vaxtı'
});
export const contactPageMetadata=Object.freeze({
 title:'Əlaqə | '+siteIdentity.name,h1:'Əlaqə',
 description:'MirPanel sifarişləri və rəqəmsal məhsullar üzrə dəstək: '+siteIdentity.displayPhone+'. '+siteIdentity.hours+'. Sifariş nömrənizi bildirin; şifrə və təsdiq kodunu açıq paylaşmayın.'
});
export function organizationSchema(){
 return {'@type':'Organization','@id':siteIdentity.url+'#organization',name:siteIdentity.name,
  url:siteIdentity.url,logo:siteIdentity.url+'assets/logo.png',
  areaServed:{'@type':'Country',name:siteIdentity.market},
  contactPoint:{'@type':'ContactPoint',contactType:'customer support',telephone:siteIdentity.phone,
   url:siteIdentity.url+'elaqe',availableLanguage:'az'}};
}
export function withSiteIdentity(html){
 if(!/<\/html>/i.test(html))return html;
 const contact=/rel=["']canonical["'][^>]*href=["']https:\/\/mirpanel\.com\/elaqe["']/i.test(html);
 if(contact){
  // Upgrade only the old generated defaults; preserve the owner's custom copy.
  html=html.replace(/(<title>|content=["'])Əlaqə \| Mirpanel(?=<\/title>|["'])/g,'$1Əlaqə | MirPanel')
   .replace(/Mirpanel ilə WhatsApp üzərindən əlaqə saxlayın\./g,contactPageMetadata.description);
 }
 html=html.replace(/(src=["'])\/?customer-footer\.js(?:\?[^"']*)?(["'])/g,'$1/customer-footer.js?v=geo-identity-1$2');
 let found=false,contactFound=false;
 let next=html.replace(/<script\b([^>]*type=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi,(tag,attrs,text)=>{
  try{
   const data=JSON.parse(text);
   const visit=node=>{
    if(!node||typeof node!=='object')return;
    if(node['@type']==='ContactPage')contactFound=true;
    if(node['@type']==='Organization'&&node['@id']===siteIdentity.url+'#organization'){
     Object.assign(node,organizationSchema());found=true;
    }
    Object.values(node).forEach(v=>Array.isArray(v)?v.forEach(visit):visit(v));
   };visit(data);
   return `<script${attrs}>${JSON.stringify(data).replaceAll('<','\\u003c')}</script>`;
  }catch{return tag;}
 });
 if(!found)next=next.replace(/<\/head>/i,`<script type="application/ld+json" data-site-identity>${JSON.stringify({'@context':'https://schema.org',...organizationSchema()})}</script></head>`);
 if(contact&&!contactFound)next=next.replace(/<\/head>/i,`<script type="application/ld+json" data-contact-page>${JSON.stringify({'@context':'https://schema.org','@type':'ContactPage','@id':siteIdentity.url+'elaqe#webpage',url:siteIdentity.url+'elaqe',name:'Əlaqə | '+siteIdentity.name,inLanguage:'az',mainEntity:{'@id':siteIdentity.url+'#organization'}})}</script></head>`);
 return next;
}
