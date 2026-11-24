import {createHash} from 'node:crypto';
import {adminPendingDeliveries,deliveryLines,deliveryRecords,queueFulfillmentCancellation} from './order-delivery.mjs';
import {postLedger} from '../shop.mjs';

const conflict=message=>Object.assign(Error(message),{status:409});
const unavailable=()=>conflict('Bu sifarişdə ləğv edilə bilən təhvil qalmayıb.');

export async function cancelFulfillment(pool,actor,id,input){
 const c=await pool.connect();
 try{
  // Only a cancellation write shares the fulfillment lock. Opening a preview
  // must not serialize unrelated deliveries across the site.
  await c.query(input?'begin; select pg_advisory_xact_lock(714025001)':'begin');
  const order=(await c.query(`select o.*,u.user_id,m.provider_name,m.last4 from public.payment_orders o
   join mirpanel_community.community_order_owners u on u.order_id=o.id
   left join public.payment_methods m on m.id=o.method_id where o.id=$1 for update of o`,[id])).rows[0];
  if(!order)throw Object.assign(Error('Sifariş tapılmadı.'),{status:404});
  const previous=order.fulfillment_cancellation;
  if(previous){
   if(input?.previewToken===previous.previewToken){await c.query('commit');return {ok:true,idempotent:true};}
   throw unavailable();
  }
  const reason=typeof input?.reason==='string'?input.reason.trim():'';
  if(input&&(!reason||reason.length>1000))
   throw Object.assign(Error('Ləğv səbəbini yazın (ən çox 1000 simvol).'),{status:400});
  const pending=(await adminPendingDeliveries(c,[id],{progress:true}))[0];
  if(!pending)throw unavailable();
  const lines=deliveryLines(order);
  const deliveries=await deliveryRecords(c,[id]);
  const full=!deliveries.length;
  const total=Math.round(Number(order.amount)*100),electronic=order.payment_source==='epoint';
  const weight=lines.reduce((sum,line)=>sum+line.quantity*line.unitCents,0);
  if(!Number.isSafeInteger(total)||total<0||order.currency!=='AZN'||lines.some(line=>!Number.isSafeInteger(line.quantity)||line.quantity<1||!Number.isFinite(line.unitCents)||line.unitCents<0)||
     (!electronic&&lines.length>1&&weight!==total)||electronic&&(!Number.isSafeInteger(weight)||weight<=0||lines.some(line=>!Number.isSafeInteger(line.unitCents))))
   throw conflict('Sifarişin ödəniş məbləği qaytarılma üçün təsdiqlənmədi.');
  const remaining=lines.flatMap((line,index)=>{
   const quantity=pending.remaining[index];
   if(!quantity)return [];
   // Allocate the stored paid total across units, including any whole-order
   // discount. Cumulative integer boundaries preserve every cent exactly.
   const prefix=lines.slice(0,index).reduce((n,x)=>n+x.quantity*x.unitCents,0);
   const start=prefix+(line.quantity-quantity)*line.unitCents,end=prefix+line.quantity*line.unitCents;
   const cents=electronic?Number(BigInt(end)*BigInt(total)/BigInt(weight)-BigInt(start)*BigInt(total)/BigInt(weight)):quantity===line.quantity&&lines.length===1?total:quantity*line.unitCents;
   if(!Number.isSafeInteger(cents)||cents<0)throw conflict('Qaytarılacaq məbləği sifarişdən dəqiq müəyyən etmək mümkün olmadı.');
   return [{index,quantity,cents}];
  });
  const refundCents=remaining.reduce((sum,line)=>sum+line.cents,0);
  if(!remaining.length||refundCents>total||(full&&refundCents!==total))
   throw conflict('Sifarişin ödəniş məbləği qaytarılma üçün təsdiqlənmədi.');
  const wallet=order.payment_source==='wallet'||electronic;
  if(!wallet&&order.payment_source!=='card')throw conflict('Bu ödəniş üsulu üçün ləğv qaydası mövcud deyil.');
  let purchase;
  if(electronic){
   purchase=(await c.query(`select p.*,q.result_status,q.candidate_transaction,q.purpose,q.cents request_cents,q.user_id request_user,q.method request_method
    from mirpanel_community.epoint_purchases p join mirpanel_community.epoint_checkout_requests q on q.id=p.id
    where p.order_id=$1 for update of p,q`,[id])).rows[0];
   if(!purchase||!order.payment_confirmed||!purchase.paid_at||!purchase.transaction||purchase.user_id!==order.user_id||purchase.purpose!=='purchase'||Number(purchase.cents)!==total||Number(purchase.request_cents)!==total||purchase.request_user!==order.user_id||purchase.request_method!==purchase.method||purchase.candidate_transaction!==purchase.transaction||purchase.result_status!=='success')
    throw conflict('Elektron ödənişin uğuru və sifariş əlaqəsi təsdiqlənmədi. Əvvəl ödəniş vəziyyətini yoxlayın.');
   if((await c.query("select to_regclass('mirpanel_community.topup_finance_facts') f")).rows[0].f&&(await c.query("select 1 from mirpanel_community.topup_finance_facts where source='epoint' and operation_id in ($1,$2) and kind='refund' and cents>0",[purchase.id,id])).rowCount)
    throw conflict('Bu ödəniş üzrə əvvəlki geri qaytarma var. İkiqat kompensasiyanın qarşısını almaq üçün yoxlayın.');
  }
  if(wallet&&!electronic){
   const debit=(await c.query(`select w.cents,s.total_cents,
    (select sum(l.unit_cents) from mirpanel_community.shop_lines l where l.checkout_id=s.id and l.order_id=$1) as order_cents
    from mirpanel_community.shop_checkouts s join mirpanel_community.wallet_ledger w on w.request_id=s.id
      and w.user_id=s.user_id and w.actor_id=s.user_id and w.kind='purchase_debit'
    where s.id::text=$2 and s.user_id=$3 and s.mode='wallet' and s.state='submitted'`,[id,order.checkout_snapshot?.cartGroupId||'',order.user_id])).rows[0];
   if(!debit||-Number(debit.cents)!==Number(debit.total_cents)||Number(debit.order_cents)!==total)
    throw conflict('Bu sifariş üzrə balansdan faktiki tutulma təsdiqlənmədi.');
  }
  const existing=(await c.query(`select 1 from mirpanel_community.wallet_ledger where user_id=$1 and request_id=$2 and kind='purchase_refund'
   union all select 1 from mirpanel_community.community_refunds where order_id=$2 and cents>0`,[order.user_id,id])).rowCount;
  if(existing)throw conflict('Bu sifariş üzrə əvvəlki geri ödəniş var. Əl ilə yoxlayın.');
  if((await c.query("select to_regclass('mirpanel_community.api_dispatches') as name")).rows[0]?.name){
   const {rows}=await c.query("select line_index,state,external_id from mirpanel_community.api_dispatches where order_id=$1 and line_index=any($2::int[]) for update nowait",[id,remaining.map(x=>x.index)]);
   if(rows.some(r=>!['queued','failed','skipped','waiting_balance'].includes(r.state)||(electronic?r.external_id:r.state==='queued'&&r.external_id)))
    throw conflict('Təchizatçıda icrası başlanmış məhsul var. Təchizatçı nəticəsi dəqiqləşmədən ləğv etmək olmaz.');
   if(input)await c.query("update mirpanel_community.api_dispatches set state='skipped' where order_id=$1 and line_index=any($2::int[]) and state in ('queued','failed','waiting_balance')",[id,remaining.map(x=>x.index)]);
  }
  if((await c.query("select to_regclass('mirpanel_community.epinby_order_units') u")).rows[0].u){
   const units=(await c.query("select u.state,u.external_id from mirpanel_community.epinby_order_units u join mirpanel_community.api_dispatches d on d.id=u.dispatch_id where d.order_id=$1 and d.line_index=any($2::int[]) for update of u nowait",[id,remaining.map(x=>x.index)])).rows;
   if(units.some(u=>u.state!=='delivered'&&(u.external_id||!['queued','failed'].includes(u.state))))throw conflict('Təchizatçı əməliyyatının nəticəsi qeyri-müəyyəndir. Əvvəl Epinby nəticəsini yoxlayın; balans qaytarılmadı.');
  }
  if((await c.query("select to_regclass('mirpanel_community.seller_tasks') present")).rows[0].present&&(await c.query("select 1 from mirpanel_community.seller_tasks where order_id=$1 and state in('claimed','needs_review')",[id])).rowCount)throw conflict('Satıcının icrasında olan məhsul var. Əvvəl Satıcılar bölməsində nəticəni yoxlayın.');
  const bank=order.method_name_snapshot||order.provider_name||'Kartdan karta';
  const last4=order.method_last4_snapshot||order.last4;
  const preview={orderCode:order.order_code,method:electronic?({ 'apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10' }[purchase.method]):wallet?'MirPanel balansı':bank+(/^\d{4}$/.test(last4||'')?' •••• '+last4:''),refundCents,full,refundStatus:wallet?'wallet_refunded':'card_pending',lines:remaining.map(x=>({...x,title:lines[x.index].title,plan:lines[x.index].planName}))};
  const previewToken=createHash('sha256').update(JSON.stringify({id,...preview})).digest('hex');
  if(!input){await c.query('commit');return {...preview,previewToken};}
  if(input.previewToken!==previewToken)throw conflict('Sifarişin təhvil və ya məbləğ vəziyyəti dəyişib. Yenidən yoxlayıb təsdiqləyin.');
  if(wallet&&refundCents){
   await postLedger(c,{actor:order.user_id,user:order.user_id,key:id,cents:refundCents,kind:'purchase_refund',reason:electronic?'Sifariş №'+order.order_code+' — ləğvə görə MirPanel balansına qaytarma':'Təhvil verilməyən sifarişin balans qaytarılması'});
   await c.query('insert into mirpanel_community.community_refunds(order_id,cents) values($1,$2) on conflict(order_id) do update set cents=excluded.cents',[id,refundCents]);
  }
  if(electronic){
   // Existing shared fulfillment lock prevents claims/dispatch/allocation racing this write.
   if((await c.query("select to_regclass('mirpanel_community.seller_tasks') t")).rows[0].t)await c.query("update mirpanel_community.seller_tasks set state='closed' where order_id=$1 and state='open'",[id]);
   if((await c.query("select to_regclass('mirpanel_community.seller_mail') t")).rows[0].t)await c.query("update mirpanel_community.seller_mail set state='cancelled' where state='queued' and task_id in(select id from mirpanel_community.seller_tasks where order_id=$1 and state='closed')",[id]);
   await c.query('select public.inventory_release($1,$2)',[order.reservation_id,id]);
   if((await c.query("select to_regclass('mirpanel_community.netflix_room_units') t")).rows[0].t)await c.query("update mirpanel_community.netflix_room_units r set sale_reservation_id=null where r.delivery_id is null and r.sale_reservation_id in(select reservation_id from mirpanel_community.shop_lines where order_id=$1)",[id]);
   await c.query("update public.payment_reservations set status='cancelled',updated_at=clock_timestamp() where (id=$1 or cart_parent_reservation_id=$1) and status in('reserved','reviewing')",[order.reservation_id]);
   await c.query("update mirpanel_community.epoint_purchases set state='ready',last_error=null,reservation_released_at=coalesce(reservation_released_at,clock_timestamp()) where id=$1",[purchase.id]);
   // A completed wallet refund supersedes the waiting-stock/hold display; the
   // durable cancellation and any delivery hold still protect all workers.
   await c.query("update public.payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment}',(checkout_snapshot->'epointPayment')||$2::jsonb) where id=$1",[id,JSON.stringify({state:'ready',fulfillmentHold:false,holdReason:null})]);
  }
  const result={...preview,reason,previewToken,at:new Date().toISOString()};
  if(full)await c.query("update public.payment_orders set fulfillment_cancellation=$2,status='cancelled',updated_at=now() where id=$1",[id,result]);
  else await c.query('update public.payment_orders set fulfillment_cancellation=$2,updated_at=now() where id=$1',[id,result]);
  await c.query("insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata) values('admin',$1,'order.fulfillment_cancelled','order',$2,$3)",[actor,id,{...preview,reason}]);
  await queueFulfillmentCancellation(c,id);
  await c.query('commit');
  return {ok:true,refundStatus:preview.refundStatus};
 }catch(e){
  await c.query('rollback');
  if(e.code==='55P03')throw conflict('Təchizatçı bu sifarişi yoxlayır. Nəticə məlum olduqdan sonra yenidən cəhd edin.');
  throw e;
 }finally{c.release();}
}
