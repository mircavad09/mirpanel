const date=x=>x&&!isNaN(Date.parse(x))?new Intl.DateTimeFormat('az-AZ',{timeZone:'Asia/Baku',dateStyle:'short',timeStyle:'short'}).format(new Date(x))+' · Bakı vaxtı':'Məlumat saxlanmayıb';
const money=(x,c)=>x===null?'Məlumat saxlanmayıb':(x/100).toFixed(2).replace('.',',')+' '+(c==='AZN'?'₼':c);
const node=(tag,value,cls)=>{const n=document.createElement(tag);if(value!=null)n.textContent=value;if(cls)n.className=cls;return n;};
export function documentContent(d){
 const box=node('article',null,'order-document-paper');
 box.append(node('h3',d.title),node('p','Sənəd № '+d.number+' · Sifariş № '+d.orderCode),node('p',date(d.createdAt)),node('p','Müştəri: '+d.customer.name+' · '+d.customer.email),node('p',d.acceptedAt?'Qəbul vaxtı: '+date(d.acceptedAt):'Qəbul edilmiş şərtlərin tarixçəsi mövcud deyil'),node('h4','1. Sifariş detalları'));
 for(const x of d.lines){const item=node('div',null,'order-document-item');item.append(node('strong',x.title),node('p',x.plan),node('p','Say: '+x.quantity+' · Vahid qiymət: '+money(x.unitCents,d.currency)),node('p','Sətir cəmi: '+money(x.totalCents,d.currency)));if(x.duration)item.append(node('p','Müddət: '+x.duration));if(x.warranty)item.append(node('p','Zəmanət: '+x.warranty));box.append(item);}
 box.append(node('strong','Ödənilmiş məbləğ: '+money(d.totalCents,d.currency)),node('p','Ödəniş üsulu: '+d.paymentMethod));if(d.feeNote)box.append(node('p',d.feeNote));
 for(const s of d.sections){box.append(node('h4',s.title));for(const p of s.paragraphs)box.append(node('p',p));for(const a of s.links){let url;try{url=new URL(a.url);}catch{continue;}if(url.protocol!=='https:'||!['mirpanel.com','wa.me'].includes(url.hostname))continue;const link=node('a',a.label);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';box.append(link);}}
 box.append(node('small',d.disclaimer));return box;
}
export function mountOrderDocuments(root,{signal}={}){
 const pending=new WeakSet();
 root.addEventListener('toggle',async event=>{
  const details=event.target;if(!details.matches?.('.order-document-accepted')||!details.open||pending.has(details)||details.dataset.loaded)return;
  const order=details.closest('[data-order-id]'),content=details.querySelector('.order-document-content');if(!order||!content)return;
  pending.add(details);content.textContent='Sənəd yüklənir…';
  try{const response=await fetch('/api/payments/my-orders/'+encodeURIComponent(order.dataset.orderId)+'/document',{credentials:'same-origin',cache:'no-store',signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Sənəd yüklənmədi.');if(data.orderId!==order.dataset.orderId)throw Error('Sənəd sifarişə uyğun deyil.');if(!details.isConnected||signal?.aborted)return;content.replaceChildren(documentContent(data));details.dataset.loaded='true';}
  catch(e){if(signal?.aborted)return;content.replaceChildren(node('p',e.message||'Sənəd yüklənmədi.'));const retry=node('button','Yenidən cəhd et');retry.type='button';retry.onclick=()=>{details.open=false;queueMicrotask(()=>details.open=true);};content.append(retry);}
  finally{pending.delete(details);}
 },{capture:true,signal});
}
