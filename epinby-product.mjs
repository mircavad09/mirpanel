// Shared, non-secret provider contract. Unsupported fields fail closed.
export function epinbyProduct(value,id){
 if(!value||value.provider!=='epinby'||String(value.productId)!==String(id).replace(/^epinby_/,''))return null;
 if(!['TOPUP','VOUCHER'].includes(value.type)||!Array.isArray(value.fields)||value.fields.length>8)return null;
 const fields=[];
 for(const f of value.fields){
  if(!f||!['player_id','server_id','input_2','input_3','input_4','input_5','input_6','input_7','input_8'].includes(f.key)||fields.some(x=>x.key===f.key))return null;
  const options=Array.isArray(f.options)?f.options.map(x=>typeof x==='string'?x:x?.value):[];
  if(options.some(x=>typeof x!=='string'))return null;
  fields.push({key:f.key,label:String(f.label||f.key).slice(0,100),required:!!f.required,type:options.length?'select':'text',options,maxLength:400,enabled:true});
 }
 if(value.type==='TOPUP'&&!fields.some(f=>f.key==='player_id'&&f.required))return null;
 return {provider:'epinby',productId:Number(value.productId),type:value.type,gameId:Number(value.gameId)>0?Number(value.gameId):null,categoryId:Number(value.categoryId)>0?Number(value.categoryId):null,fields};
}
