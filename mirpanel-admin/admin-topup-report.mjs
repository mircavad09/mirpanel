import {ensurePaymentNumbers} from './topup-confirmation.mjs';
import {readFile} from 'node:fs/promises';
import {electronicOperations} from './electronic-payment-report.mjs';
const S='mirpanel_community.',installed=new WeakMap();
export async function ensureTopupFinance(pool){
 if(!installed.has(pool)){const task=(async()=>{const c=await pool.connect();try{await c.query('begin');await c.query("set local lock_timeout='5s'");await c.query('select pg_advisory_xact_lock(926112301)');await c.query(await readFile(new URL('./community/topup-finance.sql',import.meta.url),'utf8'));await c.query('commit');}catch(e){await c.query('rollback');throw e;}finally{c.release();}})();installed.set(pool,task);task.catch(()=>installed.delete(pool));}return installed.get(pool);
}
const fail=message=>Object.assign(Error(message),{status:400});
const methods=new Set(['all','apple-pay','google-pay','birbank','m10','card-to-card','card','unknown']);
function day(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw fail('Tarix YYYY-MM-DD formatında olmalıdır.');const d=new Date(value+'T00:00:00+04:00');if(!Number.isFinite(+d)||new Date(+d+14400000).toISOString().slice(0,10)!==value)throw fail('Tarix düzgün deyil.');return d;}
export function topupFilter(input={},now=new Date()){
 const method=input.method||'all',period=input.period||'all';if(!methods.has(method)||!['all','today','month','range'].includes(period))throw fail('Filtr düzgün deyil.');let from=null,to=null;const today=new Date(+now+14400000).toISOString().slice(0,10);
 if(period==='today'){from=day(today);to=new Date(+from+86400000);}if(period==='month'){from=day(today.slice(0,7)+'-01');const d=new Date(today.slice(0,7)+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);to=day(d.toISOString().slice(0,10));}
 if(period==='range'){from=day(input.from);to=new Date(+day(input.to)+86400000);if(+to<=+from)throw fail('Tarix aralığı düzgün deyil.');}
 const offset=Number(input.offset||0);if(!Number.isSafeInteger(offset)||offset<0||offset>10000000)throw fail('Səhifə düzgün deyil.');if(input.id&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.id))throw fail('Müraciət düzgün deyil.');
 const purpose=input.purpose||'all';if(!['all','topup','purchase'].includes(purpose))throw fail('Ödəniş məqsədi düzgün deyil.');
 return {method,purpose,period,from:from?.toISOString()||null,to:to?.toISOString()||null,offset,id:input.id||null};
}
// All arithmetic is integral cents with half-up basis-point rounding.
export function tariffFee(cents,bps){return Number((BigInt(cents)*BigInt(bps)+5000n)/10000n);}
export function finance(row){
 const gross=Number(row.gross_cents),credited=Number(row.credited_cents||0),refund=Number(row.refund_cents||0),actual=row.actual_fee_cents==null?null:Number(row.actual_fee_cents),feeRefund=Number(row.fee_refund_cents||0);
 const estimate=row.basis_points==null?null:tariffFee(gross,row.basis_points);const complete=row.payment_conflict?false:row.purpose==='purchase'?row.payment_confirmed===true&&!!row.settled_at&&!!row.provider_transaction:credited>0||row.payment_confirmed===true&&!!row.settled_at&&!!row.provider_transaction;const selected=complete?(actual??estimate):null;const net=selected==null?null:gross-refund-selected+feeRefund;
 return {...row,purpose:row.purpose||'topup',payment_success:complete,wallet_compensation_cents:Number(row.wallet_compensation_cents||0),requested_cents:gross,approved_cents:complete&&credited?credited:null,submitted_at:row.created_at,decided_at:row.settled_at,gross_cents:gross,credited_cents:credited,refund_cents:refund,fee_refund_cents:feeRefund,actual_fee_cents:actual,estimated_fee_cents:complete?estimate:null,calculated_net_cents:complete&&estimate!=null?gross-refund-estimate:null,fee_cents:selected,fee_basis:selected==null?'unknown':actual!=null?'actual':'estimated',net_cents:net,status:complete?(refund>=gross?'refunded':refund>0?'partially_refunded':'completed'):row.status};
}
export function summarize(rows){
 const out={completedCount:0,grossCents:0,creditedCents:0,topupCents:0,purchaseCents:0,topupCount:0,purchaseCount:0,walletCompensationCents:0,conflictCount:0,duplicateReferences:0,unquantifiedReturnCount:0,
  actualFeeCents:0,estimatedFeeCents:0,unknownFeeCount:0,actualCount:0,estimatedCount:0,refundCount:0,refundCents:0,feeRefundCents:0,knownNetCents:0,actualNetCents:0,estimatedNetCents:0,calculatedFeeCents:0,calculatedNetCents:0,calculatedCount:0,uncalculatedCount:0};
 for(const r of rows){
  if(r.payment_conflict)out.conflictCount++;
  out.duplicateReferences+=Math.max(0,Number(r.duplicate_references||1)-1);
  if(!r.payment_success)continue;
  if(r.provider_observed_status==='returned'&&!r.refund_cents)out.unquantifiedReturnCount++;
  out.completedCount++;out.grossCents+=r.gross_cents;
  if(r.purpose==='purchase'){out.purchaseCount++;out.purchaseCents+=r.gross_cents;}else{out.topupCount++;out.topupCents+=r.gross_cents;}
  if(r.estimated_fee_cents!=null){out.calculatedCount++;out.calculatedFeeCents+=r.estimated_fee_cents;out.calculatedNetCents+=r.calculated_net_cents;}else out.uncalculatedCount++;
  out.creditedCents+=r.credited_cents;out.walletCompensationCents+=r.wallet_compensation_cents;
  out.refundCents+=r.refund_cents;out.feeRefundCents+=r.fee_refund_cents;if(r.refund_cents)out.refundCount++;
  if(r.fee_basis==='unknown')out.unknownFeeCount++;else{
   out.knownNetCents+=r.net_cents;if(r.fee_basis==='actual'){out.actualFeeCents+=r.fee_cents;out.actualCount++;out.actualNetCents+=r.net_cents;}
   else{out.estimatedFeeCents+=r.fee_cents;out.estimatedCount++;out.estimatedNetCents+=r.net_cents;}
  }
 }
 return out;
}
export async function adminTopupReport(pool,input={}){
 const filter=topupFilter(input);await ensureTopupFinance(pool);await ensurePaymentNumbers(pool);const c=await pool.connect();try{
  await c.query('begin isolation level repeatable read read only');
  const rows=(await electronicOperations(c,filter)).map(finance);
  await c.query('commit');
  return {topups:rows.slice(filter.offset,filter.offset+100),total:rows.length,offset:filter.offset,hasMore:rows.length>filter.offset+100,report:summarize(rows),filter,
   tariff:{methods:['apple-pay','google-pay','birbank'],basisPoints:300,effectiveAt:'2026-11-22T20:00:00.000Z',source:'Sahibin 23.11.2026-dan təsdiqlədiyi 3% tarif; provayderin faktiki tutulması deyil'},
   additionalTariffs:[{methods:['m10'],basisPoints:300,effectiveAt:'2026-11-26T20:48:49.667Z',source:'Sahibin 27.11.2026 təsdiqlədiyi m10 provayder xərci; müştəriyə əlavə haqq deyil; faktiki provayder tutulması deyil'}],
   refundNote:'Uğurlu ödənişlər server təsdiqinin Bakı vaxtına görə seçilir; təhvilin tamamlanması tələb olunmur. Bank geri ödənişi yalnız sübutlu maliyyə qeydindən götürülür. MirPanel balansına kompensasiya ayrıca göstərilir və bankın komissiyanı qaytarması sayılmır. Geri qaytarmalar seçilmiş ödənişlərin indiyədək qeydə alınmış nəticələridir. Tarif hesabı yeni xərc qeydi yaratmır.'};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
