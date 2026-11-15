// Admin-only, read-only search. Never return decrypted matching material.
const fail=()=>Object.assign(Error('Hazır stok axtarışı düzgün deyil.'),{status:400});
const fold=v=>String(v??'').normalize('NFKC').toLowerCase();
export function stockSearchMatches(query,fields){
 const q=fold(query).trim(),numeric=q.replace(/^[#№]\s*/,''),pin=/^[\d -]+$/.test(q)?q.replace(/[ -]/g,''):null;
 return q!==''&&fields.some(v=>fold(v).includes(q)||(numeric!==q&&fold(v).includes(numeric))||(pin&&String(v??'').replace(/[- ]/g,'').includes(pin)));
}
export async function searchReadyStock(pool,security,input){
 const {productId,q}=input||{};
 if(typeof productId!=='string'||!productId||productId.length>120||typeof q!=='string'||q.length>512)throw fail();
 if(!q.trim())return {matches:[]};
 const c=await pool.connect();
 try{
  await c.query('begin read only');const matches=[];
  const release=(await c.query("select to_regclass('mirpanel_community.ready_stock_release') present")).rows[0].present;
  if(!release||!(await c.query('select enabled from mirpanel_community.ready_stock_release where id')).rows[0]?.enabled)throw Object.assign(Error('Hazır stok bağlıdır.'),{status:503});
  if(productId==='netflix'){
   const installed=(await c.query("select to_regclass('mirpanel_community.netflix_room_units') present")).rows[0].present;
   if(installed){
    const legacy=(await c.query("select to_regclass('mirpanel_community.netflix_room_legacy') present")).rows[0].present;
    const rows=(await c.query(`select r.id,r.group_id,r.room_name,r.pin_cipher,g.account_cipher,o.order_code::text,
     n.member_number::text,person.name customer_name from mirpanel_community.netflix_room_units r
     join mirpanel_community.netflix_room_groups g on g.id=r.group_id
     left join mirpanel_community.customer_order_deliveries d on d.id=r.delivery_id
     left join public.payment_orders o on o.id=d.order_id
     left join mirpanel_community.community_order_owners owner on owner.order_id=o.id
     ${legacy?'left join mirpanel_community.netflix_room_legacy a on a.id=r.legacy_assignment_id':''}
     left join mirpanel_community.community_member_numbers n on n.user_id=${legacy?'coalesce(a.user_id,owner.user_id)':'owner.user_id'}
     left join mirpanel_community."user" person on person.id=n.user_id
     where to_jsonb(r)->>'deleted_at' is null`)).rows;
    for(const row of rows){
     const account=JSON.parse(security.decryptSecret(row.account_cipher)),pin=JSON.parse(security.decryptSecret(row.pin_cipher));
     if(account.id!==row.group_id||pin.id!==row.id)throw Error('STOCK_SEARCH_REFERENCE');
     if(stockSearchMatches(q,[account.email,account.password,row.room_name,pin.pin,row.order_code,row.member_number,row.customer_name]))matches.push({kind:'room',id:row.id});
    }
   }
  }else if((await c.query("select to_regclass('mirpanel_community.ready_stock_management') present")).rows[0].present){
   const rows=(await c.query(`select u.id,u.product_id,u.plan_key,u.plan_signature,u.message_cipher,m.message_cipher assigned_cipher,m.assignment_id,d.id delivery_id,d.order_id,d.line_index,d.message_cipher delivery_cipher,o.order_code::text,n.member_number::text,person.name customer_name
    from mirpanel_community.ready_stock_units u left join mirpanel_community.ready_stock_management m on m.unit_id=u.id
    left join mirpanel_community.customer_order_deliveries d on d.id=u.delivery_id
    left join public.payment_orders o on o.id=d.order_id
    left join mirpanel_community.community_order_owners owner on owner.order_id=o.id
    left join mirpanel_community.community_member_numbers n on n.user_id=coalesce(m.user_id,owner.user_id)
    left join mirpanel_community."user" person on person.id=n.user_id
    where u.product_id=$1 and m.deleted_at is null`,[productId])).rows;
   for(const row of rows){
    const data=JSON.parse(security.decryptSecret(row.message_cipher));
    if(data.id!==row.id||JSON.stringify(data.scope)!==JSON.stringify([row.product_id,row.plan_key,row.plan_signature]))throw Error('STOCK_SEARCH_REFERENCE');
    const delivered=row.delivery_cipher||row.assigned_cipher?JSON.parse(security.decryptSecret(row.delivery_cipher||row.assigned_cipher)):null;
    if(delivered&&(row.delivery_id?(delivered.id!==row.delivery_id||delivered.order!==row.order_id||delivered.line!==row.line_index):(delivered.id!==row.assignment_id||delivered.order!==row.assignment_id||delivered.line!==0)))throw Error('STOCK_SEARCH_REFERENCE');
    const current=delivered||data.account||{};
    if(stockSearchMatches(q,[current.email,current.password,current.room,current.pin,current.message??data.message,row.order_code,row.member_number,row.customer_name]))matches.push({kind:'account',id:row.id});
   }
  }
  await c.query('commit');return {matches};
 }catch(error){await c.query('rollback');throw Object.assign(Error('Axtarış alınmadı. Yenidən cəhd edin.'),{status:error.status||503});}
 finally{c.release();}
}
