// Shared catalog field contract. Values are kept out of URLs and browser storage.
export function checkoutFields(product,plan={}){
 if(product.id==='netflix')return [];
 let fields=Array.isArray(plan.formFields)?plan.formFields:Array.isArray(product.formFields)?product.formFields:null;
 if(!fields?.length&&!Array.isArray(plan.formFields)&&!Array.isArray(product.formFields)){
  if(product.id==='spotify')fields=[{key:'email',label:'E-poçt',type:'email',required:true},{key:'password',label:'Şifrə',type:'password',required:true}];
  else if(['hbomax','prime'].includes(product.id))fields=[{key:'name',label:'Ad',required:true},{key:'code_'+(product.id==='prime'?5:4),label:'Kod / PIN',digits:product.id==='prime'?5:4,required:true}];
  else if(['canva','google_ai'].includes(product.id))fields=[{key:'email',label:'E-poçt',type:'email',required:true}];
 }
 return (fields||[]).filter(f=>f.enabled!==false&&f.key!=='password_confirm'&&f.privateConfirmation!==true).map((f,i)=>{const key=String(f.key||f.label||'field_'+i),digits=Number(f.digits)||Number(key.match(/^code_([45])$/)?.[1])||Number(String(f.label).match(/([45]) rəqəm/i)?.[1])||0;return{key,label:String(f.label||key),type:f.type==='password'?'password':f.type==='email'?'email':f.type==='select'?'select':f.type==='textarea'?'textarea':'text',description:String(f.description||''),placeholder:String(f.placeholder||''),required:!!f.required,digits,minLength:Number(f.minLength)||0,maxLength:Math.min(400,Number(f.maxLength)||400),options:Array.isArray(f.options)?f.options.map(String):[],sensitive:f.type==='password'||!!digits};});
}
export function validateDetails(fields,value){
 if(value==null)value={};if(typeof value!=='object'||Array.isArray(value))throw Error('Sifariş məlumatı düzgün deyil.');
 const keys=new Set(fields.map(f=>f.key));if(Object.keys(value).some(k=>!keys.has(k)))throw Error('Sifariş məlumatı bu paketə uyğun deyil.');
 const clean={};for(const f of fields){let v=value[f.key]??'';if(typeof v!=='string'||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw Error('Sifariş məlumatı düzgün deyil.');if(f.type!=='password')v=v.trim();if(f.required&&!v||v&&(v.length>f.maxLength||v.length<f.minLength||f.digits&&!new RegExp('^\\d{'+f.digits+'}$').test(v)||f.type==='email'&&!/^\S+@\S+\.\S+$/.test(v)||f.type==='select'&&!f.options.includes(v)))throw Error('«'+f.label+'» sahəsini düzgün doldurun.');if(v)clean[f.key]=v;}
 return clean;
}
export function maskedDetails(fields,value){return fields.filter(f=>Object.hasOwn(value||{},f.key)).map(f=>({label:f.label,value:f.sensitive?'••••••':value[f.key]}));}
