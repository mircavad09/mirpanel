// Document metadata only: never posts a wallet entry or changes provider state.
const installed=new WeakMap(),S='mirpanel_community.';
export async function ensurePaymentNumbers(pool){
 if(!installed.has(pool)){const task=(async()=>{
  const c=await pool.connect();try{await c.query('begin');await c.query("set local lock_timeout='5s'");await c.query('select pg_advisory_xact_lock(926112302)');
   await c.query(`create table if not exists ${S}topup_document_numbers(source text not null check(source in ('epoint','card-to-card')),operation_id uuid not null,number bigint generated always as identity (start with 100001) unique,primary key(source,operation_id));alter table ${S}topup_document_numbers enable row level security;revoke all on ${S}topup_document_numbers from public,anon,authenticated;`);
   const present=(await c.query("select to_regclass('mirpanel_community.epoint_checkout_requests') q,to_regclass('mirpanel_community.epoint_wallet_intents') i")).rows[0];
   for(const table of [present.q&&'epoint_checkout_requests',present.i&&'epoint_wallet_intents'].filter(Boolean))await c.query(`insert into ${S}topup_document_numbers(source,operation_id) select 'epoint',id from ${S}${table} r where coalesce(to_jsonb(r)->>'purpose','topup')='topup' order by created_at,id on conflict do nothing`);
   await c.query('commit');
  }catch(e){await c.query('rollback');throw e;}finally{c.release();}
 })();installed.set(pool,task);task.catch(()=>installed.delete(pool));}await installed.get(pool);
 // Assign newly-created operations too; conflicts retain the original number.
 const exists=(await pool.query("select to_regclass('mirpanel_community.epoint_checkout_requests') q")).rows[0].q;
 if(exists)await pool.query(`insert into ${S}topup_document_numbers(source,operation_id) select 'epoint',q.id from ${S}epoint_checkout_requests q where coalesce(to_jsonb(q)->>'purpose','topup')='topup' and not exists(select 1 from ${S}topup_document_numbers n where n.source='epoint' and n.operation_id=q.id) order by q.created_at,q.id on conflict do nothing`);
}
const fail=(status,message)=>Object.assign(Error(message),{status});
export async function topupConfirmation(pool,id,{userId=null,admin=false,readOnly=false}={}){
 if(!admin&&!userId)throw fail(401,'Hesabınıza daxil olun.');
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||''))throw fail(400,'Əməliyyat düzgün deyil.');
 // Ownership is checked before metadata writes and before any document is built.
 const present=(await pool.query("select to_regclass('mirpanel_community.epoint_wallet_intents') i")).rows[0].i;
 if(!present)throw fail(404,'Ödəniş tapılmadı.');
 const row=(await pool.query(`select i.id,i.cents,i.credited_at,i.provider_transaction,i.created_at from ${S}epoint_wallet_intents i where i.id=$1 and ($2::boolean or i.user_id=$3) and i.status='success' and i.credited_at is not null and exists(select 1 from ${S}wallet_ledger l where l.request_id=i.id and l.user_id=i.user_id and l.kind='topup_credit' and l.cents=i.cents)`,[id,admin,userId])).rows[0];
 if(!row)throw fail(404,'Təsdiqlənmiş ödəniş sənədi tapılmadı.');
 if(!readOnly)await ensurePaymentNumbers(pool);
 const number=(await pool.query(`select number::text from ${S}topup_document_numbers where source='epoint' and operation_id=$1`,[id])).rows[0]?.number;
 if(!number)throw fail(503,'Sənəd nömrəsi hələ hazır deyil.');
 const q=(await pool.query("select to_regclass('mirpanel_community.epoint_checkout_requests') q")).rows[0].q;
 const request=q?(await pool.query(`select method,created_at from ${S}epoint_checkout_requests where id=$1`,[id])).rows[0]:null;
 const facts=(await pool.query("select to_regclass('mirpanel_community.topup_finance_facts') f")).rows[0].f;
 const refund=facts?Number((await pool.query("select coalesce(sum(cents),0)::text cents from mirpanel_community.topup_finance_facts where source='epoint' and operation_id=$1 and kind='refund'",[id])).rows[0].cents):0;
 return {document:{type:'mirpanel-confirmation',title:'MirPanel ödəniş təsdiqi',number:'MP-'+number,providerTransaction:row.provider_transaction||null,method:request?.method||'unknown',paidCents:Number(row.cents),creditedCents:Number(row.cents),createdAt:request?.created_at||row.created_at,completedAt:row.credited_at,status:refund>=Number(row.cents)?'refunded':refund>0?'partially_refunded':'completed',refundCents:refund,note:'Bu sənəd MirPanel qeydidir. Epoint və ya bankın rəsmi/fiskal çeki deyil.'}};
}
