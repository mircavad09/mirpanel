import crypto from 'node:crypto';
import {hashPassword,verifyPassword,createStockCrypto,signature,customerDetails,text,quantity,validateTemplate,renderDelivery,whatsAppAdapter,fail} from './employee-security.mjs';
import {planKey} from './payment-profit.mjs';
const uuid=v=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||''))throw fail('Təhlükəsiz əməliyyat açarı tələb olunur.');return v;};
const safeAccount=a=>({id:a.id,login:a.login,name:a.display_name,active:a.active,employeeStartedAt:a.employee_started_at});
export function createEmployeeSystem({client,config,json,readBody,isAdmin,adminMutation,sameOrigin,loadCatalog,guardLogin=async()=>{}}){
 const sessions=new Map(),attempts=new Map(),mutations=new Map(),ttl=8*3600000;
 let stockKeyReady=false;
 try{createStockCrypto(config.encryptionKey);stockKeyReady=true;}catch{/* Fail closed; never log key material. */}
 const enabled=()=>config.employeeEnabled===true&&stockKeyReady&&Boolean(client);
 const cookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim().split('=')));
 const cookie=(id,age=28800)=>`mirpanel_employee_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${config.secureCookie||config.adminBaseUrl?.startsWith('https:')?'; Secure':''}`;
 async function result(query){const {data,error}=await query;if(error)throw fail('Əməliyyat saxlanılmadı. Yenidən cəhd edin.',409);return data;}
 async function rpc(name,args={}){const {data,error}=await client.rpc(name,args);if(error){const code=String(error.message||'').match(/(?:ORDER_ALREADY_CLAIMED|ORDER_ALREADY_ASSIGNED|STOCK_EMPTY|IDEMPOTENCY_CONFLICT|PLAN_MAPPING_REVIEW_REQUIRED|ORDER_FINALIZED|ORDER_NOT_READY|FORBIDDEN|EMPLOYEE_[A-Z_]+|[A-Z_]+_REQUIRED|INVALID_QUANTITY|STOCK_QUANTITY_INCOMPLETE|OPEN_ORDERS_EXIST)/)?.[0];throw Object.assign(fail(({ORDER_ALREADY_CLAIMED:'Bu sifariş artıq icraya götürülüb.',ORDER_ALREADY_ASSIGNED:'Bu sifariş artıq icraya götürülüb.',STOCK_EMPTY:'Stok bitib. Adminə məlumat verin.',PLAN_MAPPING_REVIEW_REQUIRED:'Plan dəyişib; adminin plan uyğunluğunu yoxlaması tələb olunur.',IDEMPOTENCY_CONFLICT:'Təkrar sorğu əvvəlki məlumatlarla uyğun deyil.'})[code]||'Əməliyyat bu vəziyyətdə mümkün deyil.',code==='FORBIDDEN'?403:409),{code});}return data;}
 async function account(id){return result(client.from('employee_accounts').select('*').eq('id',id).maybeSingle());}
 async function session(req){const id=cookies(req).mirpanel_employee_session,s=sessions.get(id);if(!s||s.expires<Date.now()){sessions.delete(id);return null;}const a=await account(s.id);if(!a?.active||a.session_version!==s.version){sessions.delete(id);return null;}s.expires=Date.now()+ttl;return {...s,account:a};}
 async function audit(role,actor,action,order=null,ids=null){await result(client.from('employee_work_audit').insert({actor_role:role,actor_ref:actor,action,order_id:order,stock_ids:ids}));}
 async function blockAdmin(req,res){if(isAdmin(req))return false;if(!enabled()||!client)return false;if(await session(req)){json(res,403,{error:'İşçinin admin funksiyalarına icazəsi yoxdur.'});return true;}return false;}
 async function ownOrder(actor,id){const o=await result(client.from('payment_orders').select('*').eq('id',uuid(id)).maybeSingle());if(!o)throw fail('Sifariş tapılmadı.',404);if(actor.role==='employee'){
  const a=await result(client.from('employee_order_assignments').select('*').eq('order_id',o.id).maybeSingle());
  if(!actor.account.employee_started_at||Date.parse(o.created_at)<Date.parse(actor.account.employee_started_at)||(a&&a.employee_id!==actor.id)||(!a&&!['reviewing','new_receipt_requested'].includes(o.status)))throw fail('Bu sifarişə icazə yoxdur.',403);
 }return o;}
 async function catalog(){const c=await loadCatalog(),counts=await rpc('employee_inventory_counts');return (c.products||[]).map(p=>({id:p.id,title:p.title,image:p.image,active:p.active!==false,plans:(p.plans||[]).map((pl,i)=>{const row=counts.find(v=>v.product_id===p.id&&v.source_plan_key===planKey(pl,i));return {key:planKey(pl,i),id:row?.plan_id||null,label:pl.label||`${pl.months} aylıq`,months:pl.duration_months??pl.durationMonths??pl.months??null,active:pl.active!==false,available:row?.available??null,tracked:row?.inventory_tracked===true,lowStock:row?.low_stock??3,mappingValid:!row||row.signature===signature(pl)};})}));}
 async function resolve(productId,key){const c=await loadCatalog(),p=c.products.find(p=>p.id===productId&&p.active!==false),pl=p?.plans?.find((v,i)=>planKey(v,i)===String(key)&&v.active!==false);if(!p||!pl)throw fail('Məhsul və ya plan tapılmadı.',404);return rpc('employee_plan_resolve',{p_product:p.id,p_key:String(key),p_signature:signature(pl),p_label:pl.label||`${pl.months} aylıq`});}
 async function message(actor,id,key,action='preview'){const o=await ownOrder(actor,id);
  const rows=await result(client.from('employee_stock_units').select('id,product_id,plan_id,secret_cipher').eq('reserved_order_id',o.id).in('state',['RESERVED','DELIVERY_PENDING']));
  const plan=await result(client.from('employee_catalog_plans').select('message_template').eq('id',o.canonical_plan_id).single());
  const crypt=createStockCrypto(config.encryptionKey),units=rows.map(u=>crypt.decrypt(u.secret_cipher,`${u.id}:${u.product_id}:${u.plan_id}`));
  const body=renderDelivery(plan.message_template,o,units);
  await rpc('employee_order_action_v3',{p_order:o.id,p_action:action,p_role:actor.role,p_actor:actor.ref,p_employee:actor.id,p_key:key,p_details:{messageCipher:crypt.encrypt({message:body},`employee-review:${o.id}`)}});
  return action==='whatsapp'?whatsAppAdapter(o.customer_phone,body):{message:body,expiresIn:30};}
 async function handle(req,res){const u=new URL(req.url,'http://localhost'),employee=u.pathname.startsWith('/api/employee/'),admin=u.pathname.startsWith('/api/admin/workforce');if(!employee&&!admin)return false;
  try{
   if(u.pathname==='/api/employee/capabilities'&&req.method==='GET'){json(res,200,{enabled:enabled()});return true;}
   if(!enabled()&&client&&stockKeyReady&&u.pathname!=='/api/employee/login'){
    if(admin&&!isAdmin(req)){if(await session(req)){json(res,403,{error:'İşçinin admin funksiyalarına icazəsi yoxdur.'});return true;}throw fail('Admin sessiyası tələb olunur.',401);}
    if(employee&&!await session(req))throw fail('İşçi sessiyası tələb olunur.',401);
   }
   if(!enabled()||!client)throw fail('İşçi paneli migration və server konfiqurasiyasını gözləyir.',503);
   if(u.pathname==='/api/employee/login'&&req.method==='POST'){
    if(!sameOrigin(req))throw fail('Sorğunun mənbəyi etibarlı deyil.',403);await guardLogin(req);
    const ip=String(req.socket?.remoteAddress||'').slice(0,100),now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
    const limit=attempts.get(ip)||{n:0,until:now+900000};if(++limit.n>12)throw fail('Çox cəhd edildi. 15 dəqiqə sonra yoxlayın.',429);attempts.set(ip,limit);
    const b=await readBody(req,5000),login=text(b.login,80).toLowerCase();
    const a=await result(client.from('employee_accounts').select('*').eq('login',login).maybeSingle());
    // Dummy hash work prevents a fast unknown-user path.
    const valid=await verifyPassword(String(b.password||''),a?.password_hash||'scrypt:00000000000000000000000000000000:'+ '0'.repeat(128));
    if(!valid||!a?.active)throw fail('Giriş məlumatları yanlışdır və ya hesab deaktivdir.',401);
    const id=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(24).toString('hex');sessions.set(id,{id:a.id,version:a.session_version,csrf,expires:now+ttl});
    await audit('employee',a.id,'login');json(res,200,{ok:true},{'Set-Cookie':cookie(id)});return true;
   }
   let actor;
   if(admin){if(await blockAdmin(req,res))return true;if(!isAdmin(req)){json(res,401,{error:'Admin sessiyası tələb olunur.'});return true;}if(req.method!=='GET'&&!adminMutation(req,res))return true;actor={role:'admin',ref:config.username||'admin',id:null};}
   else {const s=await session(req);if(!s)throw fail('İşçi sessiyası tələb olunur.',401);if(req.method!=='GET'&&(!sameOrigin(req)||req.headers['x-csrf-token']!==s.csrf))throw fail('Təhlükəsizlik yoxlaması keçmədi.',403);actor={role:'employee',id:s.id,ref:s.id,account:s.account};
    if(u.pathname==='/api/employee/session'&&req.method==='GET'){json(res,200,{role:'employee',account:safeAccount(s.account),csrfToken:s.csrf});return true;}
    if(u.pathname==='/api/employee/logout'&&req.method==='POST'){sessions.delete(cookies(req).mirpanel_employee_session);json(res,200,{ok:true},{'Set-Cookie':cookie('',0)});return true;}
   }
   const base=admin?'/api/admin/workforce':'/api/employee',suffix=u.pathname.slice(base.length);
   if(suffix==='/review-summary'&&req.method==='GET'){if(!admin)throw fail('Əməliyyata icazə yoxdur.',403);json(res,200,await rpc('employee_review_summary'));return true;}
   if(req.method!=='GET'){const now=Date.now();for(const [key,v] of mutations)if(v.until<now)mutations.delete(key);const key=actor.role+':'+actor.ref,v=mutations.get(key)||{n:0,until:now+60000};if(++v.n>60)throw fail('Çox əməliyyat edildi. Bir dəqiqə sonra yenidən cəhd edin.',429);mutations.set(key,v);}
   if(suffix==='/products'&&req.method==='GET'){const list=await catalog();json(res,200,{products:admin?list:list.filter(p=>p.active).map(p=>({...p,plans:p.plans.filter(pl=>pl.active)}))});return true;}
   if(suffix==='/orders'&&req.method==='GET'){const tab=u.searchParams.get('tab')||'NEW';if(!['all','NEW','EMPLOYEE_ACCEPTED','STOCK_RESERVED','DELIVERED_PENDING_ADMIN','RETURNED_TO_EMPLOYEE','today'].includes(tab))throw fail('Filtr düzgün deyil.');json(res,200,{orders:await rpc('employee_order_list',{p_employee:actor.id,p_tab:tab,p_page:Math.max(0,Math.min(10000,Number(u.searchParams.get('page'))||0))})});return true;}
   if(suffix==='/stock'&&req.method==='GET'){json(res,200,{counts:await rpc('employee_inventory_counts')});return true;}
   if(suffix==='/dashboard'&&req.method==='GET'){const id=admin?uuid(u.searchParams.get('employeeId')):actor.id;const s=await rpc('employee_reporting_snapshot',{p_employee_id:id});const stock=await catalog();const ready=await rpc('employee_order_list',{p_employee:id,p_tab:'NEW',p_page:0});json(res,200,{...s,alerts:admin?await rpc('employee_stock_alerts'):[],newOrders:s.employeeStartedAt?Number(await rpc('employee_queue_count',{p_employee:id})):0,exhausted:[...new Set(stock.filter(p=>p.active&&p.plans.some(pl=>pl.active&&pl.tracked&&Number(pl.available)===0)).map(p=>p.id))],low:[...new Set(stock.filter(p=>p.active&&p.plans.some(pl=>pl.active&&pl.tracked&&Number(pl.available)>0&&Number(pl.available)<=pl.lowStock)).map(p=>p.id))]});return true;}
   if(suffix==='/payroll'&&req.method==='GET'){const month=u.searchParams.get('month')||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit'}).format(new Date());if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw fail('Ay düzgün deyil.');json(res,200,await rpc('employee_monthly_pay',{p_employee:admin?uuid(u.searchParams.get('employeeId')):actor.id,p_month:month+'-01'}));return true;}
   const action=suffix.match(/^\/orders\/([0-9a-f-]+)\/(claim|accept|reserve|preview|whatsapp|sent|submit|verify|return|complete|cancel|receipt|fill|review)$/i);
   if(action){const id=uuid(action[1]),op=action[2];
    if(!admin&&['claim','complete','return','cancel','fill','review'].includes(op))throw fail('Əməliyyata icazə yoxdur.',403);
    const o=await ownOrder(actor,id);
    if(op==='review'&&req.method==='GET'){
     const assignment=await result(client.from('employee_order_assignments').select('*').eq('order_id',id).single());
     const events=await result(client.from('employee_work_audit').select('actor_role,action,created_at,stock_ids,review_reason').eq('order_id',id).order('created_at'));
     const message=assignment.message_cipher?createStockCrypto(config.encryptionKey).decrypt(assignment.message_cipher,`employee-review:${id}`).message:null;
     const employee=await account(assignment.employee_id);const method=o.method_id?await result(client.from('payment_methods').select('display_name,last4').eq('id',o.method_id).maybeSingle()):null;json(res,200,{order:{id:o.id,orderCode:o.order_code,product:o.product_title,plan:o.plan_name,amount:o.amount,currency:o.currency,paymentMethod:o.method_name_snapshot||method?.display_name||'Məlumat yoxdur',last4:o.method_last4_snapshot||method?.last4||'',createdAt:o.created_at,employeeName:employee?.display_name,acceptedAt:assignment.employee_accepted_at,deliveredAt:assignment.employee_delivered_at},message,events,expiresIn:30});return true;
    }
    if(op==='receipt'&&req.method==='GET'){if(o.receipt_deleted_at)throw fail('Çek saxlanma müddəti bitib.',410);const {data,error}=await client.storage.from(o.receipt_bucket).createSignedUrl(o.receipt_path,60);if(error)throw fail('Çek yüklənmədi.',503);await audit(actor.role,actor.ref,'receipt.viewed',id);json(res,200,{url:data.signedUrl,mime:o.receipt_mime});return true;}
    if(req.method!=='POST')throw fail('Əməliyyata icazə yoxdur.',403);
    if((admin&&!['claim','return','complete','cancel','fill'].includes(op))||(!admin&&!['accept','verify','reserve','preview','whatsapp','sent','submit'].includes(op)))throw fail('Əməliyyata icazə yoxdur.',403);
    const b=await readBody(req,10000),key=uuid(req.headers['x-idempotency-key']);
    if(op==='fill'){
     const starts=await result(client.from('employee_accounts').select('employee_started_at').not('employee_started_at','is',null).order('employee_started_at').limit(1));
     if(!starts.length||Date.parse(o.created_at)>=Date.parse(starts[0].employee_started_at))throw fail('Yalnız məlumatı çatışmayan köhnə sifariş tamamlana bilər.',409);
     if(b.confirmPlan!==true)throw fail('Plan uyğunluğunu təsdiqləyin.');const d=customerDetails(b),pid=await resolve(o.product_id,b.planKey);const c=await loadCatalog(),p=c.products.find(p=>p.id===o.product_id),pl=p.plans.find((v,i)=>planKey(v,i)===String(b.planKey));
     if(b.confirmPlan!==true||o.quantity!=null&&o.quantity!==d.quantity||o.canonical_plan_id&&o.canonical_plan_id!==pid)throw fail('Canonical plan və real miqdar şəxsən təsdiqlənməlidir.',409);
     json(res,200,await rpc('employee_fill_legacy',{p_order:id,p_plan:pid,p_customer:d,p_actor:actor.ref}));return true;
    }
    if(['preview','whatsapp'].includes(op)){json(res,200,await message(actor,id,key,op));return true;}
    const details={};if(op==='return'){details.reason=text(b.reason,1000);if(details.reason.length<3)throw fail('Geri qaytarma səbəbini yazın.');}
    if(op==='submit'){if(b.delivered!==true)throw fail('Məhsulu müştəriyə təqdim etdiyinizi təsdiqləyin.');details.note=text(b.note,1000);details.delivered=true;}
    if(op==='verify'){if(b.decision!=='verified')throw fail('Çeki yoxladığınızı təsdiqləyin.');details.decision='verified';details.note=text(b.note,1000);}
    try{json(res,200,await rpc('employee_order_action_v4',{p_order:id,p_action:op,p_role:actor.role,p_actor:actor.ref,p_employee:actor.id,p_key:key,p_quantity:quantity(b.quantity),p_details:details}));}
    catch(error){if(op==='reserve'&&error.code==='STOCK_EMPTY')await audit(actor.role,actor.ref,'stock.empty',id);throw error;}return true;
   }
   if(!admin)throw fail('İşçi üçün bu əməliyyata icazə yoxdur.',403);
   if(suffix==='/plans/review'&&req.method==='POST'){
    const b=await readBody(req,5000);if(b.confirm!==true)throw fail('Yeni plan uyğunluğu üçün təsdiq tələb olunur.');
    const c=await loadCatalog(),p=c.products.find(p=>p.id===b.productId),pl=p?.plans?.find((v,i)=>planKey(v,i)===String(b.planKey));
    if(!p||!pl)throw fail('Canonical məhsul/plan tapılmadı.',404);
    json(res,200,{id:await rpc('employee_plan_review',{p_product:p.id,p_key:String(b.planKey),p_signature:signature(pl),p_label:pl.label||`${pl.months} aylıq`,p_actor:actor.ref})});return true;
   }
   if(suffix==='/accounts'&&req.method==='GET'){json(res,200,{accounts:(await result(client.from('employee_accounts').select('*').order('created_at'))).map(safeAccount)});return true;}
   if(suffix==='/accounts'&&req.method==='POST'){const b=await readBody(req,5000),login=text(b.login,80).toLowerCase();if(!/^[a-z0-9._-]{3,80}$/.test(login))throw fail('Giriş adı düzgün deyil.');if(crypto.timingSafeEqual(crypto.createHash('sha256').update(String(b.password||'')).digest(),crypto.createHash('sha256').update(config.password||'').digest()))throw fail('İşçi və admin şifrələri ayrı olmalıdır.');const a=await result(client.from('employee_accounts').insert({login,display_name:text(b.name,120),password_hash:await hashPassword(b.password)}).select('*').single());await audit('admin',actor.ref,'account.created');json(res,201,{account:safeAccount(a)});return true;}
   const acc=suffix.match(/^\/accounts\/([0-9a-f-]+)\/(start|disable|revoke|enable|restart|salary|paid)$/i);
   if(acc&&req.method==='POST'){const id=uuid(acc[1]),op=acc[2],b=await readBody(req,6000),a=await account(id);if(!a)throw fail('İşçi tapılmadı.',404);
    if(op==='start'){json(res,200,await rpc('employee_start_reporting',{p_employee_id:id,p_actor:actor.ref}));return true;}
    if(['disable','revoke','enable'].includes(op)){json(res,200,await rpc('employee_account_control',{p_id:id,p_action:op,p_actor:actor.ref}));return true;}
    if(op==='restart'){if(b.confirmation!=='YENİ HESABAT DÖVRÜ'||b.confirmAgain!==true)throw fail('İki mərhələli təsdiq tələb olunur.');json(res,200,await rpc('employee_restart_reporting',{p_id:id,p_actor:actor.ref,p_confirmation:b.confirmation,p_key:uuid(req.headers['x-idempotency-key'])}));return true;}
    if(op==='salary'){for(const k of ['salary_cents','rate_cents','quality_cents'])if(!Number.isSafeInteger(b[k])||b[k]<0||b[k]>100000000)throw fail('Maaş məbləği düzgün deyil.');await result(client.from('employee_salary_settings').upsert({employee_id:id,salary_cents:b.salary_cents,rate_cents:b.rate_cents,quality_cents:b.quality_cents}));await audit('admin',actor.ref,'salary.settings');json(res,200,{ok:true});return true;}
    if(op==='paid'){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month)||b.confirm!==true)throw fail('Ay və təsdiq tələb olunur.');const pay=await rpc('employee_monthly_pay',{p_employee:id,p_month:b.month+'-01'});await result(client.from('employee_payroll_paid').upsert({employee_id:id,month:b.month+'-01',amount_cents:pay.previewTotalCents,paid_by:actor.ref},{onConflict:'employee_id,month',ignoreDuplicates:true}));await audit('admin',actor.ref,'salary.marked_paid');json(res,200,{ok:true,bankTransfer:false});return true;}
   }
   if(suffix==='/stock'&&req.method==='POST'){const b=await readBody(req,150000),key=uuid(req.headers['x-idempotency-key']),pid=await resolve(text(b.productId,100),text(b.planKey,120)),crypt=createStockCrypto(config.encryptionKey);if(!Array.isArray(b.items)||b.items.length<1||b.items.length>100)throw fail('1–100 ayrı stok vahidi daxil edin.');const items=b.items.map((v,i)=>{const secret={email:text(v.email,254),password:String(v.password||''),code:text(v.code,1000),inviteLink:text(v.inviteLink,2000),instructions:text(v.instructions,4000)};if(secret.password.length>1000||!Object.values(secret).some(Boolean))throw fail('Stok vahidi boş ola bilməz.');if(secret.inviteLink&&!/^https:\/\//i.test(secret.inviteLink))throw fail('Dəvət linki HTTPS olmalıdır.');const id=crypt.id(key,i);return {id,cipher:crypt.encrypt(secret,`${id}:${b.productId}:${pid}`),fingerprint:crypt.fingerprint({email:secret.email.toLowerCase(),password:secret.password,code:secret.code,inviteLink:secret.inviteLink}),requestFingerprint:crypt.fingerprint(secret),note:text(v.note,500)};});json(res,201,await rpc('employee_add_stock',{p_product:b.productId,p_plan:pid,p_items:items,p_actor:actor.ref,p_key:key}));return true;}
   if(suffix==='/stock/units'&&req.method==='GET'){
    const rows=await result(client.from('employee_stock_units').select('id,product_id,plan_id,secret_cipher,note,state,reserved_order_id,delivered_order_id,employee_id,created_at,delivered_at,admin_approved_at,version').order('created_at',{ascending:false}).range(Math.max(0,Number(u.searchParams.get('page')||0))*50,Math.max(0,Number(u.searchParams.get('page')||0))*50+49));
    const crypt=createStockCrypto(config.encryptionKey),units=rows.map(({secret_cipher,...row})=>{const secret=crypt.decrypt(secret_cipher,`${row.id}:${row.product_id}:${row.plan_id}`);return {...row,maskedEmail:secret.email?`${secret.email.slice(0,1)}***@${secret.email.split('@')[1]||'***'}`:'',maskedCode:secret.code?'••••'+secret.code.slice(-2):''};});
    json(res,200,{units});return true;
   }
   const unit=suffix.match(/^\/stock\/([0-9a-f-]+)\/(disable|invalid)$/i);if(unit&&req.method==='POST'){const id=uuid(unit[1]),old=await result(client.from('employee_stock_units').select('state,version,reserved_order_id').eq('id',id).single());if(old.state==='DELIVERED'||unit[2]==='disable'&&old.state!=='AVAILABLE')throw fail('Bu stok vahidinin statusunu dəyişmək olmaz.',409);await result(client.from('employee_stock_units').update({state:unit[2]==='invalid'?'INVALID':'DISABLED',version:old.version+1}).eq('id',id).eq('version',old.version).select('id').single());await audit('admin',actor.ref,'stock.'+unit[2],old.reserved_order_id,[id]);json(res,200,{ok:true});return true;}
   if(suffix==='/template'&&req.method==='GET'){const productId=text(u.searchParams.get('productId'),100),key=text(u.searchParams.get('planKey'),120);const row=await result(client.from('employee_catalog_plans').select('message_template').eq('product_id',productId).eq('source_plan_key',key).maybeSingle());json(res,200,{template:row?.message_template||''});return true;}
   if(suffix==='/template'&&req.method==='POST'){const b=await readBody(req,16000),id=await resolve(b.productId,b.planKey);await result(client.from('employee_catalog_plans').update({message_template:validateTemplate(b.template)}).eq('id',id));await audit('admin',actor.ref,'template.updated');json(res,200,{ok:true});return true;}
   if(suffix==='/audit'&&req.method==='GET'){json(res,200,{events:await result(client.from('employee_work_audit').select('*').order('created_at',{ascending:false}).range(Number(u.searchParams.get('page')||0)*50,Number(u.searchParams.get('page')||0)*50+49))});return true;}
   throw fail('Endpoint tapılmadı.',404);
  }catch(error){json(res,error.status||500,{error:error.status?error.message:'İşçi xidməti sorğunu tamamlaya bilmədi.'});return true;}
 }
 return {handle,blockAdmin,session,enabled};
}
