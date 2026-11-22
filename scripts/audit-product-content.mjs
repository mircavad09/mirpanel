import fs from 'node:fs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const live=process.argv.includes('--live');
const base='https://mirpanel.com';
const get=async path=>{const start=Date.now(),r=await fetch(base+path,{signal:AbortSignal.timeout(25000)});return {status:r.status,url:r.url,ms:Date.now()-start,text:await r.text()};};
const source=live?(await get('/app.js')).text:fs.readFileSync('app.js','utf8');
const state=extractAdminState(source);
const sitemap=live?(await get('/sitemap.xml')).text:fs.readFileSync('sitemap.xml','utf8');
const listing=live?(await get('/mehsul')).text:fs.readFileSync('mehsul.page','utf8');
const rows=[];
for(const p of state.products){
 const content=state.content[p.id]||{};
 const row={id:p.id,title:p.title,active:p.active,category:p.category,slug:p.seoSlug,index:p.seoIndex,flow:p.flow,
  fields:(p.formFields||[]).map(f=>({name:f.name,label:f.label,enabled:f.enabled})),
  plans:p.plans.map(x=>({id:x.id,label:x.label,name:x.name,active:x.active,price:x.price,deliveryMode:x.deliveryMode,warrantyDays:x.warrantyDays,fields:x.formFields,supplier:x.supplier?{...x.supplier}:undefined})),
  titleLength:p.seoTitle?.length,descriptionLength:p.seoDescription?.length,alt:p.imageAlt,
  aboutChars:content.aboutHtml?.length||0,rulesChars:content.rulesHtml?.length||0,guide:p.orderGuide,
  sitemap:sitemap.includes(base+'/mehsul/'+p.seoSlug+'</loc>'),listed:listing.includes('data-product-id="'+p.id+'"')};
 if(p.active!==false){
  const path='/mehsul/'+p.seoSlug;
  const result=live?await get(path):{status:fs.existsSync('mehsul/'+p.seoSlug+'.page')?200:404,text:fs.existsSync('mehsul/'+p.seoSlug+'.page')?fs.readFileSync('mehsul/'+p.seoSlug+'.page','utf8'):''};
  row.http=result.status;row.ms=result.ms;row.canonical=result.text.match(/rel="canonical" href="([^"]+)/)?.[1];
  row.h1=[...result.text.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map(m=>m[1]);
  row.meta=result.text.match(/name="description" content="([^"]+)/)?.[1];
  row.robots=result.text.match(/name="robots" content="([^"]+)/)?.[1];
  row.schema=[...result.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m=>{try{return JSON.parse(m[1])['@graph']||[JSON.parse(m[1])];}catch{return [{error:'invalid JSON'}];}});
 }
 rows.push(row);
 console.log(JSON.stringify({id:row.id,active:row.active,http:row.http,listed:row.listed,sitemap:row.sitemap,rulesChars:row.rulesChars,canonical:row.canonical}));
}
fs.mkdirSync('outputs/product-seo-audit',{recursive:true});
fs.writeFileSync('outputs/product-seo-audit/'+(live?'live':'local')+'-audit.json',JSON.stringify({at:new Date().toISOString(),categories:state.categories,rows},null,2));
