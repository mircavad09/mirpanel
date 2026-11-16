// Explicit metadata maintenance; preserve slugs, prices, stock and order settings.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {productSeoCopy} from '../product-seo-content.mjs';
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('{',source.indexOf('const DATA'));
let depth=0,quoted=false,escaped=false,end;
for(let i=start;i<source.length;i++){
 const ch=source[i];
 if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
 if(ch==='"'){quoted=true;continue;}
 if(ch==='{')depth++;if(ch==='}'&&--depth===0){end=i+1;break;}
}
if(!end)throw Error('Catalog boundary missing');
const data=JSON.parse(source.slice(start,end)),before=structuredClone(data);
const touched=[];
for(const p of data.products){
 if(p.active===false)continue;
 const copy=productSeoCopy(p);
 const patch={seoTitle:copy.title,seoDescription:copy.description,seoH1:copy.name,
  seoKeywords:copy.queries,seoPrimaryKeyword:copy.queries.split(',')[0],seoRelatedKeywords:copy.queries.split(',').slice(1).join(','),
  seoContent:copy.intro,longDescription:copy.intro+' '+copy.usage,seoOgTitle:copy.title,seoOgDescription:copy.description,
  imageAlt:copy.name+' — MirPanel məhsul şəkli'};
 if(Object.entries(patch).some(([key,value])=>p[key]!==value)){
  Object.assign(p,patch,{seoUpdatedAt:new Date().toISOString()});touched.push(p.id);
 }
}
const stripSeo=d=>({...d,products:d.products.map(p=>Object.fromEntries(Object.entries(p).filter(([k])=>!k.startsWith('seo')&&!['imageAlt','longDescription'].includes(k))))});
assert.deepEqual(stripSeo(data),stripSeo(before),'Non-SEO catalog fields must not change');
let next=source.slice(0,start)+JSON.stringify(data,null,2)+source.slice(end);
// The public About tab is a CMS override, separate from SEO metadata.
// Replace only its copy; preserve usage rules and all private guide settings.
const marker=next.indexOf('const ADMIN_CONTENT = ');
const contentStart=next.indexOf('{',marker),contentEnd=next.indexOf('\n};',contentStart)+2;
if(marker<0||contentEnd<contentStart)throw Error('About content boundary missing');
const content=JSON.parse(next.slice(contentStart,contentEnd));
const escape=text=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const p of data.products.filter(p=>p.active!==false)){
 const copy=productSeoCopy(p);
 content[p.id]={...content[p.id],aboutHtml:'<p>'+escape(copy.intro)+'</p>'};
}
next=next.slice(0,contentStart)+JSON.stringify(content,null,2)+next.slice(contentEnd);
fs.writeFileSync('app.js',next);
console.log(JSON.stringify({updated:touched,unchangedCommerce:true}));
