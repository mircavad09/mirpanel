import {paymentStatus} from './payment-status.mjs';
// One row per external payment, not per order line or fulfillment event.
// Reads only: no wallet, order, provider, fee fact or numbering mutations.
const S='mirpanel_community.';
export async function electronicOperations(c,filter){
 const tables=(await c.query(`select to_regclass('${S}epoint_checkout_requests') checkout,to_regclass('${S}epoint_wallet_intents') intents,to_regclass('${S}epoint_purchases') purchases`)).rows[0];
 const parts=[`select t.id,t.user_id,'card-to-card'::text source,'card-to-card'::text method,'topup'::text purpose,t.requested_cents::bigint gross_cents,
  case when t.status='approved' then t.approved_cents else 0 end::bigint credited_cents,t.status='approved' payment_confirmed,
  case t.status when 'approved' then 'completed' when 'rejected' then 'rejected' else 'reviewing' end status,
  coalesce(t.submitted_at,t.created_at) created_at,t.decided_at settled_at,null::text provider_transaction,
  to_jsonb(t)->>'history_number' history_number,t.card_bank,t.card_last4,to_jsonb(t)->>'rejection_reason' rejection_reason,
  (t.receipt is not null and t.receipt_deleted_at is null) receipt_available,t.status manual_status,
  null::uuid order_id,null::text order_code,null::text fulfillment_status,null::text opening_issue,null::text provider_trace,null::jsonb attempt_evidence
  from ${S}wallet_topups t where t.status<>'draft'`];
 if(tables.checkout||tables.intents)parts.push(`select coalesce(q.id,i.id),coalesce(q.user_id,i.user_id),'epoint',coalesce(q.method,'unknown'),'topup',coalesce(q.cents,i.cents)::bigint,
  case when i.credited_at is not null and exists(select 1 from ${S}wallet_ledger l where l.user_id=i.user_id and l.request_id=i.id and l.kind='topup_credit' and l.cents=i.cents) then i.cents else 0 end::bigint,
  i.credited_at is not null or to_jsonb(q)->>'excess_paid_at' is not null,
  case when coalesce(to_jsonb(q)->>'result_code','') in ('canceled','cancelled') or coalesce(nullif(to_jsonb(q)->>'result_status','new'),i.status)='returned' then 'cancelled'
   when coalesce(nullif(to_jsonb(q)->>'result_status','new'),i.status) in ('failed','error') or q.state='declined' then 'failed' else 'pending' end,
  coalesce(q.created_at,i.created_at),coalesce(i.credited_at,(to_jsonb(q)->>'excess_paid_at')::timestamptz),coalesce(i.provider_transaction,to_jsonb(q)->>'candidate_transaction'),null::text,null::text,null::text,null::text,false,null::text,null::uuid,null::text,null::text,case when to_jsonb(q)->>'excess_paid_at' is not null then 'ARTIQ ÖDƏNİŞ — təkrar balans mədaxili dayandırılıb; admin yoxlaması tələb olunur' when to_jsonb(q)->>'abandoned_at' is not null then 'Müştəri cəhdi tərk edib; bank nəticəsi ayrıca izlənilir' else to_jsonb(q)->>'provider_issue' end,to_jsonb(q)->>'provider_trace',jsonb_build_object('result_status',to_jsonb(q)->>'result_status','result_code',to_jsonb(q)->>'result_code','state',q.state,'abandoned_at',to_jsonb(q)->>'abandoned_at')
  from ${tables.checkout?S+'epoint_checkout_requests':"(select null::uuid id,null::text user_id,null::text method,null::integer cents,null::text state,null::timestamptz created_at where false)"} q
  full join ${tables.intents?S+'epoint_wallet_intents':"(select null::uuid id,null::text user_id,null::bigint cents,null::text status,null::timestamptz created_at,null::timestamptz credited_at,null::text provider_transaction where false)"} i on i.id=q.id
  where coalesce(to_jsonb(q)->>'purpose','topup')='topup'`);
 if(tables.purchases)parts.push(`select p.id,p.user_id,'epoint',p.method,'purchase',p.cents::bigint,0::bigint,
  p.paid_at is not null and o.payment_confirmed and o.payment_source='epoint' and o.currency='AZN' and round(o.amount*100)::bigint=p.cents,
  case when q.result_status in ('failed','error','returned') or q.state='declined' then 'failed' else 'pending' end,
  p.created_at,p.paid_at,coalesce(p.transaction,q.candidate_transaction),null::text,null::text,null::text,null::text,false,null::text,
  o.id,o.order_code::text,o.status,case when o.checkout_snapshot->'epointPayment'->>'excessPayment'='true' then 'ARTIQ ÖDƏNİŞ — ikinci təhvil dayandırılıb; admin yoxlaması tələb olunur' when to_jsonb(q)->>'abandoned_at' is not null and p.paid_at is null then 'Yarımçıq cəhd — bank nəticəsi ayrıca izlənilir' else q.provider_issue end,q.provider_trace,jsonb_build_object('result_status',to_jsonb(q)->>'result_status','result_code',to_jsonb(q)->>'result_code','state',q.state,'abandoned_at',to_jsonb(q)->>'abandoned_at')
  from ${S}epoint_purchases p join public.payment_orders o on o.id=p.order_id
  left join ${S}epoint_checkout_requests q on q.id=p.id`);
 const sql=`with operations as(${parts.join('\nunion all\n')}), keyed as(
  select *,case when source='epoint' and nullif(provider_transaction,'') is not null then 'epoint:'||provider_transaction else source||':'||id::text end payment_key from operations
 ), ranked as(select *,row_number() over(partition by payment_key order by (payment_confirmed and settled_at is not null) desc,created_at,id) payment_rank,
  count(*) over(partition by payment_key) duplicate_references,
  min(gross_cents) over(partition by payment_key)<>max(gross_cents) over(partition by payment_key)
   or min(method) over(partition by payment_key)<>max(method) over(partition by payment_key)
   or min(user_id) over(partition by payment_key)<>max(user_id) over(partition by payment_key) payment_conflict from keyed
 ), filtered as(select * from ranked where payment_rank=1 and ($1='all' or method=$1)
  and ($2::timestamptz is null or coalesce(settled_at,created_at)>=$2) and ($3::timestamptz is null or coalesce(settled_at,created_at)<$3)
  and ($4::uuid is null or id=$4) and ($5='all' or purpose=$5))
 select o.*,pn.number::text display_number,u.name,n.member_number::text,p.avatar_path,
  f.actual_fee_cents,f.refund_cents,f.fee_refund_cents,f.evidence,tar.basis_points,tar.source tariff_source,tar.effective_at tariff_effective_at,
  coalesce(w.cents,0)::text wallet_compensation_cents,obs.metadata->>'status' provider_observed_status,obs.created_at provider_observed_at
 from filtered o left join ${S}balance_operation_numbers pn on pn.operation_id=o.id and pn.source=o.source
 join ${S}"user" u on u.id=o.user_id left join ${S}community_member_numbers n on n.user_id=o.user_id left join ${S}community_profiles p on p.user_id=o.user_id
 left join lateral(select sum(cents) filter(where kind='fee')::text actual_fee_cents,coalesce(sum(cents) filter(where kind='refund'),0)::text refund_cents,
  coalesce(sum(cents) filter(where kind='fee_refund'),0)::text fee_refund_cents,string_agg(evidence,'; ' order by occurred_at) evidence
  from ${S}topup_finance_facts f where f.source=o.source and f.operation_id=o.id) f on true
 left join lateral(select sum(l.cents) cents from ${S}wallet_ledger l where o.purpose='purchase' and l.request_id=o.order_id and l.user_id=o.user_id and l.kind='purchase_refund' and l.cents>0) w on true
 left join (select distinct on(entity_id) entity_id,metadata,created_at from public.payment_audit_log where action='report.provider_status_observed' and entity_type='epoint_payment' order by entity_id,created_at desc,id desc) obs
  on obs.entity_id=o.id::text and obs.metadata->>'transaction'=o.provider_transaction and (obs.metadata->>'cents')=o.gross_cents::text
 left join lateral(select * from ${S}topup_fee_tariffs t where t.method=o.method and t.effective_at<=o.settled_at order by t.effective_at desc limit 1) tar on true
 order by (o.status='reviewing') desc,o.created_at desc,o.id`;
 return (await c.query(sql,[filter.method,filter.from,filter.to,filter.id,filter.purpose])).rows.map(r=>{
  if(r.source!=='epoint')return r;
  const q=r.attempt_evidence||{};
  return {...r,status:paymentStatus({paid:r.payment_confirmed,status:q.result_status||r.status,code:q.result_code,declined:q.state==='declined',abandoned:!!q.abandoned_at})};
 });
}
// Explicit reconciliation evidence only; never settles, refunds, or alters balances.
export async function recordPaymentReportObservation(pool,{id,transaction,cents,status,trace,observedAt}){
 if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)||!/^[A-Za-z0-9_-]{1,128}$/.test(transaction)||!Number.isSafeInteger(cents)||cents<0||!['success','returned','new','failed','error','server_error'].includes(status)||!Number.isFinite(Date.parse(observedAt)))throw Error('Invalid report evidence');
 const metadata={transaction,cents,status,trace:typeof trace==='string'?trace.slice(0,128):null,observedAt,source:'Epoint authenticated get-status; no financial mutation'};
 await pool.query(`insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
  select 'system','epoint-report','report.provider_status_observed','epoint_payment',$1,$2::jsonb
  where not exists(select 1 from public.payment_audit_log where action='report.provider_status_observed' and entity_id=$1 and metadata->>'transaction'=$3 and metadata->>'status'=$4)`,[id,JSON.stringify(metadata),transaction,status]);
}
