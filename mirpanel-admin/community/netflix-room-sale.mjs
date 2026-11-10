const fail=(status,message)=>Object.assign(Error(message),{status});
export async function roomSalesInstalled(db){
 return !!(await db.query("select to_regclass('mirpanel_community.netflix_room_sellable') installed")).rows[0].installed;
}
export async function reserveNetflixRoom(db,reservationId){
 const result=await db.query(`with choice as (
  select r.id from mirpanel_community.netflix_room_units r join mirpanel_community.netflix_room_sellable s on s.id=r.id
  order by s.group_id,s.room_key,r.id limit 1 for update of r
 ) update mirpanel_community.netflix_room_units r set sale_reservation_id=$1 from choice where r.id=choice.id returning r.id`,[reservationId]);
 if(!result.rowCount)throw fail(409,'Netflix Şəxsi üçün satışa hazır otaq qalmayıb.');
}
export async function releaseNetflixReview(pool,actor,{groupId}={}){
 if(typeof groupId!=='string'||! /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(groupId))throw fail(400,'Netflix hesabını seçin.');
 if(!await roomSalesInstalled(pool))throw fail(503,'Otaq stoku hazırda yenilənir.');
 const c=await pool.connect();
 try{
  await c.query('begin');await c.query('select pg_advisory_xact_lock(714025001)');
  const {rows}=await c.query(`update mirpanel_community.netflix_room_units r set availability='available'
   from mirpanel_community.netflix_room_sale_state s where r.id=s.id and r.group_id=$1
    and not s.assigned and not s.held and not s.synthetic and s.unexpired and s.availability='review'
   returning r.id`,[groupId]);
  if(rows.length)await c.query(`insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
   values('admin',$1,'netflix.rooms_confirmed_empty','netflix_account',$2,$3)`,[actor,groupId,{roomIds:rows.map(r=>r.id)}]);
  await c.query('commit');return {released:rows.length};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
