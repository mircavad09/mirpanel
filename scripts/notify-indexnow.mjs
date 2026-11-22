// Notify only explicitly supplied, already published canonical URLs.
// A 200/202 is receipt, never an indexing or ranking guarantee.
import fs from 'node:fs';
const host='mirpanel.com',key='d5748277660adec6b7276a56b5e4063c';
const urlList=[...new Set(process.argv.slice(2))];
if(!urlList.length)throw Error('Supply changed public canonical HTTPS URLs');
const sitemap=await fetch(`https://${host}/sitemap.xml`,{signal:AbortSignal.timeout(20000)}).then(r=>{if(!r.ok)throw Error('Sitemap unavailable');return r.text();});
for(const value of urlList){
 const u=new URL(value);
 if(u.origin!==`https://${host}`||u.search||u.hash||!sitemap.includes(`<loc>${value}</loc>`))throw Error('URL not a public sitemap canonical: '+value);
 const r=await fetch(value,{redirect:'manual',signal:AbortSignal.timeout(20000)}),html=await r.text();
 if(r.status!==200||/noindex/i.test(r.headers.get('x-robots-tag')||'')||/<meta[^>]*content=["'][^"']*noindex/i.test(html))throw Error('Not indexable: '+value);
}
const proof=await fetch(`https://${host}/${key}.txt`,{redirect:'manual',signal:AbortSignal.timeout(20000)});
if(proof.status!==200||(await proof.text()).trim()!==key)throw Error('Live key verification failed');
const response=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({host,key,urlList}),signal:AbortSignal.timeout(30000)});
const result={checkedAt:new Date().toISOString(),status:response.status,response:await response.text(),urlList,meaning:'Notification receipt only; indexing remains at search engine discretion'};
fs.mkdirSync('outputs/geo',{recursive:true});fs.writeFileSync('outputs/geo/indexnow.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));if(![200,202].includes(response.status))process.exitCode=1;
