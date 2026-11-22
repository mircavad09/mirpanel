// Public business identity only. No physical-address or partnership claim.
export const siteIdentity = Object.freeze({
 name:'MirPanel',url:'https://mirpanel.com/',phone:'+994514113545',
 displayPhone:'+994 51 411 35 45',whatsapp:'https://wa.me/994514113545',
 market:'Azərbaycan',hours:'Hər gün 11:00–01:00 · Bakı vaxtı'
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
 let found=false;
 let next=html.replace(/<script\b([^>]*type=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi,(tag,attrs,text)=>{
  try{
   const data=JSON.parse(text);
   const visit=node=>{
    if(!node||typeof node!=='object')return;
    if(node['@type']==='Organization'&&node['@id']===siteIdentity.url+'#organization'){
     Object.assign(node,organizationSchema());found=true;
    }
    Object.values(node).forEach(v=>Array.isArray(v)?v.forEach(visit):visit(v));
   };visit(data);
   return `<script${attrs}>${JSON.stringify(data).replaceAll('<','\\u003c')}</script>`;
  }catch{return tag;}
 });
 if(!found)next=next.replace(/<\/head>/i,`<script type="application/ld+json" data-site-identity>${JSON.stringify({'@context':'https://schema.org',...organizationSchema()})}</script></head>`);
 return next;
}
