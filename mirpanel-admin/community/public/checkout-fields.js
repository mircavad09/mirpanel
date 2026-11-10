// Shared catalog field contract. Values are kept out of URLs and browser storage.
export function checkoutFields(product,plan={}){
 let fields=Array.isArray(plan.formFields)?plan.formFields:Array.isArray(product.formFields)?product.formFields:null;
 if(!fields?.length&&!Array.isArray(plan.formFields)&&!Array.isArray(product.formFields)){
  if(product.id==='spotify')fields=[{key:'email',label:'E-poçt',type:'email',required:true},{key:'password',label:'Şifrə',type:'password',required:true}];
  else if(['hbomax','prime'].includes(product.id))fields=[{key:'name',label:'Ad',required:true},{key:'code_'+(product.id==='prime'?5:4),label:'Kod / PIN',digits:product.id==='prime'?5:4,required:true}];
  else if(['canva','google_ai'].includes(product.id))fields=[{key:'email',label:'E-poçt',type:'email',required:true}];
 }
 return (fields||[])
  .filter(f=>f&&f.enabled!==false&&f.key!=='password_confirm'&&f.privateConfirmation!==true)
  // Stock supplies the Netflix room and PIN; old catalogue inputs must not ask for them.
  .filter(f=>product.id!=='netflix'||!['name','code_4','pin','roomName','roomCode'].includes(f.key))
  .map((field,index)=>({field,index}))
  .sort((a,b)=>(Number(a.field.order)||a.index+1)-(Number(b.field.order)||b.index+1))
  .map(({field:f,index})=>{
   const key=String(f.key||f.label||'field_'+index);
   const digits=fieldDigits(f);
   const type=['password','email','tel','select','textarea'].includes(f.type)?f.type:'text';
   return {key,label:String(f.label||key),type,description:String(f.description||''),
    placeholder:String(f.placeholder||''),required:!!f.required,digits,
    minLength:Number(f.minLength)||0,maxLength:Math.min(400,Number(f.maxLength)||400),
    options:Array.isArray(f.options)?f.options.map(String):[],sensitive:type==='password'||!!digits};
  });
}
function fieldDigits(field){
 const saved=Number(field.digits);
 if(Number.isInteger(saved)&&saved>0&&saved<=10)return saved;
 if(field.type==='pin')return 4;
 if(field.digits!=null)return 0;
 return Number(String(field.key).match(/^code_([45])$/)?.[1])||
  Number(String(field.label).match(/([45]) rəqəm/i)?.[1])||0;
}
export function validateDetails(fields,value){
 if(value==null)value={};if(typeof value!=='object'||Array.isArray(value))throw Error('Sifariş məlumatı düzgün deyil.');
 const keys=new Set(fields.map(f=>f.key));if(Object.keys(value).some(k=>!keys.has(k)))throw Error('Sifariş məlumatı bu paketə uyğun deyil.');
 const clean={};for(const f of fields){let v=value[f.key]??'';if(typeof v!=='string'||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw Error('Sifariş məlumatı düzgün deyil.');if(f.type!=='password')v=v.trim();if(f.required&&!v||v&&(v.length>f.maxLength||v.length<f.minLength||f.digits&&!new RegExp('^\\d{'+f.digits+'}$').test(v)||f.type==='email'&&!/^\S+@\S+\.\S+$/.test(v)||f.type==='select'&&!f.options.includes(v)))throw Error('«'+f.label+'» sahəsini düzgün doldurun.');if(v)clean[f.key]=v;}
 return clean;
}
export function maskedDetails(fields,value){return fields.filter(f=>Object.hasOwn(value||{},f.key)).map(f=>({label:f.label,value:f.sensitive?'••••••':value[f.key]}));}
