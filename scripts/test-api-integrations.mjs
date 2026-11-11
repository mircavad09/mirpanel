import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createApiIntegrations} from '../mirpanel-admin/api-integrations.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {adminDelivery} from '../mirpanel-admin/community/order-delivery.mjs';
import {approvedUrl} from '../mirpanel-admin/supplier-request.mjs';

// Requires a fresh local PostgreSQL test database and an installed Postgres.js driver.
const url = new URL(process.env.SUPPLIER_TEST_DATABASE_URL);
assert.equal(url.hostname,'127.0.0.1');
assert.match(url.pathname,/^\/supplier_test/);
const {default:postgres} = await import(process.env.SUPPLIER_TEST_POSTGRES_DRIVER);
const sql = postgres(url.href,{max:5});
const wrap = client => async (statement,values=[]) => {
  const rows = await client.unsafe(statement,values.map(v=>Array.isArray(v) ? '{'+v.join(',')+'}' : v && typeof v==='object' ? sql.json(v) : v));
  return {rows,rowCount:rows.count};
};
const pool = {
  query:wrap(sql),
  async connect() {
    const c=await sql.reserve();
    return {query:wrap(c),release:()=>c.release()};
  }
};
const jobs = 'mirpanel_community.api_dispatches';
const key = Buffer.alloc(32,5).toString('base64');
const security = createPaymentSecurity({encryptionKey:key,tokenSecret:key});
const orders = new Map();
let creates = 0;
const fixture = createServer(async (req,res)=>{
  if (req.headers.authorization!=='Bearer test-key') { res.writeHead(401).end(); return; }
  const url=new URL(req.url,'http://localhost');
  if (url.pathname==='/health') { res.writeHead(200).end(); return; }
  res.setHeader('Content-Type','application/json');
  if (req.method==='POST') {
    creates++;
    let data='';
    for await (const chunk of req) data+=chunk;
    const body=JSON.parse(data);
    orders.set(body.reference,body);
    if (body.player==='22222') { res.destroy(); return; }
    res.end(JSON.stringify({id:'supplier-'+creates,status:'completed'}));
    return;
  }
  const body=orders.get(url.searchParams.get('reference'));
  res.end(JSON.stringify(body ? {id:'supplier-2',status:'completed'} : {status:'missing'}));
});
try {
  await sql.unsafe(`
    do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    end $$;
    create schema mirpanel_community;
    create table public.payment_orders(id uuid primary key, order_code text, status text,
      payment_confirmed boolean, checkout_snapshot jsonb,created_at timestamptz default now());
    create table mirpanel_community.community_order_owners(order_id uuid);
    create table mirpanel_community.customer_order_deliveries(id uuid primary key,order_id uuid,
      line_index int, quantity int,message_cipher text,actor text,delivered_at timestamptz default now());
    create table mirpanel_community.customer_order_mail(event_key text primary key,order_id uuid,delivery_id uuid);
  `);
  await sql.unsafe(await readFile(new URL('../supabase/migrations/202611090901_api_integrations.sql',import.meta.url),'utf8'));
  await sql.unsafe(await readFile(new URL('../supabase/migrations/202611090902_api_integration_drafts.sql',import.meta.url),'utf8'));
  const migration=await sql.reserve();
  try{await migration.unsafe(await readFile(new URL('../supabase/migrations/202611110002_epinby_execution.sql',import.meta.url),'utf8'));}finally{migration.release();}
  fixture.listen(0,'127.0.0.1');
  await once(fixture,'listening');
  const base='https://supplier.example';
  const origins=new Set([base,'https://127.0.0.1','https://localtest.me']);
  assert.throws(()=>approvedUrl('https://127.0.0.1','/health',origins));
  assert.throws(()=>approvedUrl(base,'//outside.example',origins));
  assert.throws(()=>approvedUrl('http://supplier.example','/health',origins));
  assert.throws(()=>approvedUrl(base,'/../health',origins));
  const plan={id:'uc60',label:'60 UC'};
  const api=createApiIntegrations({
    pool:()=>pool,security,origins:base,
    loadCatalog:async()=>({products:[{id:'pubg',title:'PUBG Mobile',plans:[plan]}]}),
    transport:async ({path,key,body,reference})=>{
      const u=new URL(path,'http://127.0.0.1:'+fixture.address().port);
      if (reference&&!body) u.searchParams.set('reference',reference);
      const res=await fetch(u,{
        headers:{Authorization:'Bearer '+key},method:body?'POST':'GET',
        ...(body?{body:JSON.stringify(body)}:{})
      });
      if (!res.ok) throw Object.assign(Error('SUPPLIER_HTTP'),{supplierStatus:res.status});
      return reference ? res.json() : null;
    }
  });
  await api.admin({action:'add',name:'Sınaq',base,key:'test-key',testPath:'/health'});
  const data=await api.admin();
  const supplierId=data.suppliers[0].id;
  assert.ok(!JSON.stringify(data).includes('test-key'));
  const [{key_cipher}]=await sql`select key_cipher from mirpanel_community.api_suppliers`;
  assert.notEqual(key_cipher,'test-key');
  assert.deepEqual(await api.admin({action:'test',supplierId}),{ok:true});
  assert.equal(creates,0);
  const mapping={action:'map',supplierId,productId:'pubg',plan:data.products[0].plans[0].key,
    active:true,settings:{serviceId:'60',orderPath:'/orders',statusPath:'/status',
      idField:'id',statusField:'status',success:['completed'],failure:['failed'],
      fields:{service:'serviceId',reference:'reference',quantity:'quantity',player:'customer.Oyunçu ID-si'}}};
  const newSupplier={...mapping,action:'activate',supplierId:'',name:'Sınaq 2',base,testPath:'/health'};
  const blocked=await api.admin({...newSupplier,base:'https://outside.example',key:'test-key'});
  assert.equal(blocked.reason,'API ünvanı icazə siyahısında deyil.');
  const failed=await api.admin({...newSupplier,key:'wrong-key'});
  assert.equal(failed.reason,'Təchizatçı giriş açarını qəbul etmədi.');
  const drafts=(await api.admin()).drafts;
  assert.equal(drafts.length,2);
  assert.equal(drafts[0].details.key,undefined);
  assert.ok(!JSON.stringify(drafts).includes('wrong-key'));
  assert.equal((await api.admin()).mappings.length,0);
  assert.equal(creates,0);
  const activated=await api.admin({...newSupplier,draftId:blocked.draftId});
  assert.equal(activated.ok,true);
  assert.equal((await api.admin()).mappings[0].active,true);
  assert.equal((await api.admin()).drafts.length,1);
  assert.equal(creates,0);
  mapping.supplierId=activated.supplierId;
  async function order(player,paid) {
    const id=randomUUID();
    const snapshot={cartVersion:2,items:[{productId:'pubg',sourcePlanKey:mapping.plan,planName:'60 UC',
      title:'PUBG',unitCents:100,quantity:1,detailsCipher:security.encryptSecret(JSON.stringify({'Oyunçu ID-si':player}))}]};
    await pool.query('insert into public.payment_orders(id,order_code,status,payment_confirmed,checkout_snapshot) values($1,$2,$3,$4,$5)',
      [id,id,paid?'completed':'reviewing',paid,snapshot]);
    await sql`insert into mirpanel_community.community_order_owners values(${id})`;
    return id;
  }
  const card=await order('11111',false);
  await api.drain();
  assert.equal(creates,0);
  await sql`update public.payment_orders set status='approved' where id=${card}`;
  await Promise.all([api.drain(),api.drain()]);
  assert.equal(creates,1);
  const wallet=await order('22222',true);
  await api.drain();
  assert.equal(creates,2);
  assert.equal((await sql.unsafe('select state from '+jobs+' where order_id=$1',[wallet]))[0].state,'checking');
  await assert.rejects(adminDelivery(pool,security,'admin',wallet,{
    requestId:randomUUID(),line:0,quantity:1,message:'Manual delivery'
  }),{status:409});
  await sql.unsafe('update '+jobs+' set next_at=now()');
  await api.drain();
  assert.equal(creates,2);
  const status=(await api.admin()).jobs;
  assert.equal(status.filter(job=>job.state==='delivered').length,2);
  assert.equal(status.find(job=>job.order_code===wallet).external_id,'supplier-2');
  assert.equal([...orders.values()][1].player,'22222');
  await api.admin({...mapping,active:false});
  const manual=await order('33333',true);
  const delivery=await adminDelivery(pool,security,'admin',manual,{
    requestId:randomUUID(),line:0,quantity:1,message:'Manual delivery'
  });
  assert.equal(delivery.status,'completed');
  await api.drain();
  assert.equal(creates,2);
  console.log('Supplier integration passed: connection, mapping, payment gate, delivery, lost response recovery.');
} finally {
  fixture.close();
  await sql.end();
}
