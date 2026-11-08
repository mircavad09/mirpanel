// Generate delivery-only WebP variants from the current catalog originals.
// Originals, product records, and CMS image URLs remain untouched.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const sharp=createRequire(new URL('../receipt-worker/package.json',import.meta.url))('sharp');
const state=extractAdminState(await fs.readFile('app.js','utf8'));
const paths=[...new Set(state.products.map(p=>new URL(p.image,'https://mirpanel.com')).filter(u=>u.hostname==='mirpanel.com').map(u=>u.pathname))].sort();
const results=[];
for(const path of paths){
 if(!/^\/uploads\/products\/[a-z0-9_-]+\.png$/i.test(path))continue;
 const original=path.slice(1),size=(await fs.stat(original)).size;
 if(size<500_000)continue;
 const variant=original.replace(/\.png$/i,'.perf.webp');
 const converted=await sharp(original).resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).webp({quality:89,effort:5}).toBuffer();
 if(converted.length>=size*.75)continue;
 await fs.writeFile(variant,converted);
 results.push([path,size,converted.length]);
}
console.log(JSON.stringify(results));
