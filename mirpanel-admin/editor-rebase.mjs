import {createHash} from 'node:crypto';
import {isDeepStrictEqual as equal} from 'node:util';
import {mergeAdminPayload,normalizeAdminPayload} from './core.mjs';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const safe=key=>!['__proto__','constructor','prototype'].includes(key);
const keys=(...values)=>new Set(values.flatMap(value=>Object.keys(value??{})).filter(safe));

export function editorIntent(base,edited){
 return normalizeAdminPayload(mergeAdminPayload(base,edited));
}

export function rebaseEditorContent(base,mine,latest,choices={}){
 const conflicts=[];
 function conflict(before,edited,current,path){
  const token=createHash('sha256').update(JSON.stringify([path,before,edited,current])).digest('hex');
  if(choices?.[token]==='mine')return edited;
  if(choices?.[token]==='latest')return current;
  conflicts.push({token,path,mine:edited??null,latest:current??null});
  return current;
 }
 function merge(before,edited,current,path){
  if(equal(before,edited)||equal(edited,current))return current;
  if(equal(before,current))return edited;
  if([before,edited,current].every(object)){
   const result={};
   for(const key of keys(before,edited,current)){
    // Both names represent the same product setting. The normalizer regenerates the alias.
    if(key==='orderConfirmation'&&path[0]==='products'&&path.length===2)continue;
    const value=merge(before[key],edited[key],current[key],[...path,key]);
    if(value!==undefined)result[key]=value;
   }
   return result;
  }
  const identity=path.length===1?({products:'id',categories:'key'})[path[0]]:null;
  if(identity&&[before,edited,current].every(Array.isArray)){
   const maps=[before,edited,current].map(rows=>new Map(rows.map(row=>[row[identity],row])));
   const order=equal(before.map(row=>row[identity]),edited.map(row=>row[identity]))?current:edited;
   const ids=new Set([...order,...current,...edited].map(row=>row[identity]));
   return [...ids].map(id=>merge(...maps.map(map=>map.get(id)),[...path,id])).filter(value=>value!==undefined);
  }
  return conflict(before,edited,current,path);
 }
 // Compare the same JSON representation the editor and GitHub exchange.
 const [before,edited,current]=[base,mine,latest].map(value=>JSON.parse(JSON.stringify(value)));
 const merged=merge(before,edited,current,[]);
 return {data:conflicts.length?null:normalizeAdminPayload(merged),conflicts};
}
