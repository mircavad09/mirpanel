import {topupMail} from './topup-mail.mjs';
import {readProductMessages} from './ready-stock-product-messages.mjs';
import {orderLines} from '../order-lines.mjs';

const D='mirpanel_community.customer_order_deliveries', M='mirpanel_community.customer_order_mail';
const O='mirpanel_community.community_order_owners';
const fail=(status,msg)=>Object.assign(Error(msg),{status});
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
export const orderCodeValid=v=>typeof v==='string'&&/^[A-Za-z0-9-]{1,40}$/.test(v);
export const paid=o=>!['rejected','cancelled','expired'].includes(o.status)&&(o.payment_confirmed===true||['approved','completed'].includes(o.status));
export function deliveryLines(o){
 const lines=orderLines(o.checkout_snapshot);
 return lines.length?lines.map((line,i)=>({...line,image:o.checkout_snapshot.items[i].image||''})):
  [{title:o.product_title,planName:o.plan_name,productId:o.product_id,image:o.checkout_snapshot?.image||'',quantity:Number(o.quantity||o.checkout_snapshot?.quantity||1),unitCents:Math.round(Number(o.amount)*100)/Number(o.quantity||o.checkout_snapshot?.quantity||1)}];
}
export function customerStatus(o,records){
 if(!paid(o))return o.status;
 if(o.fulfillment_cancellation)return o.fulfillment_cancellation.full?'cancelled':'completed';
 return deliveryLines(o).every((x,i)=>records.filter(r=>r.line_index===i).reduce((n,r)=>n+r.quantity,0)>=x.quantity)?'completed':'preparing';
}
const totals=rows=>Object.fromEntries([...new Set(rows.map(r=>r.line_index))].map(i=>[i,rows.filter(r=>r.line_index===i).reduce((n,r)=>n+r.quantity,0)]));
export async function deliveryRecords(pool,ids){
 if(!ids.length)return [];
 return (await pool.query(`select id,order_id,line_index,quantity,delivered_at,(actor='wallet:auto') as automatic from ${D} where order_id=any($1::uuid[]) order by delivered_at,id`,[ids])).rows;
}
export async function ownerCodes(pool,user,id){
 const where=id?'and d.id=$2::uuid':'';
 return (await pool.query(`select d.id,d.order_id,d.line_index,d.quantity,d.delivered_at,${id?'d.message_cipher,':''}o.order_code,o.product_id,o.product_title,o.plan_name,o.checkout_snapshot,o.amount,o.quantity as order_quantity,o.created_at
  from ${D} d join ${O} l on l.order_id=d.order_id join public.payment_orders o on o.id=d.order_id
  where l.user_id=$1 and o.status not in ('rejected','cancelled','expired') and (o.payment_confirmed is true or o.status in ('approved','completed')) ${where}
  order by d.delivered_at desc,d.id desc`,id?[user,id]:[user])).rows;
}
export async function recordDelivery(c,security,actor,orderId,id,line,quantity,message,credentials={}){
 const {email,password}=credentials;
 const cipher=security.encryptSecret(JSON.stringify({id,order:orderId,line,message,...(email?{email}:{}),...(password?{password}:{})}));
 const record=(await c.query(`insert into ${D}(id,order_id,line_index,quantity,message_cipher,actor) values($1,$2,$3,$4,$5,$6) returning id,line_index,quantity`,[id,orderId,line,quantity,cipher,actor])).rows[0];
 await c.query(`insert into ${M}(event_key,order_id,delivery_id) values($1,$2,$3)`,['delivery:'+id,orderId,id]);
 return record;
}
export async function adminPendingDeliveries(pool,ids,{progress=false}={}){
 if(ids && !ids.length)return [];
 if(!(await pool.query("select to_regclass('mirpanel_community.customer_order_deliveries') as name")).rows[0]?.name)throw fail(503,'Təhvil məlumatı hazırda əlçatan deyil.');
 // Legacy card approval filled completed_at without tracking customer delivery.
 // A payment email alone cannot put those historical orders back in the queue.
 // Explicit payment confirmation or delivery records opt the order into tracking.
 const orders=(await pool.query(`select o.id,o.status,o.payment_confirmed,o.product_title,o.plan_name,o.product_id,o.checkout_snapshot,o.amount,o.quantity,
   (select jsonb_object_agg(units.line_index,units.delivered) from (
     select line_index,sum(quantity) as delivered from ${D} where order_id=o.id group by line_index
   ) units) as delivered_units
   from public.payment_orders o join ${O} u on u.order_id=o.id
   where o.status in ('approved','reviewing','new_receipt_requested')
   and to_jsonb(o)->>'fulfillment_cancellation' is null
   and (o.payment_confirmed is true or o.status='approved')
   ${ids?'and o.id=any($1::uuid[])':''}
   and (o.payment_confirmed is true
     or (o.completed_at is null and exists(select 1 from ${M} m where m.event_key='payment:'||o.id::text))
     or exists(select 1 from ${D} d where d.order_id=o.id))`,ids?[ids]:[])).rows;
 const remaining=orders.map(o=>{
  const done=o.delivered_units||{};
  return {id:o.id,remaining:deliveryLines(o).map((line,i)=>Math.max(0,line.quantity-(done[i]||0)))};
 }).filter(o=>o.remaining.some(n=>n>0));
 return progress?remaining:remaining.map(o=>o.id);
}
// A paid order is completed when its final unit is delivered.
export async function adminDeliveryCompletions(pool,{since,ids}){
 const condition=ids?'d.order_id=any($1::uuid[])':'d.delivered_at >= $1';
 if(ids&&!ids.length)return [];
 const {rows}=await pool.query(`select o.id,o.status,o.payment_confirmed,o.checkout_snapshot,o.quantity,o.product_id,o.product_title,o.plan_name,o.amount,to_jsonb(o)->'fulfillment_cancellation' as fulfillment_cancellation,recent.last_delivery from public.payment_orders o
  join (select d.order_id,max(d.delivered_at) as last_delivery from ${D} d
    where ${condition} group by d.order_id) recent on recent.order_id=o.id`,[ids||since]);
 const records=await deliveryRecords(pool,rows.map(o=>o.id));
 const grouped=new Map();
 for(const record of records){
  if(!grouped.has(record.order_id))grouped.set(record.order_id,[]);
  grouped.get(record.order_id).push(record);
 }
 return rows.filter(o=>customerStatus(o,grouped.get(o.id)||[])==='completed')
  .map(o=>({id:o.id,completedAt:new Date(o.last_delivery).toISOString()}));
}
export async function adminOrderCustomers(pool,ids){
 if(!ids.length)return [];
 return (await pool.query(`select o.id,coalesce(nullif(trim(ct.name),''),nullif(trim(o.customer_name),''),u.name) as name,n.member_number as "memberNumber"
   from public.payment_orders o left join ${O} l on l.order_id=o.id
   left join mirpanel_community."user" u on u.id=l.user_id
   left join mirpanel_community.community_member_numbers n on n.user_id=l.user_id
   left join mirpanel_community.customer_order_contacts ct on ct.order_id=o.id
   where o.id=any($1::uuid[])`,[ids])).rows;
}
export async function adminDelivery(pool,security,actor,id,input,{productMessage=false}={}){
 const c=await pool.connect();
 try{
  await c.query('begin');
  const o=(await c.query(`select o.* from public.payment_orders o where o.id=$1 and exists(select 1 from ${O} where order_id=o.id) for update`,[id])).rows[0];
  if(!o)throw fail(404,'Hesaba bağlı sifariş tapılmadı.');
  if(!paid(o))throw fail(409,'Əvvəl ödəniş təsdiqlənməlidir.');
  const lines=deliveryLines(o),records=await deliveryRecords(c,[id]),done=totals(records);
  const renewalCode=i=>o.checkout_snapshot?.items?.[i]?.renewalOrderCode;
  const templates=productMessage&&!input?await readProductMessages(c,security,[...new Set(lines.map(x=>x.productId).filter(Boolean))]):new Map();
  const view=()=>({lines:lines.map((x,i)=>({index:i,title:x.title,plan:x.planName,remaining:o.fulfillment_cancellation?0:x.quantity-(done[i]||0),...(productMessage&&!input?{message:templates.get(x.productId)??''}:{}),...(renewalCode(i)?{renewalOrderCode:renewalCode(i),renewalSourceLine:o.checkout_snapshot.items[i].renewalSourceLine,renewalSourceUnit:o.checkout_snapshot.items[i].renewalSourceUnit}:{})})),status:customerStatus(o,records)});
  if(!input){await c.query('commit');return view();}
  const {requestId,line,quantity}=input;
  let {message}=input;
  if(!uuid(requestId)||!Number.isInteger(line)||!lines[line]||!Number.isInteger(quantity)||quantity<1||(!productMessage&&(typeof message!=='string'||!message.trim()||message.length>8000)))throw fail(400,'Təhvil məlumatları düzgün deyil.');
  const {email='',password=''}=input;
  if(typeof email!=='string'||email.length>254||(email&&!/^\S+@\S+\.\S+$/.test(email))||typeof password!=='string'||password.length>512||/[\r\n\0]/.test(password))throw fail(400,'E-poçt və ya şifrə düzgün deyil.');
  if((email||password)&&quantity!==1)throw fail(400,'E-poçt və şifrəni hər vahid üçün ayrıca göndərin.');
  if(renewalCode(line)&&input.renewalApplied!==true)throw fail(400,'Əvvəl mövcud abunəliyin həqiqətən uzadıldığını təsdiqləyin.');
  const previous=(await c.query(`select order_id,line_index,quantity,message_cipher from ${D} where id=$1`,[requestId])).rows[0];
  if(previous){
   const saved=JSON.parse(security.decryptSecret(previous.message_cipher));
   if(previous.order_id!==id||previous.line_index!==line||previous.quantity!==quantity||(!productMessage&&saved.message!==message)||(saved.email||'')!==email||(saved.password||'')!==password)throw fail(409,'Əvvəlki sorğunun məlumatı fərqlidir.');
   await c.query('commit');return {...view(),replayed:true};
  }
  if(o.fulfillment_cancellation)throw fail(409,'Qalan məhsullar ləğv edilib.');
  if(actor!=='supplier:auto' && (await c.query("select to_regclass('mirpanel_community.api_dispatches') as name")).rows[0]?.name){
   const busy=await c.query("select 1 from mirpanel_community.api_dispatches where order_id=$1 and line_index=$2 and state in ('checking','succeeded')",[id,line]);
   if(busy.rowCount)throw fail(409,'Təchizatçı bu məhsulun sifarişini yoxlayır.');
  }
  if(quantity>lines[line].quantity-(done[line]||0))throw fail(409,'Bu sayda təhvil verilməmiş məhsul qalmayıb.');
  if(productMessage){
   message=(await readProductMessages(c,security,[lines[line].productId])).get(lines[line].productId);
   if(!message)throw fail(409,'Əvvəl Hazır hesab stoku bölməsində məhsul mesajını saxlayın.');
   if(input.message!==message)throw fail(409,'Hazır mesaj dəyişib. Təhvil pəncərəsini yenidən açın.');
  }
  const record=await recordDelivery(c,security,actor,id,requestId,line,quantity,message,{email,password});
  records.push(record);done[line]=(done[line]||0)+quantity;
  await c.query('commit');return view();
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount=(v,currency='AZN')=>Number(v).toFixed(2).replace('.',',')+' '+(currency==='AZN'?'₼':currency);
const mailTable='role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;border-collapse:collapse"';
export function queueReceiptReview(c,orderId){
 return c.query(`insert into ${M}(event_key,order_id) values('receipt:'||$1::uuid,$1) on conflict do nothing`,[orderId]);
}
function receiptReviewMail(o,origin){
 const code=String(o.order_code);if(!orderCodeValid(code))throw Error('INVALID_ORDER_CODE');
 const url=new URL('/profil?tab=orders&order='+encodeURIComponent(code),origin).href;
 const title='Çekiniz qəbul edildi',detail='№'+code+' sifarişinizin çeki yoxlama üçün qəbul edildi. Bu bildiriş ödəniş təsdiqi deyil. Sifarişin cari statusuna hesabınızda baxa bilərsiniz.';
 return {user:{email:o.email},subject:title+' — Sifariş №'+code,textBody:title+'\n\n'+detail+'\n\nSifarişə bax: '+url,
  htmlBody:`<div lang="az" style="font:15px/1.5 Arial,sans-serif"><h1>${title}</h1><p>${esc(detail)}</p><p><a href="${esc(url)}">Sifarişə bax</a></p><p>MirPanel komandası</p></div>`};
}
export function orderMail(o,origin,{records=[],catalog}={}){
 const code=String(o.order_code);if(!orderCodeValid(code))throw Error('INVALID_ORDER_CODE');
 const url=new URL('/profil?tab=orders&order='+encodeURIComponent(code),origin).href;
 const ready=!!o.delivery_id, lines=deliveryLines(o), chosen=ready?[{...lines[o.line_index],quantity:o.delivered_quantity}]:lines;
 const title=ready?'Sifarişiniz hazırdır':'Sifarişiniz təsdiqləndi',subject=title+' — Sifariş №'+code;
 const name=o.customer_name||o.name||'',phone=o.customer_phone||o.phone;
 const intro=ready?'№'+code+' sifarişiniz üzrə aşağıdakı məhsullar istifadəyə hazırdır və hesabınıza əlavə edilib.':'№'+code+' sifarişinizin ödənişi təsdiqləndi.';
 const meta=[['Sifariş nömrəsi','№'+code],...(ready?[['İstifadəyə hazır məhsulların sayı',o.delivered_quantity]]:[['Sifarişçi',name],['Telefon',phone],['E-poçt',o.contact_email||o.email]])].filter(([,v])=>v);
 const label='Sifarişə bax',currency=o.currency||'AZN',total=ready?'':'Ümumi məbləğ: '+amount(o.amount,currency);
 const footer=ready?'Təhvil məlumatına baxmaq üçün hesabınıza daxil olun və sifarişinizi açın.':
  customerStatus(o,records)==='completed'?'Sifarişiniz təhvil verilib. Məlumatları hesabınızda görə bilərsiniz.':
  records.length?'Hazır məhsullar hesabınıza əlavə edilib. Sifarişin qalan hissəsi hazırlanır.':'Sifarişiniz hazırlanır. Təhvil məlumatı hesabınızda göstəriləcək.';
 const facts=x=>[x.quantity+' ədəd',...(!ready&&x.unitCents!=null?[amount(x.unitCents/100,currency)+' / vahid','Cəm '+amount(x.unitCents*x.quantity/100,currency)]:[])].join(' · ');
 const image=x=>{try{const src=x.image||catalog?.products?.find(p=>p.id===x.productId)?.image,u=new URL(src,origin);return src&&u.origin===origin&&u.protocol==='https:'?'<img width="48" alt="" src="'+esc(u.href)+'" style="display:block;width:auto;height:auto;max-width:48px;max-height:48px;border:0;margin:auto">':'';}catch{return '';}};
 const greeting='Salam'+(name?', '+name:'')+'!';
 return {user:{email:o.email},subject,textBody:[greeting,intro,meta.map(([k,v])=>k+': '+v).join('\n'),chosen.map(x=>[x.title,x.planName,facts(x)].filter(Boolean).join(' · ')).join('\n'),total,footer,label+': '+url,'MirPanel komandası'].filter(Boolean).join('\n\n'),
  htmlBody:`<div lang="az" style="max-width:560px;margin:0 auto;padding:16px 10px;color:#202124;font:15px/1.5 Arial,sans-serif;overflow-wrap:anywhere">
  <p style="margin:0;color:#665014;font-size:13px;font-weight:bold">MIRPANEL</p><h1 style="margin:4px 0 12px;font-size:23px;line-height:1.25">${title}</h1><p>${esc(greeting)}<br>${esc(intro)}</p>
  <h2 style="margin:20px 0 8px;font-size:17px">${ready?'Təhvil detalları':'Sifariş detalları'}</h2>
  <div style="background:#f6f5f2;padding:10px 12px;border-radius:8px">${meta.map(([k,v])=>'<div><strong>'+esc(k)+':</strong> '+esc(v)+'</div>').join('')}</div>
  <h2 style="margin:20px 0 8px;font-size:17px">${ready?'İstifadəyə hazır məhsullar':'Məhsullar'}</h2>
  <table ${mailTable}>${chosen.map(x=>`<tr><td width="60" valign="top" style="width:60px;border-bottom:1px solid #ece8df;padding:10px 0"><div style="width:48px;height:48px;background:#f6f5f2;border-radius:6px">${image(x)}</div></td><td valign="top" style="padding:9px 0;border-bottom:1px solid #ece8df;overflow-wrap:anywhere;word-wrap:break-word"><strong>${esc(x.title)}</strong><br><span style="color:#50545b">${esc(x.planName)}</span><br><span style="font-size:13px">${esc(facts(x))}</span></td></tr>`).join('')}</table>
  ${total?'<p><strong>'+esc(total)+'</strong></p>':''}<p>${esc(footer)}</p>
  <p><a href="${esc(url)}" style="display:inline-block;background:#ffcf33;color:#222;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${label}</a></p><p style="color:#50545b">MirPanel komandası</p></div>`};
}
export function createCustomerOrderMailer(pool,send,origin,{pollMs=10000,loadCatalog,requireDeliveryNotice=false}={}){
 let timer,running;
 const report=(id,state,reason)=>console.warn('CUSTOMER_ORDER_MAIL',id,state,reason);
 async function drain(){
  const stale=await pool.query(`update ${M} set state='uncertain',reason='STALE_SENDING',updated_at=now() where state='sending' and updated_at<now()-interval '2 minutes' returning event_key`);
  for(const row of stale.rows)report(row.event_key,'uncertain','STALE_SENDING');
  for(let i=0;i<4;i++){
   // A delivery can be committed with its payment in one transaction. Queue
   // ordering alone (including SKIP LOCKED) cannot express this dependency.
   const {rows:[job]}=await pool.query(`with next as (select j.event_key from ${M} j where j.state='queued' and j.next_at<=now()
    and (j.topup_id is null or j.event_key like 'topup-received:%' or exists(
      select 1 from ${M} prior where prior.event_key='topup-received:'||j.topup_id
       and prior.state='accepted' and prior.provider_id is not null
       and (not $1::boolean or prior.reason='RESEND_DELIVERED')))
    and (j.delivery_id is null or exists(select 1 from ${M} p where p.event_key='payment:'||j.order_id and p.order_id=j.order_id and p.delivery_id is null and p.state='accepted' and p.provider_id is not null and (not $1::boolean or p.reason='RESEND_DELIVERED')))
    order by j.next_at,j.event_key for update of j skip locked limit 1)
   update ${M} m set state='sending',attempts=attempts+1,updated_at=now() from next where next.event_key=m.event_key returning m.*`,[requireDeliveryNotice]);
   if(!job)return;
   let state='failed',reason='ACCOUNT_NOT_VERIFIED',provider=null,delay=0;
   const o=job.topup_id?(await pool.query(`select u.name,u.email,u."emailVerified"
    from mirpanel_community.wallet_topups t join mirpanel_community."user" u on u.id=t.user_id where t.id=$1`,[job.topup_id])).rows[0]:(await pool.query(`select o.*,d.id as delivery_id,d.line_index,d.quantity as delivered_quantity,coalesce(ct.name,u.name) as name,u.email,u."emailVerified",ct.email as contact_email,ct.phone
   from public.payment_orders o join ${O} l on l.order_id=o.id join mirpanel_community."user" u on u.id=l.user_id left join mirpanel_community.customer_order_contacts ct on ct.order_id=o.id left join ${D} d on d.id=$2
   where o.id=$1`,[job.order_id,job.delivery_id])).rows[0];
   const receipt=job.event_key.startsWith('receipt:');
   if(o?.emailVerified&&(job.topup_id||receipt||paid(o))){
    try{
     const records=job.topup_id||receipt||job.delivery_id?[]:await deliveryRecords(pool,[job.order_id]);
     const catalog=!job.topup_id&&!receipt&&loadCatalog&&deliveryLines(o).some(x=>!x.image)?await Promise.resolve().then(loadCatalog).catch(()=>null):null;
     const result=await send('order',job.topup_id?topupMail(job,o,origin):receipt?receiptReviewMail(o,origin):orderMail(o,origin,{records,catalog}));
     if(typeof result?.id!=='string'||!result.id)throw Error('Missing provider receipt');
     state='accepted';reason=requireDeliveryNotice&&(job.topup_id||!receipt&&!job.delivery_id)?'RESEND_AWAITING_DELIVERY':null;provider=result.id;
    }catch(e){
     const retry=e.deliveryDisposition==='retry'&&job.attempts<3;
     state=retry?'queued':['retry','failed'].includes(e.deliveryDisposition)?'failed':'uncertain';
     reason=['TOKEN_TEMPORARY','TOKEN_REJECTED','AUTH_CONFIGURATION','SEND_RATE_LIMITED','SEND_REJECTED'].includes(e.deliveryCode)?e.deliveryCode:'SEND_RESULT_UNKNOWN';
     delay=Math.max(Number(e.retryAfterMs)||0,job.attempts*30000);
    }
   }else if(o?.emailVerified){reason='PAYMENT_NOT_CONFIRMED';}
   await pool.query(`update ${M} set state=$2,reason=$3,provider_id=$4,next_at=now()+$5*interval '1 millisecond',updated_at=now() where event_key=$1 and state='sending'`,[job.event_key,state,reason,provider,delay]);
   if(['uncertain','failed'].includes(state))report(job.event_key,state,reason);
  }
 }
 const wake=()=>running??=(drain().catch(()=>console.warn('CUSTOMER_ORDER_MAIL_DATABASE_ERROR')).finally(()=>{running=null;}));
 async function notice({providerId,code,reason,topup=false}){
  if(topup){
   const {rowCount}=await pool.query(`update ${M} set reason=$2,updated_at=now()
    where topup_id is not null and state='accepted' and provider_id=$1
      and reason is distinct from 'RESEND_DELIVERED'`,[providerId,reason]);
   if(rowCount){if(reason==='RESEND_DELIVERED')void Promise.resolve(running).then(wake);return true;}
   const pending=await pool.query(`select 1 from ${M} where topup_id is not null and state='sending'`);
   return !pending.rowCount;
  }
  const {rows}=await pool.query(`update ${M} m set reason=$3,updated_at=now() from public.payment_orders o
    where m.order_id=o.id and o.order_code::text=$2 and m.event_key='payment:'||o.id
    and m.delivery_id is null and m.state='accepted' and m.provider_id=$1
    and m.reason is distinct from $3 and m.reason is distinct from 'RESEND_DELIVERED'
    and ($3<>'RESEND_DELIVERY_DELAYED' or coalesce(m.reason,'') in ('','RESEND_AWAITING_DELIVERY')) returning m.event_key`,[providerId,code,reason]);
  if(rows.length){
   if(reason==='RESEND_DELIVERED')void Promise.resolve(running).then(wake);else report(rows[0].event_key,'accepted',reason);
   return true;
  }
  // The signed webhook can arrive before the send response's provider ID is committed.
  // Ask Resend to retry rather than discarding a notice for this in-flight payment.
  const pending=await pool.query(`select 1 from ${M} m join public.payment_orders o on o.id=m.order_id
    where o.order_code::text=$2 and m.event_key='payment:'||o.id and m.delivery_id is null
    and (m.state='sending' or (m.state='accepted' and m.provider_id=$1 and m.reason is distinct from $3
    and m.reason is distinct from 'RESEND_DELIVERED' and ($3<>'RESEND_DELIVERY_DELAYED' or coalesce(m.reason,'') in ('','RESEND_AWAITING_DELIVERY'))))`,[providerId,code,reason]);
  return !pending.rowCount;
 }
 return {wake,notice,start(){timer??=setInterval(wake,pollMs);timer.unref?.();void wake();},stop(){clearInterval(timer);timer=null;return running;}};
}
