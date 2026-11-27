const key='mirpanel.epoint.wallet.v1.selection',legacyKey='mirpanel.epoint.wallet.v1';
const names={'apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10'};
const validRef=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value);
const money=c=>(c/100).toFixed(2).replace('.',',')+' ₼';
export async function mountWalletSelection({form,accountId,getCents,signal,back,el,button,walletTile,selectionFlow:flow,request,deviceSupports}){
 if(!accountId||signal.aborted)return;
 let choice;try{choice=JSON.parse(sessionStorage.getItem(key));}catch{}
 if(choice?.accountId!==accountId||!choice.attempts||typeof choice.attempts!=='object')choice={accountId,method:null,cents:null,attempts:{}};
 for(const oldKey of [legacyKey,legacyKey+'.apple']){try{const d=JSON.parse(sessionStorage.getItem(oldKey));if(d?.accountId===accountId&&(names[d.method]||d.method==='card')&&validRef(d.ref)&&Number.isSafeInteger(d.cents))choice.attempts[d.method+':'+d.cents]??=d;}catch{}}
 const notice=el('p','','shop-error');notice.setAttribute('role','status');notice.hidden=true;form.append(notice);
 let config,selected=null,busy=false,dialog=null,previous=null;const tiles=new Map(),actions=el('div',null,'wallet-topup-actions'),next=button('Balansa əlavə et',confirm,true);
 actions.hidden=true;next.classList.add('wallet-topup-continue');actions.append(next);(flow?.methodElement||form).append(actions);
 const say=text=>{notice.textContent=text;notice.hidden=!text;};
 const discard=ref=>{for(const [k,v]of Object.entries(choice.attempts))if(v.ref===ref)delete choice.attempts[k];save();};
 const existing=async ref=>{try{return await request('checkout?ref='+encodeURIComponent(ref),{signal});}catch(e){if(e.status!==404)throw e;discard(ref);return null;}};
 const save=()=>{try{sessionStorage.setItem(key,JSON.stringify(choice));}catch{}};
 function amount(){const c=getCents(),l=config?.limits;if(!Number.isSafeInteger(c)||!Number.isSafeInteger(l?.minCents)||!Number.isSafeInteger(l?.maxCents)||c<l.minCents||c>l.maxCents)throw Error('Etibarlı məbləğ seçin.');return c;}
 function update(){let c;try{c=amount();}catch{}next.textContent=c===undefined?'Balansa əlavə et':'Balansa əlavə et · '+money(c);next.disabled=busy||!selected||c===undefined;actions.hidden=!selected;choice.method=selected;choice.cents=c??null;save();flow?.lockAmount?.(busy);for(const {tile} of tiles.values())tile.disabled=busy;}
 function select(method){if(busy)return;selected=names[method]?method:null;say(previous?.status==='pending'?'Əvvəlki ödənişin nəticəsi yoxlanılır. İkinci ödəniş yaradılmayacaq.':previous?'Başqa ödəniş üsulu seçə bilərsiniz.':'');update();}
 async function load(){
  try{
   config=await request('status',{signal});if(signal.aborted)return;
   const latest=Object.values(choice.attempts).filter(x=>x.accountId===accountId&&validRef(x.ref)).sort((a,b)=>(b.at||0)-(a.at||0))[0];
   const returned=(performance.getEntriesByType('navigation')[0]?.type==='back_forward'?latest?.ref:null)||new URLSearchParams(location.search).get('paymentReturn');
   if(validRef(returned)){
    const found=await existing(returned);
    if(found)await request('leave',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:returned})});
    const d=found?await existing(returned):null;if(signal.aborted)return;
    if(d){
    if(d.purpose==='purchase')throw Error('Sifariş ödənişinə qayıdın.');
    if(d.status==='success'){location.replace('/odenis/epoint/ugurlu?ref='+encodeURIComponent(returned));return;}
    previous={ref:returned,status:d.attemptAbandoned?'failed':d.status};choice.method=d.method;choice.cents=d.cents;
    notice.className='shop-muted checkout-return-note';
    say(d.status==='pending'&&!d.attemptAbandoned?'Əvvəlki ödənişin nəticəsi yoxlanılır. İkinci ödəniş yaradılmayacaq.':'Başqa ödəniş üsulu seçə bilərsiniz.');
    if(d.status==='pending'&&!d.attemptAbandoned){const resume=el('a','Mövcud ödənişə davam et');resume.href='/odenis/epoint/odeme?ref='+encodeURIComponent(returned);form.append(resume);}
    }else say('Ödəniş cəhdi yaradılmayıb. Ödəniş üsulunu seçə bilərsiniz.');
   }
   for(const method of Object.keys(names)){
    if(config?.methods?.[method]!==true||!await deviceSupports(method)||signal.aborted)continue;
    const tile=walletTile(method,()=>select(method));tiles.set(method,tile);
   }
   // Hosted card behavior is intentionally unchanged; these are not wallet cards.
   if(config?.enabled===true){const card=button('Epoint ilə ödə',()=>void start('card'),true);form.append(card);}
   const priorMethod=choice.method,priorCents=choice.cents;
   if(tiles.has(priorMethod)){selected=priorMethod;if(Number.isSafeInteger(priorCents))flow?.restoreCents?.(priorCents);flow?.select?.(selected);}
   else if(Number.isSafeInteger(priorCents))flow?.restoreCents?.(priorCents);
   update();
  }catch{say('Ödəniş üsulları alınmadı.');const retry=button('Yenidən cəhd et',()=>{retry.disabled=true;retry.remove();void load();});form.append(retry);}
 }
 function confirm(){
  let cents;try{cents=amount();}catch{return;}if(!selected||busy||dialog?.open)return;
  const method=selected,d=el('dialog',null,'apple-topup-confirm'),h=el('h2','Balans artımını təsdiqləyin'),buttons=el('div',null,'shop-actions');h.id='walletTopupConfirmTitle';d.setAttribute('aria-labelledby',h.id);
  const cancel=button('Geri',()=>d.close()),yes=button('Təsdiq et',()=>{if(yes.disabled||busy)return;let current;try{current=amount();}catch{}if(current!==cents||selected!==method){d.close();say('Seçim dəyişib. Yenidən təsdiqləyin.');return;}yes.disabled=true;d.close();void start(method,cents);},true);
  buttons.append(cancel,yes);d.append(h,el('p','Balansınıza '+money(cents)+' əlavə etmək istəyirsiniz?'),el('p',names[method]),buttons);document.body.append(d);dialog=d;
  d.addEventListener('close',()=>{d.remove();dialog=null;next.focus();},{once:true});d.showModal();
 }
 async function start(method,fixedCents){
  if(busy||signal.aborted||!form.isConnected)return;let cents;try{cents=fixedCents??amount();}catch(e){say(e.message);return;}
  busy=true;update();say('Ödəniş səhifəsi açılır…');
  const slot=method+':'+cents;
  try{
   if(!previous){const existing=Object.values(choice.attempts).filter(x=>x.accountId===accountId&&validRef(x.ref)).sort((a,b)=>(b.at||0)-(a.at||0))[0];if(existing)previous={ref:existing.ref};}
   if(previous){
    let current=await existing(previous.ref);
    if(!current)previous=null;
    if(current){
    if(current.status==='success'){location.replace('/odenis/epoint/ugurlu?ref='+encodeURIComponent(previous.ref));return;}
    if(current.status==='pending'&&!current.attemptAbandoned){await request('leave',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:previous.ref})});current=await request('checkout?ref='+encodeURIComponent(previous.ref),{signal});if(current.status==='success'){location.replace('/odenis/epoint/ugurlu?ref='+encodeURIComponent(previous.ref));return;}}
    if(current.status!=='failed'&&!current.attemptAbandoned){say('Əvvəlki ödənişin nəticəsi hələ yoxlanılır. İkinci ödəniş yaradılmadı.');return;}
    for(const [k,v]of Object.entries(choice.attempts))if(v.ref===previous.ref)delete choice.attempts[k];
    }
   }
   let d=choice.attempts[slot];if(!validRef(d?.ref)||d.accountId!==accountId||d.method!==method||d.cents!==cents){d={ref:crypto.randomUUID(),accountId,method,cents,at:Date.now(),back:['/qrup','/odenis?mode=wallet','/odenis?mode=wallet&token=1'].includes(back)?back:null};choice.attempts[slot]=d;}
   // Persist BEFORE the only request that can create a provider operation.
   sessionStorage.setItem(key,JSON.stringify(choice));sessionStorage.setItem(method==='apple-pay'?legacyKey+'.apple':legacyKey,JSON.stringify(d));
   const r=await request('start',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:d.ref,amount:(cents/100).toFixed(2),...(method==='card'?{}:{method}),...(previous?{previousPayment:previous.ref}:{})})});
   if(signal.aborted)return;
   if(method==='card'&&r.state==='ready'){location.assign(r.redirect);return;}
   if(['ready','creating'].includes(r.state)){location.assign('/odenis/epoint/odeme?ref='+encodeURIComponent(d.ref));return;}
   if(r.state==='credited'){location.assign('/odenis/epoint/ugurlu?ref='+encodeURIComponent(d.ref));return;}
   if(r.state==='declined'){delete choice.attempts[slot];save();say('Ödəniş başlatılmadı. Yenidən cəhd edin.');return;}
   say('Ödənişin açılması gözlənilir. Yenidən cəhd edin.');
  }catch(e){if([400,415].includes(e.status)){delete choice.attempts[slot];save();}if(!signal.aborted)say(e.status?e.message:'Əlaqə alınmadı. Eyni ödənişlə yenidən cəhd edin.');}
  finally{busy=false;if(!signal.aborted)update();}
 }
 flow?.amountElement?.addEventListener('wallet-amount-change',update,{signal});
 window.addEventListener('pageshow',async event=>{
  if(!event.persisted||busy)return;
  const latest=Object.values(choice.attempts).filter(x=>validRef(x.ref)).sort((a,b)=>(b.at||0)-(a.at||0))[0];
  if(!latest)return;
  try{await request('leave',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:latest.ref})});
   const d=await request('checkout?ref='+encodeURIComponent(latest.ref),{signal});
   if(d.status==='success'){location.replace('/odenis/epoint/ugurlu?ref='+encodeURIComponent(latest.ref));return;}
   previous={ref:latest.ref,status:d.attemptAbandoned?'failed':d.status};say(d.attemptAbandoned?'Başqa ödəniş üsulu seçə bilərsiniz.':'Əvvəlki ödənişin nəticəsi yoxlanılır.');
  }catch{say('Əvvəlki cəhdin vəziyyəti alınmadı. Yenidən cəhd edin.');}
 },{signal});
 flow?.methodElement?.addEventListener('wallet-method-change',event=>select(event.detail?.method),{signal});
 signal.addEventListener('abort',()=>{dialog?.remove();actions.remove();notice.remove();},{once:true});
 await load();
}
