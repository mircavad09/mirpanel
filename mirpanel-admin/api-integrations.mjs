import {approvedUrl,supplierRequest} from './supplier-request.mjs';
import {adminDelivery,deliveryLines,paid} from './community/order-delivery.mjs';
import {checkoutFields} from './community/public/checkout-fields.js';
import {planKey} from './payment-profit.mjs';

const schema = 'mirpanel_community';
const dispatches = schema+'.api_dispatches';
const suppliers = schema+'.api_suppliers';
const mappings = schema+'.api_mappings';
const invalid = () => Object.assign(Error('Sazlama düzgün deyil.'),{status:400});
const token = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) &&
  !['__proto__','constructor','prototype'].includes(value);
const text = (value,max) => typeof value === 'string' && value.trim() && value.length <= max;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const valueAt = (object,path) => path.split('.').reduce((value,key) =>
  value && Object.hasOwn(value,key) ? value[key] : undefined,object);

export function supplierBody(job,order,security) {
  const line = order.checkout_snapshot.items[job.line_index];
  const details = line.detailsCipher ? JSON.parse(security.decryptSecret(line.detailsCipher)) : {};
  const {fields,serviceId} = job.settings;
  const values = {serviceId,reference:job.id,quantity:line.quantity,plan:line.planName};
  return Object.fromEntries(Object.entries(fields).map(([destination,source]) => {
    const value = source.startsWith('customer.')
      ? valueAt(details,source.slice(9)) : values[source];
    if (!['string','number'].includes(typeof value) || value === '') throw Error('MISSING_FIELD');
    return [destination,value];
  }));
}

export async function dispatchResult(job,order,security,send,first) {
  try {
    const body = first ? supplierBody(job,order,security) : undefined;
    const response = await send({
      base:job.base_url, path:first ? job.settings.orderPath : job.settings.statusPath,
      key:security.decryptSecret(job.key_cipher), body, reference:job.id
    });
    const rawId = valueAt(response,job.settings.idField);
    const id = (typeof rawId === 'string' || Number.isSafeInteger(rawId)) &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(String(rawId)) ? String(rawId) : null;
    const status = valueAt(response,job.settings.statusField);
    if (job.external_id && id && job.external_id !== id) return {state:'checking',id:null};
    if ((id || job.external_id) && job.settings.success.includes(status)) return {state:'succeeded',id};
    if (job.settings.failure.includes(status)) return {state:'failed',id};
    return {state:'checking',id};
  } catch {
    return {state:'checking',id:null};
  }
}

export function createApiIntegrations({pool,security,loadCatalog,origins,transport=supplierRequest}) {
  const allowlist = new Set(String(origins || '').split(',').map(x=>x.trim()).filter(Boolean));
  const send = input => transport({...input,allowlist});
  const endpoint = (base,path) => {
    try { approvedUrl(base,path,allowlist); } catch { throw invalid(); }
  };
  async function admin(input) {
    const db = await pool();
    if (!input) {
      const [catalog, providers, links, jobs] = await Promise.all([
        loadCatalog(),db.query('select id,name,base_url,test_path from '+suppliers+' order by name'),
        db.query('select * from '+mappings+' order by product_id,plan_key'),
        db.query(`select d.id,o.order_code,d.line_index,d.state,d.external_id from ${dispatches} d
          join public.payment_orders o on o.id=d.order_id order by o.created_at desc limit 100`)
      ]);
      return {suppliers:providers.rows,mappings:links.rows,jobs:jobs.rows,origins:[...allowlist],
        products:catalog.products.map(p=>({id:p.id,title:p.title,plans:(p.plans||[]).map((plan,i)=>
          ({key:planKey(plan,i),label:plan.label||plan.name||String(i+1),
            fields:checkoutFields(p,plan).map(({key,label})=>({key,label}))}))}))};
    }
    if (input.action === 'add') {
      const {name,base,key,testPath} = input;
      if (!text(name,100)||!text(key,2048)||/[\x00-\x20\x7f-\uffff]/.test(key)) throw invalid();
      endpoint(base,testPath);
      await db.query('insert into '+suppliers+'(name,base_url,key_cipher,test_path) values($1,$2,$3,$4)',
        [name.trim(),new URL(base).origin,security.encryptSecret(key),testPath]);
      return {ok:true};
    }
    if (!uuid(input.supplierId)) throw invalid();
    const provider = (await db.query('select * from '+suppliers+' where id=$1',[input.supplierId])).rows[0];
    if (!provider) throw invalid();
    if (input.action === 'test') {
      try {
        await send({base:provider.base_url,path:provider.test_path,key:security.decryptSecret(provider.key_cipher)});
        return {ok:true};
      } catch { return {ok:false}; }
    }
    if (input.action !== 'map') throw invalid();
    const {productId,plan,active,settings:s} = input;
    const product = (await loadCatalog()).products.find(p=>p.id===productId);
    if (!product?.plans?.some((p,i)=>planKey(p,i)===plan) || typeof active !== 'boolean' ||
        !s || !text(s.serviceId,120) || !['idField','statusField'].every(k=>
          text(s[k],150) && s[k].split('.').every(token)) ||
        !['success','failure'].every(k=>Array.isArray(s[k]) && s[k].length>0 &&
          s[k].length<=20 && s[k].every(x=>text(x,100))) ||
        s.success.some(x=>s.failure.includes(x)) || !s.fields || Array.isArray(s.fields) ||
        typeof s.fields !== 'object') throw invalid();
    const fields = Object.entries(s.fields);
    if (fields.length>20 || !fields.some(([,v])=>v==='reference') ||
        !fields.some(([,v])=>v==='serviceId') || !fields.some(([,v])=>v==='quantity') ||
        fields.some(([k,v])=>!token(k) || typeof v!=='string' ||
          (!['reference','serviceId','plan','quantity'].includes(v) &&
            !(v.startsWith('customer.') && text(v.slice(9),120) && !v.slice(9).includes('.'))))) throw invalid();
    endpoint(provider.base_url,s.orderPath);
    endpoint(provider.base_url,s.statusPath);
    if (s.orderPath === s.statusPath || s.orderPath === provider.test_path) throw invalid();
    const {orderPath,statusPath,idField,statusField,serviceId,success,failure} = s;
    await db.query(`insert into ${mappings}(product_id,plan_key,supplier_id,settings,active)
      values($1,$2,$3,$4,$5) on conflict(product_id,plan_key) do update
      set supplier_id=excluded.supplier_id,settings=excluded.settings,active=excluded.active`,
    [productId,plan,provider.id,{orderPath,statusPath,idField,statusField,serviceId,success,failure,fields:s.fields},active]);
    return {ok:true};
  }
  async function claim(db) {
    const c = await db.connect();
    try {
      await c.query('begin');
      const job = (await c.query(`select d.*,s.base_url,s.key_cipher from ${dispatches} d
        join ${suppliers} s on s.id=d.supplier_id
        where d.state in ('queued','checking','succeeded') and d.next_at<=now()
        order by d.next_at limit 1 for update of d skip locked`)).rows[0];
      if (!job) { await c.query('commit'); return null; }
      const order = (await c.query('select * from public.payment_orders where id=$1 for update',[job.order_id])).rows[0];
      const first = job.state === 'queued';
      const delivered = first && (await c.query(`select 1 from ${schema}.customer_order_deliveries
        where order_id=$1 and line_index=$2 limit 1`,[order.id,job.line_index])).rowCount;
      const inactive = first && !(await c.query(`select 1 from ${mappings}
        where product_id=$1 and plan_key=$2 and supplier_id=$3 and active and settings=$4::jsonb`,
      [order.checkout_snapshot.items[job.line_index].productId,
        order.checkout_snapshot.items[job.line_index].sourcePlanKey,job.supplier_id,job.settings])).rowCount;
      let state = job.state;
      if (!paid(order) || delivered || inactive) state = 'skipped';
      else if (first) {
        try {
          supplierBody(job,order,security);
          approvedUrl(job.base_url,job.settings.orderPath,allowlist);
        } catch { state = 'failed'; }
        if (state === 'queued') state = 'checking';
      }
      await c.query(`update ${dispatches} set state=$2,next_at=now()+interval '1 minute' where id=$1`,[job.id,state]);
      await c.query('commit');
      return ['skipped','failed'].includes(state) ? null : {job,order,first};
    } catch (error) {
      await c.query('rollback');
      throw error;
    } finally { c.release(); }
  }
  async function drain() {
    const db = await pool();
    const entry = await claim(db);
    if (!entry) return;
    const {job,order,first} = entry;
    if (job.state !== 'succeeded') {
      const {state,id} = await dispatchResult(job,order,security,send,first);
      await db.query(`update ${dispatches} set state=$2,external_id=coalesce($3,external_id)
        where id=$1 and state='checking'`,[job.id,state,id]);
      if (state !== 'succeeded') return;
    }
    await adminDelivery(db,security,'supplier:auto',order.id,{
      requestId:job.id,line:job.line_index,quantity:deliveryLines(order)[job.line_index].quantity,
      message:'Təchizatçı sifarişin təhvilini təsdiqlədi.'
    });
    await db.query("update "+dispatches+" set state='delivered' where id=$1",[job.id]);
  }
  let running;
  return {admin,drain,start(){
    if (!allowlist.size) return;
    setInterval(()=>{
      running ??= drain().catch(()=>{}).finally(()=>{running=null;});
    },5000).unref();
  }};
}
