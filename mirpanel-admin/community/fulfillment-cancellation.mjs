import {createHash} from 'node:crypto';
import {adminPendingDeliveries,deliveryLines,deliveryRecords,queueFulfillmentCancellation} from './order-delivery.mjs';
import {postLedger} from '../shop.mjs';

const conflict=message=>Object.assign(Error(message),{status:409});
const unavailable=()=>conflict('Bu sifarişdə ləğv edilə bilən təhvil qalmayıb.');

export async function cancelFulfillment(pool,actor,id,input){
 const c=await pool.connect();
 try{
  await c.query('begin');
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
  const total=Math.round(Number(order.amount)*100);
  if(!Number.isSafeInteger(total)||total<0||order.currency!=='AZN'||lines.some(line=>!Number.isSafeInteger(line.quantity)||line.quantity<1||!Number.isFinite(line.unitCents)||line.unitCents<0)||
     (lines.length>1&&lines.reduce((sum,line)=>sum+line.quantity*line.unitCents,0)!==total))
   throw conflict('Sifarişin ödəniş məbləği qaytarılma üçün təsdiqlənmədi.');
  const remaining=lines.flatMap((line,index)=>{
   const quantity=pending.remaining[index];
   if(!quantity)return [];
   const cents=quantity===line.quantity&&lines.length===1?total:quantity*line.unitCents;
   if(!Number.isSafeInteger(cents)||cents<0)throw conflict('Qaytarılacaq məbləği sifarişdən dəqiq müəyyən etmək mümkün olmadı.');
   return [{index,quantity,cents}];
  });
  const refundCents=remaining.reduce((sum,line)=>sum+line.cents,0);
  if(!remaining.length||refundCents>total||(full&&refundCents!==total))
   throw conflict('Sifarişin ödəniş məbləği qaytarılma üçün təsdiqlənmədi.');
  const wallet=order.payment_source==='wallet';
  if(!wallet&&order.payment_source!=='card')throw conflict('Bu ödəniş üsulu üçün ləğv qaydası mövcud deyil.');
  if(wallet){
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
   if(rows.some(r=>!['queued','failed','skipped'].includes(r.state)||r.state==='queued'&&r.external_id))
    throw conflict('Təchizatçıda icrası başlanmış məhsul var. Təchizatçı nəticəsi dəqiqləşmədən ləğv etmək olmaz.');
   if(input)await c.query("update mirpanel_community.api_dispatches set state='skipped' where order_id=$1 and line_index=any($2::int[]) and state='queued'",[id,remaining.map(x=>x.index)]);
  }
  const bank=order.method_name_snapshot||order.provider_name||'Kartdan karta';
  const last4=order.method_last4_snapshot||order.last4;
  const preview={orderCode:order.order_code,method:wallet?'MirPanel balansı':bank+(/^\d{4}$/.test(last4||'')?' •••• '+last4:''),refundCents,full,refundStatus:wallet?'wallet_refunded':'card_pending',lines:remaining};
  const previewToken=createHash('sha256').update(JSON.stringify({id,...preview})).digest('hex');
  if(!input){await c.query('commit');return {...preview,previewToken};}
  if(input.previewToken!==previewToken)throw conflict('Sifarişin təhvil və ya məbləğ vəziyyəti dəyişib. Yenidən yoxlayıb təsdiqləyin.');
  if(wallet&&refundCents){
   await postLedger(c,{actor:order.user_id,user:order.user_id,key:id,cents:refundCents,kind:'purchase_refund',reason:'Təhvil verilməyən sifarişin balans qaytarılması'});
   await c.query('insert into mirpanel_community.community_refunds(order_id,cents) values($1,$2) on conflict(order_id) do update set cents=excluded.cents',[id,refundCents]);
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
