export const guideTracks=['general','phone','desktopQr'];
export function phoneOnlyGuide(plan){
 const name=String(plan?.label||plan?.name||'');
 return plan?.orderGuide?.phoneOnly===true||(/(?:^|[^\p{L}])telefon(?:da|la)?(?:$|[^\p{L}])/iu.test(name)&&!/kompüter|desktop|(?:^|\W)pc(?:$|\W)/iu.test(name));
}
function imageUrl(value){
 const text=String(value??'').trim();
 if(!text||text.length>1500)return '';
 try{const url=new URL(text,'https://mirpanel.com');
  if(url.protocol!=='https:'||url.username||url.password)return '';
  if(text.startsWith('/'))return !text.startsWith('//')&&url.pathname.startsWith('/uploads/')?url.pathname+url.search:'';
  return /^https:\/\//i.test(text)?url.href:'';
 }catch{return '';}
}
export function normalizeOrderGuide(input,{product=false}={}){
 if(!input||typeof input!=='object')return undefined;
 const information=typeof input.information==='string'?input.information.trim().slice(0,12000):'';
 const tracks={};
 for(const name of product?['general']:guideTracks){
  if(!Array.isArray(input.tracks?.[name]))continue;
  const steps=input.tracks[name].slice(0,12).map(s=>({
   image:imageUrl(s?.image),description:typeof s?.description==='string'?s.description.trim().slice(0,1500):''
  })).filter(s=>s.image&&s.description);
  if(steps.length)tracks[name]=steps;
 }
 const phoneOnly=!product&&input.phoneOnly===true;
 return information||Object.keys(tracks).length||phoneOnly?{information,tracks,...(phoneOnly?{phoneOnly}:{})}:undefined;
}
export function orderGuideFor(product,plan,savedName){
 const base=normalizeOrderGuide(product?.orderGuide,{product:true}),own=normalizeOrderGuide(plan?.orderGuide);
 const tracks={...base?.tracks,...own?.tracks};
 if(phoneOnlyGuide(plan)||phoneOnlyGuide({label:savedName}))delete tracks.desktopQr;
 return {information:own?.information||base?.information||'',tracks};
}
