// Credentials stay in memory. DB transaction and supplier catalog reads only.
import fs from 'node:fs';
import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {supplierRequest} from '../mirpanel-admin/supplier-request.mjs';
import {epinbyPlan} from '../epinby-product.mjs';
import {createEpinbyOrders} from '../mirpanel-admin/epinby-orders.mjs';
const renderKey=fs.readFileSync(process.env.USERPROFILE+'/.render/cli.yaml','utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const r=await fetch('https://api.render.com/v1/services/srv-dbse90u1egvs73djpp2g/env-vars?limit=100',{headers:{Authorization:'Bearer '+renderKey}});
if(!r.ok)throw Error('Render access '+r.status);const env=Object.fromEntries((await r.json()).map(x=>[x.envVar.key,x.envVar.value]));
const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},connectionTimeoutMillis:15000});
try{
 const c=await pool.connect();let row;try{await c.query('begin read only');row=(await c.query('select api_key_cipher,last_status from mirpanel_community.epinby_connection where id')).rows[0];await c.query('commit');}finally{c.release();}
 const security=createPaymentSecurity({encryptionKey:env.PAYMENT_ENCRYPTION_KEY_B64,tokenSecret:env.PAYMENT_TOKEN_SECRET_B64});
 const key=security.decryptSecret(row.api_key_cipher);const get=(path,query)=>supplierRequest({base:'https://epinby.com',path:'/api/v1/'+path,key,allowlist:new Set(['https://epinby.com']),authHeader:'X-API-Key',query,jsonResponse:true,maxResponseBytes:524288,includeErrorCode:true});
 const app=await fetch('https://mirpanel.com/app.js?game-validation-audit=1').then(r=>r.text());const catalog=extractAdminState(app);
 const mapped=catalog.products.flatMap(p=>(p.plans||[]).map((plan,index)=>({product:p.id,title:p.title,active:p.active!==false&&plan.active!==false,index,label:plan.label,supplier:epinbyPlan(p,plan)}))).filter(x=>x.supplier?.fields.length);
 const results=[];for(const m of mapped){
  const s=m.supplier,q={page:1,per_page:100,...s.gameId?{game_id:s.gameId}:{},...s.categoryId?{category_id:s.categoryId}:{}};
  const data=await get('products',q);const found=data.data?.find(x=>Number(x.id)===s.productId);
  results.push({...m,query:q,meta:data.meta,found:found||null,firstIds:data.data?.slice(0,6).map(x=>({id:x.id,name:x.name,game_id:x.game_id,category_id:x.category_id}))});
 }
 const games=await get('games');const global=await get('products',{page:1,per_page:100});
 fs.mkdirSync('outputs/game-validation',{recursive:true});fs.writeFileSync('outputs/game-validation/live-audit.json',JSON.stringify({checkedAt:new Date().toISOString(),connection:row.last_status,results,games:games.data,global:{meta:global.meta,products:global.data}},null,2));
 console.log(JSON.stringify({connection:row.last_status,mapped:results.map(x=>({product:x.product,label:x.label,active:x.active,supplierId:x.supplier.productId,gameId:x.supplier.gameId,categoryId:x.supplier.categoryId,found:!!x.found,supportsValidation:x.found?.supports_player_validation})),globalMeta:global.meta},null,2));
 if(process.argv.includes('--validate')||process.argv.includes('--public')){
  const checked=[],worker=createEpinbyOrders({pool:async()=>pool,security,loadCatalog:async()=>catalog});
  const c=await pool.connect();try{
   await c.query('begin read only');
const sample=(await c.query("select u.body_cipher from mirpanel_community.epinby_order_units u join mirpanel_community.api_dispatches d on d.id=u.dispatch_id where u.state='delivered' and (d.settings->>'productId')::bigint=any($1::bigint[]) order by u.created_at desc limit 1",[mapped.filter(x=>x.product==='free_fire').map(x=>x.supplier.productId)])).rows[0];
   const free=sample?JSON.parse(security.decryptSecret(sample.body_cipher)):null;
   for(const m of mapped.filter(x=>x.active&&x.supplier.type==='TOPUP')){
const p=catalog.products.find(x=>x.id===m.product),values=m.product==='pubg_mobile'&&process.env.MIRPANEL_VALIDATION_PUBG_ID?{player_id:process.env.MIRPANEL_VALIDATION_PUBG_ID}:m.product==='free_fire'&&free?Object.fromEntries(m.supplier.fields.filter(f=>free[f.key]!=null).map(f=>[f.key,String(free[f.key])])):null;
    if(!values){checked.push({product:m.product,package:m.label,notChecked:'No authorized known player sample'});continue;}
    let result;
    if(process.argv.includes('--public')){
     const quote=await fetch('https://mirpanel.com/api/payments/shop/quote',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://mirpanel.com'},body:JSON.stringify({items:[{productId:m.product,planIndex:m.index,quantity:1}]})});
     const q=await quote.json();if(!quote.ok)throw Error('Public quote '+quote.status);
     const response=await fetch('https://mirpanel.com/api/payments/shop/epinby-account',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://mirpanel.com',Cookie:quote.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')},body:JSON.stringify({productId:m.product,planIndex:m.index,termsVersion:q.items[0].termsVersion,values})});
     result=await response.json();if(!response.ok)throw Error('Public check '+response.status+' '+result.error);
    }else result=await worker.check(c,p,p.plans[m.index],values);
    checked.push({product:m.product,package:m.label,supplierId:m.supplier.productId,state:result.state,code:result.code,message:result.message,allowCheckout:result.allowCheckout,nameReturned:!!result.name});
   }
   await c.query('commit');
  }finally{c.release();}
  fs.writeFileSync('outputs/game-validation/'+(process.argv.includes('--public')?'public-validation':'live-validation')+'.json',JSON.stringify(checked,null,2));console.log(JSON.stringify({checks:checked,realOrders:0,realPayments:0},null,2));
 }
}finally{await pool.end();}
