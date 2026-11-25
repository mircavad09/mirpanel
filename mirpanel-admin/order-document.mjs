import fs from 'node:fs';
import crypto from 'node:crypto';
import {warrantyText} from './public/product-plan-utils.mjs';
export const documentTitle='MirPanel — Sifariş arayışı və qəbul edilmiş şərtlər';
const missing='Qəbul edilmiş şərtlərin tarixçəsi mövcud deyil';
const text=v=>typeof v==='string'?v:'';
export const documentPaid=o=>o.payment_confirmed===true||['approved','completed'].includes(o.status);
export const maskDocumentEmail=value=>{const [local,domain]=String(value||'').split('@');return local&&domain?local.slice(0,1)+'***@'+domain:'';};
export function plainPolicy(html){return String(html).replace(/<\/(?:p|li|h[1-6]|ul|ol)>/gi,'\n').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
export function currentDocumentPolicy(){
 const html=fs.readFileSync(new URL('../sertler',import.meta.url),'utf8'),sections=[];
 for(const id of [4,6,8]){const expression=new RegExp('<h2[^>]*id="sertler-'+id+'"[^>]*>([\\s\\S]*?)(?=<h2|</div>)','i'),match=html.match(expression);if(!match)throw Error('ACCEPTED_POLICY_SECTION_MISSING');sections.push({id,title:plainPolicy(match[1].split('</h2>')[0]),text:plainPolicy(match[1].split('</h2>').slice(1).join('</h2>')),url:'https://mirpanel.com/sertler#sertler-'+id});}
 return {version:crypto.createHash('sha256').update(JSON.stringify(sections)).digest('hex'),sections};
}
export function captureOrderConsent(customer,items,at,policy=currentDocumentPolicy()){
 return {format:1,acceptedAt:new Date(at).toISOString(),customer:{name:text(customer.name),email:maskDocumentEmail(customer.email)},customerFeeCents:0,
  statement:policy.sections.length?'Ödəniş qaydalarını, geri qaytarma şərtlərini və məsuliyyət hədlərini oxudum və qəbul edirəm.':'Sifariş şərtlərini təsdiqləyirəm.',policy,
  items:items.map(x=>({productId:x.productId,title:x.title,planName:x.planName,quantity:x.quantity,unitCents:x.unitCents,termsVersion:x.termsVersion,terms:text(x.terms),note:text(x.note),durationMonths:x.duration??null,durationDays:x.durationDays??null,warranty:warrantyText({...x,label:x.planName}),gameTerms:x.gameTerms?{warning:text(x.gameTerms.warning),rules:(x.gameTerms.rules||[]).filter(y=>typeof y==='string')}:null}))};
}
export function buildOrderDocument(o,{customer=null,paymentMethod=null}={}){
 if(!documentPaid(o))throw Object.assign(Error('Sənəd yalnız təsdiqlənmiş ödəniş üçün açıqdır.'),{status:409});
 const snap=o.checkout_snapshot||{},saved=snap.orderConsent,history=saved?.format===1&&typeof saved.acceptedAt==='string'&&Array.isArray(saved.items)&&Array.isArray(saved.policy?.sections)?saved:null;
 const source=history?.items||(snap.cartVersion===2&&Array.isArray(snap.items)?snap.items:[{title:o.product_title,planName:o.plan_name,quantity:o.quantity||snap.quantity||1,unitCents:snap.unitCents??(snap.unitPrice!=null?Math.round(Number(snap.unitPrice)*100):o.amount!=null&&Number(o.quantity||1)===1?Math.round(Number(o.amount)*100):null),durationMonths:o.duration_months??snap.durationMonths,durationDays:snap.durationDays,...snap}]);
 const lines=source.map(x=>({title:text(x.title||x.productName||o.product_title),plan:text(x.planName||o.plan_name),quantity:Number.isSafeInteger(Number(x.quantity))&&Number(x.quantity)>0?Number(x.quantity):1,unitCents:Number.isSafeInteger(Number(x.unitCents))&&x.unitCents!=null?Number(x.unitCents):null,duration:x.durationDays?x.durationDays+' gün':x.durationMonths?x.durationMonths+' ay':null,warranty:history?text(x.warranty)||null:warrantyText({...x,label:x.planName||o.plan_name})||null}));
 for(const x of lines)x.totalCents=x.unitCents===null?null:x.unitCents*x.quantity;
 const method=snap.epointPayment?.method,methods={'apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10',card:'Bank kartı'};
 const policy=id=>history?.policy.sections.find(x=>x.id===id),section=(title,rows=[],links=[])=>({title,paragraphs:rows.filter(Boolean),links});
 const terms=history?.items.flatMap(x=>[x.terms?x.title+' · '+x.planName+'\n'+x.terms:'',x.note?x.title+' · İcra qeydi\n'+x.note:'',...(x.gameTerms?[x.gameTerms.warning,...x.gameTerms.rules]:[])]).filter(Boolean)||[];
 const sections=[
  section('2. Sayt qaydaları',history?[history.statement,policy(4)?.text||missing]:[missing],history&&policy(4)?[{label:policy(4).title,url:policy(4).url}]:[]),
  section('3. İcraya başlama və imtina şərtləri',history?(terms.length?terms:['Bu sifarişdə ayrıca icraya başlama və imtina mətni saxlanmayıb.']):[missing]),
  section('4. Xidmətin təqdim edilməsi və üçüncü tərəf platformalar',history?[policy(8)?.text||'Bu mövzu üzrə qəbul edilmiş ayrıca mətn saxlanmayıb.']:[missing],history&&policy(8)?[{label:policy(8).title,url:policy(8).url}]:[]),
  section('5. Dəstək, əvəzləmə və geri qaytarma',[history?policy(6)?.text:missing,'Dəstəyə müraciətdə sifariş № '+o.order_code+' göstərin.'],[{label:'MirPanel WhatsApp dəstəyi',url:'https://wa.me/994514113545'},...(history&&policy(6)?[{label:policy(6).title,url:policy(6).url}]:[])])
 ];
 return {format:1,title:documentTitle,number:'MP-'+String(o.order_code)+'-'+String(o.id).replaceAll('-','').toUpperCase(),orderId:o.id,orderCode:String(o.order_code),filename:'MirPanel-sifaris-'+String(o.order_code).replace(/[^a-zA-Z0-9-]/g,'')+'.pdf',createdAt:o.created_at,acceptedAt:history?.acceptedAt||null,termsVersion:history?.policy.version||null,historyAvailable:!!history,customer:{name:history?.customer.name||text(customer?.name)||'Ad saxlanmayıb',email:history?.customer.email||maskDocumentEmail(customer?.email)||'E-poçt saxlanmayıb'},lines,totalCents:o.amount!=null&&Number.isFinite(Number(o.amount))?Math.round(Number(o.amount)*100):null,currency:o.currency==='AZN'?'AZN':text(o.currency)||'AZN',paymentMethod:text(history?.paymentMethod)||methods[method]||(o.payment_source==='wallet'?'MirPanel balansı':text(paymentMethod)||'Ödəniş üsulu saxlanmayıb'),feeNote:history?.customerFeeCents===0?'Əlavə komissiya yoxdur — ödəniş xidmətinin haqqını MirPanel qarşılayır.':null,sections,disclaimer:'Bu sənəd MirPanel sifariş arayışıdır; Epoint, bank və ya fiskal qurumun rəsmi qəbzi deyil.'};
}
