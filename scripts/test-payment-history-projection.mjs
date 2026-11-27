import assert from 'node:assert/strict';
import {projectPaymentHistory} from '../mirpanel-admin/customer-payment-history.mjs';
const items=Array.from({length:65},(_,i)=>({id:String(i).padStart(3,'0'),number:String(1000+i),orderCode:2000+i,kind:i%2?'order':'topup',purpose:i%2?'purchase':'topup',cents:i%2?599:500,status:['success','pending','failed','cancelled'][i%4],submitted_at:new Date(1764000000000+i*1000).toISOString()}));
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};const run=q=>projectPaymentHistory(items,'synthetic',new URLSearchParams(q));
const all=run({});eq(all.summary,{all:65,success:17,pending:16,failed:32,totalCents:8500});eq(all.items.length,30);eq(all.more,true);eq(run({page:3}).items.length,5);eq(run({page:3}).summary,all.summary);
for(const q of ['5,99','5.99']){const r=run({q});eq(r.totalCount,32);eq(r.items.every(x=>x.cents===599),true);eq(r.summary,all.summary);}
eq(run({q:'1003'}).items[0].id,'003');eq(run({q:'#1003'}).items[0].number,'1003');
eq(run({status:'failed'}).totalCount,32);eq(run({status:'failed',purpose:'purchase'}).totalCount,16);eq(run({status:'failed',purpose:'purchase',q:'5,99'}).totalCount,16);
eq(run({status:'success',q:'5.99'}).totalCount,0);eq(run({q:'nothing'}).items,[]);eq(run({q:'nothing'}).summary,all.summary);
eq(run({status:'failed'}).facets.purpose,{all:32,topup:16,purchase:16});eq(run({purpose:'purchase'}).facets.status.failed,16);
eq(run({status:'pending',q:'5.99'}).facets.status.pending,16);
console.log(JSON.stringify({checks,scope:'pure projection, all-history totals, decimal search, combined filters, cancellation, pagination'}));
