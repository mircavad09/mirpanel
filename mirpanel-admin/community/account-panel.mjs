const fail=(status,message)=>Object.assign(Error(message),{status});
export async function paymentHistory(pool,userId,query){
 const filter=query.get('status')||'all',page=Number(query.get('page')||1),topup=query.get('topup')||'';
 if(topup&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topup))throw fail(400,'Müraciət düzgün deyil.');
 if(!['all','approved','reviewing','rejected'].includes(filter)||!Number.isSafeInteger(page)||page<1||page>10000)throw fail(400,'Ödəniş filtri düzgün deyil.');
 const {rows:[result]}=await pool.query(`
 WITH payments AS (
   SELECT 'order' AS kind,o.id::text,o.order_code::text AS number,o.product_title AS title,
     round(o.amount*100)::bigint AS cents,o.created_at AS submitted_at,o.created_at AS sort_at,
     CASE WHEN o.status NOT IN ('cancelled','canceled','rejected','expired') AND (o.payment_confirmed OR o.status IN ('approved','completed')) THEN 'approved'
          WHEN o.status IN ('pending','submitted','reviewing','new_receipt_requested') THEN 'reviewing' ELSE o.status END AS status,
     CASE WHEN o.status='rejected' THEN o.rejected_at
          WHEN o.status NOT IN ('cancelled','canceled','expired') AND (o.payment_confirmed OR o.status IN ('approved','completed'))
            THEN CASE WHEN o.payment_source='wallet' AND o.payment_confirmed THEN o.created_at ELSE o.approved_at END
          WHEN o.status IN ('pending','submitted','reviewing') THEN o.created_at END AS operation_at,
     o.receipt_path IS NOT NULL AS by_receipt,
     CASE WHEN o.receipt_deleted_at IS NULL AND o.receipt_path IS NOT NULL THEN coalesce(o.receipt_mime,'unknown') END AS mime
   FROM public.payment_orders o WHERE o.currency='AZN' AND EXISTS (SELECT 1 FROM community_order_owners l WHERE l.user_id=$1 AND l.order_id=o.id)
   UNION ALL
   SELECT 'topup',t.id::text,t.history_number::text,'Balans yükləmə',
     CASE WHEN t.status='approved' THEN t.approved_cents ELSE t.requested_cents END,
     t.submitted_at,coalesce(t.submitted_at,t.created_at),t.status,CASE WHEN t.status='reviewing' THEN t.submitted_at ELSE t.decided_at END,true,
     CASE WHEN t.receipt_deleted_at IS NULL AND t.receipt IS NOT NULL THEN coalesce(t.receipt->>'mimeType','unknown') END
   FROM wallet_topups t WHERE t.user_id=$1 AND t.status<>'draft'
 ), selected AS (
   SELECT * FROM payments WHERE ($2='all' OR status=$2) AND ($4='' OR (kind='topup' AND id=$4)) ORDER BY sort_at DESC,kind,id DESC LIMIT 31 OFFSET $3
 )
 SELECT coalesce((SELECT cents FROM wallet_accounts WHERE user_id=$1),0)::text AS balance,
   count(*)::int AS all, count(*) FILTER (WHERE status='approved')::int AS approved,
   count(*) FILTER (WHERE status='reviewing')::int AS reviewing,count(*) FILTER (WHERE status='rejected')::int AS rejected,
   coalesce(sum(cents) FILTER (WHERE status='rejected'),0)::text AS "rejectedCents",
   coalesce(sum(cents) FILTER (WHERE status='approved' AND kind='order'),0)::text AS total,
   coalesce(sum(cents) FILTER (WHERE status='approved' AND kind='order' AND date_trunc('month',operation_at AT TIME ZONE 'Asia/Baku')=date_trunc('month',now() AT TIME ZONE 'Asia/Baku')),0)::text AS month,
   coalesce((SELECT json_agg(selected ORDER BY sort_at DESC,kind,id DESC) FROM selected),'[]'::json) AS items
 FROM payments`,[userId,filter,(page-1)*30,topup]);
 return {accountId:userId,...result,items:result.items.slice(0,30),more:result.items.length>30};
}
export async function accountPanel(pool,userId,catalog,body){
 const data=await catalog(),products=(data.products||[]).filter(p=>p.active!==false).map(p=>({id:p.id,title:p.title||p.name,image:p.image||p.img||'',price:p.plans?.map(x=>Number(String(x.price).replace(',','.'))).filter(x=>Number.isFinite(x)&&x>=0).sort((a,b)=>a-b)[0]??null}));
 if(body){if(Object.keys(body).some(k=>!['productId','saved'].includes(k))||typeof body.saved!=='boolean'||!products.some(p=>p.id===body.productId))throw fail(400,'Məhsul seçimi düzgün deyil.');if(body.saved)await pool.query('insert into account_wishlist(user_id,product_id) values($1,$2) on conflict do nothing',[userId,body.productId]);else await pool.query('delete from account_wishlist where user_id=$1 and product_id=$2',[userId,body.productId]);}
 const [wishlist,total,payments]=await Promise.all([pool.query('select product_id from account_wishlist where user_id=$1 order by created_at desc,product_id',[userId]),pool.query("select coalesce(sum(greatest(0,round(o.amount*100)::bigint-coalesce(r.cents,0))),0)::text cents,count(*)::int orders from community_order_owners l join public.payment_orders o on o.id=l.order_id left join community_refunds r on r.order_id=o.id where l.user_id=$1 and o.status in ('approved','completed') and o.currency='AZN'",[userId]),pool.query("select o.order_code,o.amount::text,o.currency,o.created_at from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=$1 and o.status in ('approved','completed') order by o.created_at desc,o.id desc limit 30",[userId])]);
 return {products,payments:payments.rows,wishlist:wishlist.rows.map(x=>x.product_id),expensesCents:Number(total.rows[0].cents),completedOrders:total.rows[0].orders,codes:[],subscriptions:[]};
}
