import {orderLines} from '../order-lines.mjs';

const D='mirpanel_community.customer_order_deliveries', M='mirpanel_community.customer_order_mail';
const O='mirpanel_community.community_order_owners';
const fail=(status,msg)=>Object.assign(Error(msg),{status});
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
export const orderCodeValid=v=>typeof v==='string'&&/^[A-Za-z0-9-]{1,40}$/.test(v);
export const paid=o=>!['rejected','cancelled','expired'].includes(o.status)&&(o.payment_confirmed===true||['approved','completed'].includes(o.status));
export function deliveryLines(o){
 const lines=orderLines(o.checkout_snapshot);
 return lines.length?lines.map((line,i)=>({...line,image:o.checkout_snapshot.items[i].image||''})):
  [{title:o.product_title,planName:o.plan_name,productId:o.product_id,image:o.checkout_snapshot?.image||'',quantity:Number(o.quantity||o.checkout_snapshot?.quantity||1),unitCents:Math.round(Number(o.amount)*100)/Number(o.quantity||o.checkout_snapshot?.quantity||1)}];
}
export function customerStatus(o,records){
 if(!paid(o))return o.status;
 return deliveryLines(o).every((x,i)=>records.filter(r=>r.line_index===i).reduce((n,r)=>n+r.quantity,0)>=x.quantity)?'completed':'preparing';
}
const totals=rows=>Object.fromEntries([...new Set(rows.map(r=>r.line_index))].map(i=>[i,rows.filter(r=>r.line_index===i).reduce((n,r)=>n+r.quantity,0)]));
export async function deliveryRecords(pool,ids){
 if(!ids.length)return [];
 return (await pool.query(`select id,order_id,line_index,quantity,delivered_at from ${D} where order_id=any($1::uuid[]) order by delivered_at,id`,[ids])).rows;
}
export async function ownerCodes(pool,user,id){
 const where=id?'and d.id=$2::uuid':'';
 return (await pool.query(`select d.id,d.order_id,d.line_index,d.quantity,d.delivered_at,${id?'d.message_cipher,':''}o.order_code,o.product_id,o.product_title,o.plan_name,o.checkout_snapshot,o.amount,o.quantity as order_quantity
  from ${D} d join ${O} l on l.order_id=d.order_id join public.payment_orders o on o.id=d.order_id
  where l.user_id=$1 and o.status not in ('rejected','cancelled','expired') and (o.payment_confirmed is true or o.status in ('approved','completed')) ${where}
  order by d.delivered_at desc,d.id desc`,id?[user,id]:[user])).rows;
}
export async function adminDelivery(pool,security,actor,id,input){
 const c=await pool.connect();
 try{
  await c.query('begin');
  const o=(await c.query(`select o.* from public.payment_orders o where o.id=$1 and exists(select 1 from ${O} where order_id=o.id) for update`,[id])).rows[0];
  if(!o)throw fail(404,'Hesaba bağlı sifariş tapılmadı.');
  if(!paid(o))throw fail(409,'Əvvəl ödəniş təsdiqlənməlidir.');
  const lines=deliveryLines(o),records=await deliveryRecords(c,[id]),done=totals(records);
  const view=()=>({lines:lines.map((x,i)=>({index:i,title:x.title,plan:x.planName,remaining:x.quantity-(done[i]||0)})),status:customerStatus(o,records)});
  if(!input){await c.query('commit');return view();}
  const {requestId,line,quantity,message}=input;
  if(!uuid(requestId)||!Number.isInteger(line)||!lines[line]||!Number.isInteger(quantity)||quantity<1||typeof message!=='string'||!message.trim()||message.length>8000)throw fail(400,'Təhvil məlumatları düzgün deyil.');
  const cipher=security.encryptSecret(JSON.stringify({id:requestId,order:id,line,message}));
  const previous=(await c.query(`select order_id,line_index,quantity,message_cipher from ${D} where id=$1`,[requestId])).rows[0];
  if(previous){
   if(previous.order_id!==id||previous.line_index!==line||previous.quantity!==quantity||JSON.parse(security.decryptSecret(previous.message_cipher)).message!==message)throw fail(409,'Əvvəlki sorğunun məlumatı fərqlidir.');
   await c.query('commit');return {...view(),replayed:true};
  }
  if(quantity>lines[line].quantity-(done[line]||0))throw fail(409,'Bu sayda təhvil verilməmiş məhsul qalmayıb.');
  const record=(await c.query(`insert into ${D}(id,order_id,line_index,quantity,message_cipher,actor) values($1,$2,$3,$4,$5,$6) returning id,line_index,quantity`,[requestId,id,line,quantity,cipher,actor])).rows[0];
  await c.query(`insert into ${M}(event_key,order_id,delivery_id) values($1,$2,$3)`,['delivery:'+requestId,id,requestId]);
  records.push(record);done[line]=(done[line]||0)+quantity;
  await c.query('commit');return view();
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount=(v,currency='AZN')=>Number(v).toFixed(2)+' '+currency;
export function orderMail(o,origin){
 const code=String(o.order_code);if(!orderCodeValid(code))throw Error('INVALID_ORDER_CODE');
 const url=new URL('/profil?tab=orders&order='+encodeURIComponent(code),origin).href;
 const ready=!!o.delivery_id, lines=deliveryLines(o), chosen=ready?[{...lines[o.line_index],quantity:o.delivered_quantity}]:lines;
 const subject=ready?'№'+code+' sifarişiniz üzrə məhsul hazırdır':'Sifarişiniz təsdiqləndi';
 const name=o.customer_name||o.name||'',phone=o.customer_phone||o.phone;
 const intro=ready?'№'+code+' sifarişiniz üzrə aşağıdakı məhsullar istifadəyə hazırdır və hesabınıza əlavə edilib.':'№'+code+' sifarişinizin ödənişi təsdiqləndi.';
 const meta=ready?'İstifadəyə hazır məhsulların sayı — '+o.delivered_quantity:[name&&'Sifarişçi: '+name,phone&&'Telefon: '+phone,'E-poçt: '+(o.contact_email||o.email),'Yekun məbləğ: '+amount(o.amount,o.currency)].filter(Boolean).join('\n');
 const label=ready?'Sifarişlərimə bax':'Sifarişə bax';
 const footer=ready?'Məhsul məlumatlarına baxmaq və istifadə etmək üçün hesabınıza daxil olun və sifariş səhifənizi açın.\n\nSuallarınız yaranarsa, bizimlə əlaqə saxlaya bilərsiniz. Bizi seçdiyiniz üçün təşəkkür edirik!':'Sifarişiniz hazırlanır. Təhvil məlumatı hesabınızda göstəriləcək.';
 const line=x=>[x.title,x.planName,x.quantity+' ədəd'].filter(Boolean).join(' · ');
 const image=x=>{try{const u=new URL(x.image,origin);return x.image&&u.origin===origin?'<img width="64" alt="" src="'+esc(u.href)+'"> ':'';}catch{return '';}};
 return {user:{email:o.email},subject,textBody:['Salam'+(name?', '+name:'')+'!',intro,meta,chosen.map(line).join('\n'),footer,label+': '+url,'MirPanel komandası'].join('\n\n'),
  htmlBody:'<p>Salam'+(name?', '+esc(name):'')+'!</p><p>'+esc(intro)+'</p><p>'+esc(meta).replaceAll('\n','<br>')+'</p><ul>'+chosen.map(x=>'<li>'+image(x)+esc(line(x))+'</li>').join('')+'</ul><p>'+esc(footer).replaceAll('\n','<br>')+'</p><p><a href="'+esc(url)+'">'+label+'</a></p><p>MirPanel komandası</p>'};
}
export function createCustomerOrderMailer(pool,send,origin,{pollMs=10000}={}){
 let timer,running;
 const report=(id,state,reason)=>console.warn('CUSTOMER_ORDER_MAIL',id,state,reason);
 async function drain(){
  const stale=await pool.query(`update ${M} set state='uncertain',reason='STALE_SENDING',updated_at=now() where state='sending' and updated_at<now()-interval '2 minutes' returning event_key`);
  for(const row of stale.rows)report(row.event_key,'uncertain','STALE_SENDING');
  for(let i=0;i<4;i++){
   const {rows:[job]}=await pool.query(`with next as (select event_key from ${M} where state='queued' and next_at<=now() order by next_at,event_key for update skip locked limit 1)
   update ${M} m set state='sending',attempts=attempts+1,updated_at=now() from next where next.event_key=m.event_key returning m.*`);
   if(!job)return;
   let state='failed',reason='ACCOUNT_NOT_VERIFIED',provider=null,delay=0;
   const o=(await pool.query(`select o.*,d.id as delivery_id,d.line_index,d.quantity as delivered_quantity,coalesce(ct.name,u.name) as name,u.email,u."emailVerified",ct.email as contact_email,ct.phone
   from public.payment_orders o join ${O} l on l.order_id=o.id join mirpanel_community."user" u on u.id=l.user_id left join mirpanel_community.customer_order_contacts ct on ct.order_id=o.id left join ${D} d on d.id=$2
   where o.id=$1`,[job.order_id,job.delivery_id])).rows[0];
   if(o?.emailVerified&&paid(o)){
    try{
     const result=await send('order',orderMail(o,origin));
     if(typeof result?.id!=='string'||!result.id)throw Error('Missing provider receipt');
     state='accepted';reason=null;provider=result.id;
    }catch(e){
     const retry=e.deliveryDisposition==='retry'&&job.attempts<3;
     state=retry?'queued':['retry','failed'].includes(e.deliveryDisposition)?'failed':'uncertain';
     reason=['TOKEN_TEMPORARY','TOKEN_REJECTED','AUTH_CONFIGURATION','SEND_RATE_LIMITED','SEND_REJECTED'].includes(e.deliveryCode)?e.deliveryCode:'SEND_RESULT_UNKNOWN';
     delay=Math.max(Number(e.retryAfterMs)||0,job.attempts*30000);
    }
   }else if(o?.emailVerified){reason='PAYMENT_NOT_CONFIRMED';}
   await pool.query(`update ${M} set state=$2,reason=$3,provider_id=$4,next_at=now()+$5*interval '1 millisecond',updated_at=now() where event_key=$1 and state='sending'`,[job.event_key,state,reason,provider,delay]);
   if(['uncertain','failed'].includes(state))report(job.event_key,state,reason);
  }
 }
 const wake=()=>running??=(drain().catch(()=>console.warn('CUSTOMER_ORDER_MAIL_DATABASE_ERROR')).finally(()=>{running=null;}));
 return {wake,start(){timer??=setInterval(wake,pollMs);timer.unref?.();void wake();},stop(){clearInterval(timer);timer=null;return running;}};
}
