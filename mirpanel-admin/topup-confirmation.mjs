import {ensureBalanceNumbers} from './balance-operation-numbers.mjs';
const S='mirpanel_community.';
export const ensurePaymentNumbers=ensureBalanceNumbers;
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
 const number=(await pool.query(`select number::text from ${S}balance_operation_numbers where source='epoint' and operation_id=$1`,[id])).rows[0]?.number;
 if(!number)throw fail(503,'Sənəd nömrəsi hələ hazır deyil.');
 const q=(await pool.query("select to_regclass('mirpanel_community.epoint_checkout_requests') q")).rows[0].q;
 const request=q?(await pool.query(`select method,created_at from ${S}epoint_checkout_requests where id=$1`,[id])).rows[0]:null;
 const facts=(await pool.query("select to_regclass('mirpanel_community.topup_finance_facts') f")).rows[0].f;
 const refund=facts?Number((await pool.query("select coalesce(sum(cents),0)::text cents from mirpanel_community.topup_finance_facts where source='epoint' and operation_id=$1 and kind='refund'",[id])).rows[0].cents):0;
 return {document:{type:'mirpanel-confirmation',title:'MirPanel ödəniş təsdiqi',number:String(number),providerTransaction:row.provider_transaction||null,method:request?.method||'unknown',paidCents:Number(row.cents),creditedCents:Number(row.cents),createdAt:request?.created_at||row.created_at,completedAt:row.credited_at,status:refund>=Number(row.cents)?'refunded':refund>0?'partially_refunded':'completed',refundCents:refund,note:'Bu sənəd MirPanel qeydidir. Epoint və ya bankın rəsmi/fiskal çeki deyil.'}};
}
