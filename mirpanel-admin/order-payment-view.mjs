// Presentation of a persisted, owner-scoped Epoint purchase only.
export function orderPaymentView(order,status=order.status){
 const p=order.checkout_snapshot?.epointPayment;
 if(!p)return null;
 const paid=order.payment_confirmed===true;
 const state=p.fulfillmentHold?'held':order.fulfillment_cancellation?'cancelled':paid?'paid':p.cancelled?'cancelled':['failed','error'].includes(p.providerStatus)?'failed':p.providerStatus==='returned'?'returned':p.recoveryIssue||p.providerStatus!=='new'?'unknown':'unpaid';
 const label=state==='held'?'Ləğv müraciəti qəbul edilib — təhvil dayandırılıb':state==='paid'?(status==='completed'?'Təhvil tamamlanıb — hesab məlumatları hazırdır':'Ödəniş qəbul olunub — təhvil davam edir'):state==='unpaid'?'Ödəniş tamamlanmayıb':state==='failed'?'Ödəniş uğursuz olub':state==='cancelled'?'Sifariş ödənişi ləğv edilib':state==='returned'?'Ödəniş geri qaytarılıb':'Ödənişin nəticəsi yoxlanılır';
 const valid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(p.id||'');
 return {state,label,...(valid?{ref:p.id,checkUrl:'/api/payments/epoint/checkout?ref='+p.id,...(state==='unpaid'?{resumeUrl:'/odenis/epoint/odeme?ref='+p.id}:{})}:{}),preventRepeat:state==='unpaid'||state==='unknown'||state==='paid'&&status!=='completed'};
}
