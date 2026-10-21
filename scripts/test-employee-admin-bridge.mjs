import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
import {createPaymentStore} from '../mirpanel-admin/payment-store.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const id=crypto.randomUUID(),flow={state:'EMPLOYEE_ACCEPTED',employeeName:'Fixture İşçi',acceptedAt:'2026-10-21T10:00:00Z'};
const config={supabaseUrl:'https://test.invalid',supabaseSecretKey:'fixture',receiptsBucket:'private-fixture',encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64'),allowedOrigins:[],employeeEnabled:true};
let captured;
const system=createPaymentSystem({config,json:(_r,s,b)=>captured={status:s,body:b},readBody:async()=>({}),requireAuth:()=>({}),requireMutationAuth:()=>({}),loadCatalog:async()=>({products:[]}),actorName:'fixture',store:{listOrders:async()=>({orders:[{id}]}),workforceOrders:async ids=>{eq(ids,[id]);return new Map([[id,flow]]);}},mailer:{}});
eq(await system.handle({url:'/api/admin/payment-orders',method:'GET',headers:{},socket:{}},{}),true);
eq(captured.status,200);eq(captured.body.orders[0].workforce,flow);
const source=fs.readFileSync('mirpanel-admin/public/payment-admin.js','utf8');
const card=source.match(/  function orderCard\(order\) \{[\s\S]+?\n  \}/)[0];
const render=new Function('paymentState','escp','money','dateTime','calendarDate','reservationLabel','statusLabel','copyButton','orderHistory',card+';return orderCard;')({orderQuery:{tab:'pending'},selectedOrderIds:new Set()},v=>String(v??''),v=>String(v),v=>String(v??''),v=>String(v??''),{}, {},()=>'',()=> '');
const html=render({id,orderCode:'TEST',status:'reviewing',workforce:flow});
eq(html.includes('Fixture İşçi'),true);eq(html.includes('İşçi qəbul edib'),true);eq(html.includes('href="/admin/workforce"'),true);eq(html.includes('data-approve-payment'),false);
eq(render({id,orderCode:'OLD',status:'reviewing'}).includes('data-approve-payment'),true);
const originalFetch=globalThis.fetch;let active=true;
try {
 globalThis.fetch=async(input,init={})=>{eq(init.method||'GET','GET');const u=new URL(String(input));const rows=u.pathname.endsWith('/employee_accounts')?(active?[{employee_started_at:'2026-10-21T00:00:00Z'}]:[]):[
 {id:'old',created_at:'2024-01-01',canonical_plan_id:'fixture',employee_order_assignments:[]},
 {id:'new',created_at:'2026-10-22',canonical_plan_id:'fixture',employee_order_assignments:[]},
 {id:'assigned',created_at:'2026-10-22',canonical_plan_id:'fixture',employee_order_assignments:[{...flow,employee_accounts:{display_name:'Fixture İşçi'}}]}];return new Response(JSON.stringify(rows),{headers:{'Content-Type':'application/json'}});};
 const store=createPaymentStore(config);let mapping=await store.workforceOrders(['old','new','assigned']);
 eq(mapping.get('old'),null);eq(mapping.get('new').state,'NEW');eq(mapping.get('assigned').employeeName,'Fixture İşçi');
 active=false;mapping=await store.workforceOrders(['old','new','assigned']);eq(mapping.get('new'),null);eq(mapping.get('assigned').employeeName,'Fixture İşçi');
} finally {globalThis.fetch=originalFetch;}
console.log(JSON.stringify({ok:true,checks,legacyAdminBridge:true,preStartOwnerFlowPreserved:true,realDataWrites:0},null,2));
