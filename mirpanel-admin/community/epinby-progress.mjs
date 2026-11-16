export async function epinbyProgress(db,ids){
 if(!ids.length||!(await db.query("select to_regclass('mirpanel_community.epinby_order_units') n")).rows[0].n)return new Map();
 const {rows}=await db.query(`select d.order_id,d.state,
  exists(select 1 from mirpanel_community.epinby_order_units u where u.dispatch_id=d.id and u.external_id is not null and u.state not in ('failed','delivered')) processing,
  (select string_agg(distinct reason,' · ') from mirpanel_community.epinby_order_units u where u.dispatch_id=d.id and u.state<>'delivered') reason
  from mirpanel_community.api_dispatches d where d.order_id=any($1::uuid[]) and d.settings->>'provider'='epinby' and d.state<>'delivered'`,[ids]);
 const result=new Map();for(const r of rows){const prior=result.get(r.order_id);result.set(r.order_id,{processing:!!(prior?.processing||r.processing),waitingBalance:!!(prior?.waitingBalance||r.state==='waiting_balance'),reason:[prior?.reason,r.reason].filter(Boolean).join(' · ')});}return result;
}
