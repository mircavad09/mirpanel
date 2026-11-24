// Payment proof and fulfillment readiness are separate. No money/stock mutation.
const S='mirpanel_community.';
export async function epointDeliveryAccess(c,o,{actor='admin',done={}}={}){
 if(o.payment_source!=='epoint')return null;
 const found=(await c.query(`select to_regclass('${S}epoint_purchases') purchases,to_regclass('${S}fulfillment_holds') holds,
  to_regclass('${S}ready_stock_plans') stock,to_regclass('${S}seller_tasks') sellers,to_regclass('${S}api_dispatches') dispatches,
  to_regclass('public.employee_order_assignments') employees`)).rows[0];
 const block=reason=>({allowed:false,reason,lines:[]});
 if(!found.purchases)return block('Elektron ödənişin server qeydi tapılmadı.');
 const p=(await c.query(`select p.*,q.purpose,q.user_id request_user,q.method request_method,q.cents request_cents,q.candidate_transaction,q.state request_state,to_jsonb(q)->>'recovery_hold' recovery_hold,q.result_status,
  exists(select 1 from ${S}community_order_owners ow where ow.order_id=p.order_id and ow.user_id=p.user_id) owner_bound
  from ${S}epoint_purchases p join ${S}epoint_checkout_requests q on q.id=p.id where p.order_id=$1`,[o.id])).rows[0];
 if(!p?.paid_at||!o.payment_confirmed||!p.transaction||p.purpose!=='purchase'||p.request_state!=='ready'||p.request_user!==p.user_id||p.request_method!==p.method||p.candidate_transaction!==p.transaction||!p.owner_bound||Number(p.cents)!==Number(p.request_cents)||Number(p.cents)!==Math.round(Number(o.amount)*100)||o.currency!=='AZN')return block('Elektron ödəniş və sifariş əlaqəsi serverdə təsdiqlənməyib.');
 if(o.fulfillment_cancellation||['cancelled','rejected','expired'].includes(o.status))return block('Sifarişin qalan hissəsi ləğv edilib.');
 if(p.recovery_hold==='true'||p.result_status==='returned')return block('Ödənişin bərpası və ya qaytarılması üzrə operator yoxlaması tələb olunur.');
 if(o.checkout_snapshot?.epointPayment?.fulfillmentHold||found.holds&&(await c.query(`select 1 from ${S}fulfillment_holds where order_id=$1 and released_at is null`,[o.id])).rowCount)return block('Ləğv müraciətinə görə təhvil qəsdən dayandırılıb.');
 if(found.employees&&(await c.query("select 1 from public.employee_order_assignments where order_id=$1 and state not in('CANCELLED','COMPLETED')",[o.id])).rowCount)return block('Sifariş işçinin icrasındadır. Əvvəl işçi təyinatını yoxlayın.');
 const snap=o.checkout_snapshot||{},items=snap.cartVersion===2?snap.items:[{...snap,productId:o.product_id,quantity:o.quantity||1}];
 const stock=found.stock?(await c.query(`select product_id,plan_key from ${S}ready_stock_plans where product_id=any($1::text[])`,[items.map(x=>x.productId)])).rows:[];
 const sellers=found.sellers?(await c.query(`select line_index,state,seller_id from ${S}seller_tasks where order_id=$1 and state in('claimed','needs_review')`,[o.id])).rows:[];
 const dispatches=found.dispatches?(await c.query(`select line_index,state,settings->>'provider' provider from ${S}api_dispatches where order_id=$1 and (state in('checking','succeeded','waiting_balance') or state='queued' and settings->>'provider'='epinby')`,[o.id])).rows:[];
 const lines=items.map((x,index)=>{
  const requiresStock=x.roomStock===true||x.readyStock===true||x.deliveryType==='ready_account'||x.productId==='netflix'||stock.some(s=>s.product_id===x.productId&&s.plan_key===String(x.sourcePlanKey??x.planIndex??snap.sourcePlanKey??''));
  const assigned=sellers.find(s=>Number(s.line_index)===index),dispatch=dispatches.find(s=>Number(s.line_index)===index);
  let reason=null;
  if(assigned&&(assigned.state!=='claimed'||actor!=='seller:'+assigned.seller_id))reason='Məhsul satıcının icrasındadır. Əvvəl Satıcılar bölməsində yoxlayın.';
  else if(dispatch&&actor!=='supplier:auto')reason='Təchizatçı bu məhsulun sifarişini icra edir və ya yoxlayır.';
  else if(requiresStock&&(p.reservation_released_at||p.state==='awaiting_stock'||snap.epointPayment?.state==='awaiting_stock'))reason='Bu paket hazır hesab tələb edir; uyğun stok və etibarlı rezerv üzrə təhvil gözlənilir.';
  return {index,requiresStock,remaining:Math.max(0,Number(x.quantity||1)-Number(done[index]||0)),allowed:!reason,reason};
 });
 const remaining=lines.filter(x=>x.remaining>0),allowed=remaining.some(x=>x.allowed);
 return {allowed,reason:allowed?null:remaining.find(x=>x.reason)?.reason||'Təhvil üçün məhsul qalmayıb.',lines};
}
// Caller owns the shared fulfillment lock and order row lock. Idempotent repair
// changes only queue metadata; never reserves, allocates, delivers or refunds.
export async function recoverManualEpointQueue(c,o,access,actor='system'){
 if(!access?.allowed||!access.lines.filter(x=>x.remaining>0).every(x=>x.allowed&&!x.requiresStock)||o.checkout_snapshot?.epointPayment?.state!=='awaiting_stock')return false;
 const changed=await c.query(`update ${S}epoint_purchases set state='ready',last_error=null where order_id=$1 and paid_at is not null and state='awaiting_stock' returning id`,[o.id]);
 if(!changed.rowCount)return false;
 await c.query("update public.payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment,state}','\"ready\"') where id=$1",[o.id]);
 await c.query("insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata) values('system',$1,'order.epoint_manual_queue_recovered','order',$2,$3)",[actor,o.id,{paymentId:changed.rows[0].id,previousState:'awaiting_stock',newState:'ready',reservationUnchanged:true,moneyUnchanged:true}]);
 return true;
}
