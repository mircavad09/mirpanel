// Receipt URLs are fetched only for visible thumbnails or an explicit preview.
const statuses={all:'Hamısı',approved:'Təsdiqləndi',reviewing:'Yoxlanılır',rejected:'Rədd edildi',cancelled:'Ləğv edildi',canceled:'Ləğv edildi',expired:'Müddəti bitdi'};
const scope=['all','approved','reviewing','rejected'];
const azInteger=new Intl.NumberFormat('az-AZ');
const money=n=>{
 if(n==null||!(/^-?\d+$/.test(String(n))))return '—';
 const cents=BigInt(n),absolute=cents<0n?-cents:cents;
 return (cents<0n?'−':'')+azInteger.format(absolute/100n)+','+String(absolute%100n).padStart(2,'0')+' ₼';
};
const baku=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function timestamp(value){
 if(!value||!Number.isFinite(Date.parse(value)))return '';
 const {day,month,year,hour,minute,second}=Object.fromEntries(baku.formatToParts(new Date(value)).map(p=>[p.type,p.value]));
 return day+'.'+month+'.'+year+' '+hour+':'+minute+':'+second;
}
const numberLabel=row=>row.number?(row.kind==='topup'?'Balans yükləmə №':'Sifariş №')+row.number:'';
const normalize=value=>String(value??'').normalize('NFC').toLocaleLowerCase('az').replace(/ı/g,'i').trim();
export function mountPayments({readOnly=false,content,api,el,button,link,validate,initial,initialRequest,onData,onUnauthorized,spinner,getCached,ui={}}){
 const css='/community-assets/account-payments.css?v=topup-result-1';
 if(!document.head.querySelector('link[data-payment-history]'))document.head.append(el('link',{rel:'stylesheet',href:css,'data-payment-history':'','data-shell-persistent':''}));
 let target=new URLSearchParams(location.search).get('topup')||'';
 let live=true,version=0,status=target?'all':ui.status||'all',page=target?1:ui.page||1,preview=0,data=null;
 const section=el('section',{class:'account-payments'}),summary=el('div',{class:'account-payment-summary'}),filters=el('div',{class:'account-payment-filters',role:'group','aria-label':'Ödəniş filtrləri'}),list=el('div',{class:'account-payment-list'}),message=el('p',{class:'pay-history-message',role:'status'}),pager=el('nav',{class:'pay-history-pager','aria-label':'Ödəniş səhifələri'});
 const search=el('input',{type:'search',placeholder:'Hazırkı səhifədə axtar…','aria-label':'Hazırkı səhifədə axtar',autocomplete:'off'});
 search.value=target?'':ui.search||'';
 const media=el('div',{class:'account-receipt-media'}),dialog=el('dialog',{class:'account-payment-preview','aria-label':'Qəbz önizləməsi'},button('Bağla',()=>dialog.close()),media);
 dialog.addEventListener('close',()=>{preview++;media.replaceChildren();});
 const tools=el('div',{class:'pay-history-tools'},filters,search);
 const chips=new Map(scope.map(key=>{
  const count=el('span',{class:'pay-status-count'},'—');
  const b=button('',()=>{if(status===key&&page===1&&!target)return;target='';status=key;page=1;void load();});
  b.dataset.status=key;b.append(statuses[key],count);filters.append(b);return [key,{b,count}];
 }));
 section.append(el('header',{class:'pay-history-heading'},el('h1',{},'Ödənişlərim'),link('Balans yüklə','/balans','pay-topup')),
  summary,tools,el('p',{class:'pay-history-note'},'Saylar bütün dövr üzrədir. Aşağıdakı siyahı cari səhifədəki ödənişləri göstərir.'),message,list,pager,dialog);
 if(readOnly){
  const history=el('section',{},el('h2',{},'Balans tarixçəsi'));
  const rows=el('div');
  async function loadHistory(page){
   rows.replaceChildren(el('p',{},'Məlumat hazırlanır…'));
   try{
    const data=await api('/api/payments/shop/wallet?page='+page);
    if(!live)return;
    rows.replaceChildren(...data.items.map(row=>el('article',{},el('strong',{},money(row.cents)),el('p',{},row.reason),el('small',{},timestamp(row.created_at)))));
    if(!data.items.length)rows.append(el('p',{},'Balans əməliyyatı yoxdur.'));
    if(page>1)rows.append(button('Əvvəlki əməliyyatlar',()=>void loadHistory(page-1)));
    if(data.more)rows.append(button('Sonrakı əməliyyatlar',()=>void loadHistory(page+1)));
   }catch{if(live)rows.replaceChildren(button('Yenidən cəhd et',()=>void loadHistory(page)));}
  }
  history.append(button('Balans tarixçəsinə bax',()=>void loadHistory(1)),rows);section.append(history);
 }
 content.replaceChildren(section);
 const isImage=m=>/^image\/(png|jpeg|webp)$/i.test(m||'');
 async function receipt(row){
  let d;try{d=await api(row.kind==='topup'?'/api/payments/shop/topup/receipt?id='+encodeURIComponent(row.id):'/api/payments/my-orders/'+encodeURIComponent(row.id)+'/receipt');}catch(e){if(e.status===401&&live)onUnauthorized?.();throw e;}
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
  const number=numberLabel(row);
  const thumb=row.mime?button(row.mime==='application/pdf'?'PDF':'Qəbz',()=>open(row)):el('span',{},'Qəbz yoxdur');thumb.className='account-payment-thumb';
  if(row.mime){thumb.setAttribute('aria-label','Qəbzi böyüt'+(number?': '+number:''));if(isImage(row.mime)&&observer){thumbnails.set(thumb,row);observer.observe(thumb);}}
  const credit=row.kind==='topup'&&row.status==='approved'&&row.cents!=null;
  const amount=el('strong',{class:credit?'account-payment-credit':''},(credit?'+':'')+money(row.cents));
  const title=row.by_receipt?'Qəbzlə ödəniş':row.kind==='topup'?'Balans yükləmə':row.title||'Alış ödənişi';
  const info=el('div',{class:'account-payment-info'},
   el('div',{class:'pay-row-title'},el('strong',{},title),el('span',{class:'account-payment-status','data-status':row.status},statuses[row.status]||'Status məlum deyil')));
  if(row.by_receipt&&row.kind==='order'&&row.title)info.append(el('small',{},row.title));
  for(const [label,value] of [['Göndərilib',row.submitted_at],['Son əməliyyat',row.operation_at]]){
   const text=timestamp(value);
   info.append(el('small',{},label+': ',text?el('time',{datetime:new Date(value).toISOString()},text):'Vaxt qeydə alınmayıb'));
  }
  if(row.kind==='topup'&&row.status==='rejected'&&row.rejection_reason)info.append(el('small',{style:'white-space:pre-wrap;overflow-wrap:anywhere'},'Səbəb — '+row.rejection_reason));
  const selected=target===row.id&&row.kind==='topup';
  return el('article',{class:'account-payment-row'+(selected?' account-payment-selected':''),...(selected?{tabindex:'-1','aria-label':'Seçilmiş müraciət'}:{})},thumb,info,el('div',{class:'pay-row-value'},amount,number?el('small',{},number):null));
 }
 function clearRows(){observer?.disconnect();thumbnails.clear();list.replaceChildren();}
 function renderRows(){
  if(!data)return;
  clearRows();
  const q=normalize(search.value);
  const rows=data.items.filter(row=>!q||normalize([
   row.title,row.by_receipt?'Qəbzlə ödəniş':'',numberLabel(row),statuses[row.status],money(row.cents),timestamp(row.submitted_at),timestamp(row.operation_at)
  ].join(' ')).includes(q));
  list.append(...rows.map(renderRow));
  if(target&&rows.length)requestAnimationFrame(()=>list.querySelector('.account-payment-selected')?.focus({preventScroll:false}));
  message.textContent=target&&rows.length?'Seçilmiş balans müraciəti':rows.length?'':q?'Bu səhifədə axtarışa uyğun ödəniş yoxdur.':'Bu filtrə uyğun ödəniş yoxdur.';
 }
 search.addEventListener('input',()=>{ui.search=search.value;renderRows();});
 function showPage(d){
   validate?.(d);if(!Array.isArray(d.items))throw Error('Ödəniş məlumatı düzgün deyil.');data=d;
   pager.replaceChildren();
   summary.replaceChildren(...[
    ['balance','Cari balans',money(d.balance)],['total','Toplam ödəniş',money(d.total)],['month','Bu ay',money(d.month)],['rejected','Rədd edildi',money(d.rejectedCents),d.rejected+' əməliyyat']
   ].map(([key,label,value,n])=>el('div',{'data-metric':key},el('span',{},label),el('strong',{},value),n?el('small',{},n):null)));
   for(const [key,{count}] of chips)count.textContent=String(d[key]);
   renderRows();
   if(!target)onData?.(d,status,page);
   if(page>1)pager.append(button('Əvvəlki',()=>{page--;void load();}));
   if(page>1||d.more)pager.append(el('span',{},'Səhifə '+page));
   if(d.more)pager.append(button('Növbəti',()=>{page++;void load();}));
 }
 async function load(background=false,started=null){
  ui.status=status;ui.page=page;
  const turn=++version;if(!background){
   const cached=target?null:getCached?.(status,page);
   if(cached){showPage(cached);background=true;}
   else{data=null;clearRows();message.replaceChildren();list.append(spinner?.()||el('span',{},'Ödənişlər yoxlanılır…'));pager.replaceChildren();}
  }
  for(const [key,{b}] of chips)b.setAttribute('aria-pressed',String(status===key));
  try{
   const d=await(!target&&started||api('/api/community/payment-history?status='+status+'&page='+page+(target?'&topup='+encodeURIComponent(target):'')));if(!live||turn!==version)return;showPage(d);
  }catch(e){if(live&&turn===version){
   if(e.status===401&&onUnauthorized){onUnauthorized();return;}
   if([401,403].includes(e.status)){onData?.(null,status,page);data=null;summary.replaceChildren();pager.replaceChildren();for(const {count} of chips.values())count.textContent='—';if(dialog.open)dialog.close();}
   if(!data)clearRows();
   message.replaceChildren('Ödənişlər yüklənmədi. ',button('Yenidən cəhd et',()=>load(!!data)));
  }}
 }
 const hidePreview=()=>{if(document.hidden&&dialog.open){preview++;media.replaceChildren();dialog.close();}};
 const refreshRestoredPage=event=>{if(event.persisted)void load(true);};
 document.addEventListener('visibilitychange',hidePreview);
 window.addEventListener('pageshow',refreshRestoredPage);
 if(initial&&!target)showPage(initial);
 void load(!!initial,initialRequest);return()=>{live=false;version++;preview++;document.removeEventListener('visibilitychange',hidePreview);window.removeEventListener('pageshow',refreshRestoredPage);observer?.disconnect();thumbnails.clear();if(dialog.open)dialog.close();section.remove();};
}
