// Read-only account payment history. Receipt URLs are requested only for
// visible thumbnails or an explicit preview, and are never persisted.
export function mountPayments({content,api,el,button}){
 const statuses={approved:'Təsdiqləndi',reviewing:'Yoxlanılır',rejected:'Rədd edildi',cancelled:'Ləğv edildi',expired:'Müddəti bitdi'};
 const money=n=>n==null?'—':(Number(n)/100).toFixed(2).replace('.',',')+' ₼';
 const date=new Intl.DateTimeFormat('az-AZ',{timeZone:'Asia/Baku',dateStyle:'medium',timeStyle:'short'});
 let live=true,version=0,status='all',page=1,preview=0;
 const section=el('section',{class:'account-payments'}),summary=el('div',{class:'account-payment-summary'}),filters=el('div',{class:'account-payment-filters','aria-label':'Ödəniş filtrləri'}),list=el('div',{class:'account-payment-list'}),message=el('p',{role:'status'}),pager=el('div');
 const media=el('div',{class:'account-receipt-media'}),dialog=el('dialog',{class:'account-payment-preview','aria-label':'Qəbz önizləməsi'},button('Bağla',()=>dialog.close()),media);
 dialog.addEventListener('close',()=>{preview++;media.replaceChildren();});
 section.append(el('h1',{},'Ödənişlərim'),summary,filters,list,message,pager,dialog);content.replaceChildren(section);
 const isImage=m=>/^image\/(png|jpeg|webp)$/i.test(m||'');
 async function receipt(row){
  const d=await api(row.kind==='topup'?'/api/payments/shop/topup/receipt?id='+encodeURIComponent(row.id):'/api/payments/my-orders/'+encodeURIComponent(row.id)+'/receipt');
  const url=new URL(d.url);if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password)throw Error('Qəbz ünvanı düzgün deyil.');
  return {url:url.href,mime:d.mime};
 }
 function image(url){return el('img',{src:url,alt:'Qəbz önizləməsi',referrerpolicy:'no-referrer'});}
 async function open(row){
  const turn=++preview;media.replaceChildren(el('p',{},'Qəbz açılır…'));if(!dialog.open)dialog.showModal();
  try{const d=await receipt(row);if(!live||turn!==preview||!dialog.open)return;
   if(isImage(d.mime))media.replaceChildren(image(d.url));
   else if(d.mime==='application/pdf')media.replaceChildren(el('a',{href:d.url,target:'_blank',rel:'noopener noreferrer'},'PDF qəbzini aç'),el('iframe',{src:d.url,title:'PDF qəbzi',sandbox:'allow-same-origin',referrerpolicy:'no-referrer'}));
   else media.replaceChildren(el('p',{},'Bu qəbz formatı önizlənmir.'));
  }catch{if(live&&turn===preview&&dialog.open)media.replaceChildren(el('p',{},'Qəbz əlçatan deyil.'),button('Yenidən cəhd et',()=>open(row)));}
 }
 const thumbnails=new Map(),observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  for(const entry of entries){if(!entry.isIntersecting)continue;const b=entry.target,row=thumbnails.get(b);observer.unobserve(b);thumbnails.delete(b);if(row)void receipt(row).then(d=>{if(live&&b.isConnected&&isImage(d.mime))b.replaceChildren(image(d.url));}).catch(()=>{});}
 }):null;
 function renderRow(row){
  const thumb=row.mime?button(row.mime==='application/pdf'?'PDF':'Qəbz',()=>open(row)):el('span',{},'Qəbz yoxdur');thumb.className='account-payment-thumb';
  if(row.mime){thumb.setAttribute('aria-label','Qəbzi böyüt: '+row.number);if(isImage(row.mime)&&observer){thumbnails.set(thumb,row);observer.observe(thumb);}}
  const credit=row.kind==='topup'&&row.status==='approved',amount=el('strong',{class:credit?'account-payment-credit':''},(credit?'+':'')+money(row.cents));
  const time=new Date(row.created_at);return el('article',{class:'account-payment-row'},thumb,el('div',{class:'account-payment-info'},el('strong',{},row.title||'Alış ödənişi'),el('time',{},Number.isFinite(+time)?date.format(time):'—'),el('small',{},'№ '+row.number),el('span',{class:'account-payment-status','data-status':row.status},statuses[row.status]||'Status məlum deyil')),amount);
 }
 async function load(){
  const turn=++version;message.replaceChildren('Ödənişlər yoxlanılır…');pager.replaceChildren();
  try{const d=await api('/api/community/payment-history?status='+status+'&page='+page);if(!live||turn!==version)return;
   summary.replaceChildren(...[['Cari balans',money(d.balance)],['Toplam ödəniş',money(d.total)],['Bu ay',money(d.month)],['Rədd edildi',String(d.rejected)]].map(([label,value])=>el('div',{},el('span',{},label),el('strong',{},value))));
   summary.title='Toplam və aylıq məbləğlərə təsdiqlənmiş kart ödənişləri və balans artırmaları daxildir; balansdan edilən alış təkrar sayılmır.';
   filters.replaceChildren(...[['all','Hamısı'],['approved','Təsdiqləndi'],['reviewing','Yoxlanılır'],['rejected','Rədd edildi']].map(([key,label])=>{const b=button(label+' · '+d[key],()=>{status=key;page=1;void load();});b.setAttribute('aria-pressed',String(status===key));return b;}));
   observer?.disconnect();thumbnails.clear();list.replaceChildren(...d.items.map(renderRow));message.textContent=d.items.length?'':'Bu filtrə uyğun ödəniş yoxdur.';
   if(page>1)pager.append(button('Əvvəlki',()=>{page--;void load();}));if(d.more)pager.append(button('Növbəti',()=>{page++;void load();}));
  }catch{if(live&&turn===version)message.replaceChildren('Ödənişlər yüklənmədi. ',button('Yenidən cəhd et',load));}
 }
 void load();return()=>{live=false;version++;preview++;observer?.disconnect();thumbnails.clear();if(dialog.open)dialog.close();};
}
