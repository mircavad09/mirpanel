import pg from 'pg';
import {guardPoolErrors} from './pool-recovery.mjs';
import {extractAdminState} from './core.mjs';
import {createSign} from 'node:crypto';
import {createPaymentSecurity} from './payment-security.mjs';
import {supplierRequest} from './supplier-request.mjs';
let pool;
async function integrationReads(env,c){
 const components={};
 try{
  const row=(await c.query('select api_key_cipher from epinby_connection where id=true')).rows[0];
  const security=createPaymentSecurity({encryptionKey:env.PAYMENT_ENCRYPTION_KEY_B64,tokenSecret:env.PAYMENT_TOKEN_SECRET_B64});
  const result=await supplierRequest({base:'https://epinby.com',path:'/api/v1/getMe',allowlist:new Set(['https://epinby.com']),key:security.decryptSecret(row.api_key_cipher),authHeader:'X-API-Key',jsonResponse:true,maxResponseBytes:65536});
  components.epinby={ok:result?.success===true,readOnly:true};
 }catch{components.epinby={ok:false,readOnly:true};}
 try{
  const account=JSON.parse(env.NETFLIX_ROOM_SHEET_SERVICE_ACCOUNT),now=Math.floor(Date.now()/1000),b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const claims=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:account.client_email,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+300,scope:'https://www.googleapis.com/auth/spreadsheets.readonly'});
  const signature=createSign('RSA-SHA256').update(claims).sign(account.private_key,'base64url');
  const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:claims+'.'+signature}),signal:AbortSignal.timeout(10000)});
  if(!auth.ok)throw Error('AUTH');const {access_token}=await auth.json();
  const sheet=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+env.NETFLIX_ROOM_SHEET_ID+'?fields=spreadsheetId,sheets.properties.sheetId',{headers:{Authorization:'Bearer '+access_token},signal:AbortSignal.timeout(10000)});
  components.sheets={ok:sheet.ok,readOnly:true};
 }catch{components.sheets={ok:false,readOnly:true};}
 return components;
}
export async function readOnlyDeploymentProbe(env,loadCatalog){
 pool??=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,max:1,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},connectionTimeoutMillis:15000,options:'-c default_transaction_read_only=on -c statement_timeout=15000 -c search_path=mirpanel_community,public'});
 guardPoolErrors(pool,'DEPLOYMENT_PROBE');
 const started=performance.now(),c=await pool.connect();
 try{
  await c.query('begin read only');
  const times=[];for(let i=0;i<5;i++){const at=performance.now();await c.query('select 1');times.push(Math.round((performance.now()-at)*10)/10);}
  const state=(await c.query(`select current_setting('transaction_read_only')='on' read_only,
   (select count(*)::int from public.payment_orders where status not in ('cancelled','rejected','expired','completed')) active_orders,
   (select count(*)::int from mirpanel_community.customer_order_deliveries) deliveries,
   (select count(*)::int from storage.buckets) storage_buckets`)).rows[0];
  await c.query('rollback');
  const at=performance.now(),catalog=extractAdminState((await loadCatalog()).source);
  const catalogMs=Math.round(performance.now()-at),components=await integrationReads(env,c);
  return {ok:true,database:state,queryMs:times,dbTotalMs:Math.round(performance.now()-started),catalogMs,catalogProducts:catalog.products?.length||0,components};
 }finally{await c.query('rollback').catch(()=>{});c.release();}
}
