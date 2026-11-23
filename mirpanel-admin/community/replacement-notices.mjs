const T='mirpanel_community.staff_replacements';
async function installed(pool){return !!(await pool.query('select to_regclass($1) present',[T])).rows[0].present;}
export async function replacementNotices(pool,user){
 if(!user||!await installed(pool))return {unread:0,items:[]};
 const rows=(await pool.query(`select r.id,r.completed_at,r.notice_read_at,o.order_code::text from ${T} r join public.payment_orders o on o.id=r.order_id where r.user_id=$1 and r.state='completed' order by r.completed_at desc,r.id limit 50`,[user])).rows;
 const unread=Number((await pool.query(`select count(*)::int n from ${T} where user_id=$1 and state='completed' and notice_read_at is null`,[user])).rows[0].n);
 return {unread,items:rows.map(r=>({messageId:'replacement:'+r.id,createdAt:r.completed_at,readAt:r.notice_read_at,text:'Hesabınız əvəzləndi · Sifariş № '+r.order_code+' · '+new Date(r.completed_at).toLocaleDateString('az-AZ',{timeZone:'Asia/Baku'}),href:'/profil?tab=sifarislerim&order='+encodeURIComponent(r.order_code)}))};
}
export async function markReplacementNotice(pool,user,id){
 if(!/^replacement:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id||'')||!await installed(pool))throw Object.assign(Error('Bildiriş tapılmadı.'),{status:404});
 const r=await pool.query(`update ${T} set notice_read_at=coalesce(notice_read_at,clock_timestamp()) where id=$1 and user_id=$2 and state='completed' returning id`,[id.slice(12),user]);
 if(!r.rowCount)throw Object.assign(Error('Bildiriş tapılmadı.'),{status:404});return {ok:true};
}
