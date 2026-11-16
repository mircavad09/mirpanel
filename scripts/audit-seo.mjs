import fs from 'node:fs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {productSeoSlug} from '../mirpanel-admin/product-pages.mjs';
const origin=process.env.SEO_ORIGIN||'https://mirpanel.com';
const out='outputs/seo';fs.mkdirSync(out,{recursive:true});
const catalog=await fetch(origin+'/app.js',{signal:AbortSignal.timeout(20000)});
if(!catalog.ok)throw Error('Catalog HTTP '+catalog.status);
const state=extractAdminState(await catalog.text());
const paths=['/','/mehsul','/robots.txt','/sitemap.xml','/mehsul/does-not-exist-seo-test','/netflix-sexsi-almaq','/profil','/sebet',
 ...state.products.filter(p=>p.active!==false).map(p=>'/mehsul/'+productSeoSlug(p))];
const results=[];
for(let at=0;at<paths.length;at+=3)await Promise.all(paths.slice(at,at+3).map(async path=>{
 const start=performance.now();
 try{
  const response=await fetch(origin+path,{signal:AbortSignal.timeout(25000),redirect:'manual'});
  const html=await response.text(),schemas=[];
  for(const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)){
   try{const parsed=JSON.parse(match[1]);schemas.push(...(parsed['@graph']||[parsed]));}catch{schemas.push({error:'Invalid JSON'});}
  }
  results.push({path,status:response.status,ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(html),location:response.headers.get('location'),
   robots:response.headers.get('x-robots-tag')||html.match(/name="robots" content="([^"]+)/)?.[1],
   title:html.match(/<title>(.*?)<\/title>/s)?.[1],description:html.match(/name="description" content="([^"]+)/)?.[1],
   canonical:html.match(/rel="canonical" href="([^"]+)/)?.[1],h1:[...html.matchAll(/<h1\b[^>]*>(.*?)<\/h1>/gs)].map(m=>m[1].replace(/<[^>]*>/g,'')),
   schemaTypes:schemas.map(s=>s['@type']||s.error),offers:schemas.filter(s=>s['@type']==='Product').map(s=>s.offers),
   outdatedWhatsapp:/WhatsApp sifariş axını|WhatsApp üzərindən tamamlanır/.test(html),
   hasBody:html.includes('pp-plans-container'),faq:html.includes('product-page-faq')});
 }catch(e){results.push({path,error:e.name,ms:Math.round(performance.now()-start)});}
}));
const label=process.argv[2]||'live';
fs.writeFileSync(out+'/'+label+'.json',JSON.stringify({at:new Date().toISOString(),origin,results},null,2));
console.log(JSON.stringify(results.map(({offers,...r})=>r)));
