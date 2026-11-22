import fs from 'node:fs';
import assert from 'node:assert/strict';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {organizationSchema,withSiteIdentity} from '../site-identity.mjs';
const s=extractAdminState(fs.readFileSync('app.js','utf8'));
const pages=generateProductPageFiles(s.products,s.siteSections,s.cms,s.content);
for(const [file,html] of pages){
 assert(html.includes('Azərbaycanda ')&&html.includes('necə alınır?'),file+' purchase answer in initial HTML');
 assert(html.includes('+994 51 411 35 45')&&html.includes('11:00–01:00'),file+' visible contact and hours');
 const graphs=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 const nodes=graphs.flatMap(x=>x['@graph']||[x]);
 assert.deepEqual(nodes.find(x=>x['@id']==='https://mirpanel.com/#organization'),organizationSchema());
 assert.equal(withSiteIdentity(html),html,file+' identity transform idempotent');
 assert(!html.includes('dərhal cavab alacaqsınız'));
}
const hbo=s.products.find(p=>p.id==='hbomax');assert.equal(hbo.plans[0].warrantyDuration,28);
assert(pages.get('mehsul/hbo-max.page').includes('28 gün'));
assert.equal(s.products.find(p=>p.id==='telegram_premium').seoIndex,false);
assert.equal(s.products.find(p=>p.id==='google_ai_ultra').active,false);
const robots=fs.readFileSync('robots.txt','utf8');
for(const path of ['/admin','/api/','/preview/','/employee'])assert(robots.includes('Disallow: '+path));
assert.equal(withSiteIdentity('<header>fragment</header>'),'<header>fragment</header>');
assert(fs.readFileSync('site-header.js','utf8').includes('/customer-footer.js?v=geo-identity-1'));
assert(fs.readFileSync('functions/_middleware.js','utf8').includes('/site-header.js?v=catalog-search-1-geo-identity-1'));
console.log(JSON.stringify({initialHtmlProducts:pages.size,identity:true,faq:true,approvedHboWarranty:28,privateRobotsPreserved:true}));
