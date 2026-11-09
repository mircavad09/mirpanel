import {bakuDate,safeCalendarDate} from '../payment-order-lifecycle.mjs';
import {subscriptionReminderEntries} from './subscriptions.mjs';

const queue='mirpanel_community.customer_order_mail';
const prefix='subscription-reminder:';
const dueDays=new Set([5,2,1]);
const isDue=(entry,today)=>dueDays.has(entry.days)&&(!entry.startsOn||entry.startsOn<=today);
const keyFor=entry=>prefix+entry.id+':'+entry.expiresOn+':'+entry.days;

export async function queueSubscriptionReminders(pool,today=bakuDate()){
 let after=null;
 while(true){
  const {rows}=await pool.query(`select u.id from mirpanel_community."user" u
   where ($1::text is null or u.id>$1) and u."emailVerified" and u.email<>''
    and exists (select 1 from mirpanel_community.community_order_owners l where l.user_id=u.id)
   order by u.id limit 100`,[after]);
  if(!rows.length)return;
  const entries=await subscriptionReminderEntries(pool,rows.map(row=>row.id),null,today);
  const due=entries.filter(entry=>isDue(entry,today));
  if(due.length)await pool.query(`insert into ${queue}(event_key,order_id)
   select * from unnest($1::text[],$2::uuid[]) on conflict(event_key) do nothing`,
   [due.map(keyFor),due.map(entry=>entry.orderId)]);
  if(rows.length<100)return;
  after=rows.at(-1).id;
 }
}

export async function resolveSubscriptionReminder(pool,job,today=bakuDate()){
 const match=/^subscription-reminder:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2}):([125])$/i.exec(job.event_key);
 if(!match||!safeCalendarDate(match[2]))return null;
 const [,source,expiresOn,days]=match;
 const {rows}=await pool.query(`select u.id,u.name,u.email from mirpanel_community.community_order_owners l
  join mirpanel_community."user" u on u.id=l.user_id where l.order_id=$1 and u."emailVerified" and u.email<>''`,[job.order_id]);
 if(!rows.length)return null;
 const entries=await subscriptionReminderEntries(pool,rows.map(row=>row.id),source,today);
 const entry=entries.find(item=>item.orderId===job.order_id&&item.expiresOn===expiresOn&&item.days===Number(days)&&isDue(item,today));
 if(!entry)return null;
 return {entry,account:rows.find(row=>row.id===entry.userId)};
}

export function isSubscriptionReminder(job){return job.event_key.startsWith(prefix);}
