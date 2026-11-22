import fs from 'node:fs';
import {fiveGameDrafts} from './five-game-drafts.mjs';
const source=fs.readFileSync('app.js','utf8');
const match=/const DATA = (\{[\s\S]*?\n\});/.exec(source);
if(!match)throw Error('Expected JSON catalog declaration was not found');
const data=JSON.parse(match[1]);
const manifest=JSON.parse(fs.readFileSync('catalog/five-games-20261122.json','utf8'));
const result=fiveGameDrafts(data.products,manifest);
if(result.report.some(r=>r.added)){
 data.products=result.products;
 fs.writeFileSync('app.js',source.replace(match[0],'const DATA = '+JSON.stringify(data,null,2)+';'));
}
console.log(JSON.stringify(result.report,null,2));
