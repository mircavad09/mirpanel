import {epinbyPlan} from '../epinby-product.mjs';
import {supplierRequest} from './supplier-request.mjs';
const intervalMs=60000;
const integer=value=>(typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isSafeInteger(Number(value))?Number(value):NaN;
const scope=s=>JSON.stringify([s.gameId||null,s.categoryId||null]);
export function epinbyStockState(product){
 if(!product||product.active===false||product.is_active===false)return {status:'out',count:0};
 const status=String(product.stock_status||'').toUpperCase();
 if(['INFINITE','UNLIMITED'].includes(status))return {status:'available',count:null};
 if(status==='FINITE'&&Number.isSafeInteger(integer(product.stock_count))&&Number(product.stock_count)>=0)
  return {status:Number(product.stock_count)>0?'available':'out',count:Number(product.stock_count)};
 if(['OUT_OF_STOCK','UNAVAILABLE'].includes(status))return {status:'out',count:0};
 return {status:'unknown',count:null,reason:'invalid_stock'};
}
// Public availability cache only. Never writes product flags or inventory counts.
export function createEpinbyStock({pool,security,catalog,transport=supplierRequest,now=Date.now}){
 const groups=new Map();let pending,timer,version;
 function selections(data){
  const all=new Map();for(const p of data.products||[])for(const plan of p.plans||[]){
   const s=epinbyPlan(p,plan);if(!s||s.type==='TELEGRAM_STARS')continue;
   all.set(scope(s),s);
  }return all;
 }
 async function fetchGroup(row,s){
  const products=new Map();let last,total;
  for(let page=1;;page++){
   const r=await transport({base:'https://epinby.com',path:'/api/v1/products',key:security.decryptSecret(row.api_key_cipher),
    authHeader:'X-API-Key',allowlist:new Set(['https://epinby.com']),jsonResponse:true,includeErrorCode:true,maxResponseBytes:524288,
    query:{page,per_page:100,...(s.gameId?{game_id:s.gameId}:{}),...(s.categoryId?{category_id:s.categoryId}:{})}});
   const l=integer(r?.meta?.last_page),t=integer(r?.meta?.total);
   if(r?.success!==true||!Array.isArray(r.data)||integer(r.meta?.current_page)!==page||!Number.isSafeInteger(l)||l<0||l>10000||!Number.isSafeInteger(t)||t<0||l===0&&t!==0||page>1&&(l!==last||t!==total))throw Error('INCOMPLETE_CATALOG');
   last=l;total=t;
   for(const p of r.data){
    const id=Number(p?.id);
    if(!Number.isSafeInteger(id)||id<1||products.has(id)||s.gameId&&Number(p.game_id)!==s.gameId||s.categoryId&&Number(p.category_id)!==s.categoryId)throw Error('INCOMPLETE_CATALOG');
    products.set(id,p);
   }
   if(page>=last)break;
  }
  if(products.size!==total)throw Error('INCOMPLETE_CATALOG');
  return products;
 }
 async function refresh(){
  if(pending)return pending;
  pending=(async()=>{
   const data=await catalog(),selected=selections(data);let row;
   for(const key of groups.keys())if(!selected.has(key))groups.delete(key);
   if(![...selected.keys()].some(key=>!groups.has(key)||now()>=groups.get(key).nextAt))return;
   try{row=(await (await pool()).query('select api_key_cipher,last_status,credential_version from mirpanel_community.epinby_connection where id=true')).rows[0];}
   catch{row=null;}
   if(row?.credential_version!==version){groups.clear();version=row?.credential_version;}
   for(const [key,s]of selected){
    const old=groups.get(key);if(old&&now()<old.nextAt)continue;
    try{
     if(row?.last_status!=='confirmed'||!row.api_key_cipher)throw Error('CONNECTION_UNAVAILABLE');
     const products=await fetchGroup(row,s),at=now();
     groups.set(key,{products,checkedAt:at,nextAt:at+intervalMs,failures:0,ok:true});
    }catch(error){
     const at=now(),failures=(old?.failures||0)+1;
     groups.set(key,{products:old?.products,checkedAt:old?.checkedAt||null,ok:false,failures,
      reason:error.supplierStatus===429?'rate_limit':error.message==='INCOMPLETE_CATALOG'?'incomplete_catalog':'connection',
      nextAt:at+Math.min(300000,intervalMs*2**Math.min(failures-1,3))});
    }
   }
  })().finally(()=>pending=null);return pending;
 }
 function state(s){
  const g=groups.get(scope(s));
  if(!g?.ok||now()-g.checkedAt>90000)return {provider:'epinby',status:'unknown',count:null,checkedAt:g?.checkedAt?new Date(g.checkedAt).toISOString():null,reason:g?.reason||'not_checked',intervalMs};
  return {provider:'epinby',...epinbyStockState(g.products.get(s.productId)),checkedAt:new Date(g.checkedAt).toISOString(),intervalMs};
 }
 function decorate(data,rows){
  const result=structuredClone(rows);
  for(const p of data.products||[]){
   const bound=(p.plans||[]).map((plan,i)=>({s:epinbyPlan(p,plan),i})).filter(x=>x.s&&x.s.type!=='TELEGRAM_STARS');if(!bound.length)continue;
   let row=result.find(r=>r.productId===p.id);if(!row){row={productId:p.id,plans:[]};result.push(row);}row.plans??=[];
   for(const {s,i}of bound){let plan=row.plans.find(x=>x.planKey===String(i));if(!plan){plan={planKey:String(i)};row.plans.push(plan);}plan.supplierStock=state(s);}
  }return result;
 }
 return {refresh,decorate,intervalMs,start(){if(timer)return;void refresh().catch(()=>{});timer=setInterval(()=>void refresh().catch(()=>{}),5000);timer.unref?.();},stop(){clearInterval(timer);timer=null;}};
}
