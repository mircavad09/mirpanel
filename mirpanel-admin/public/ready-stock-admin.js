const mounts=new WeakMap();
const endpoint='/api/admin/payment-ready-stock';
const guideText='Girişdə çətinlik yaşayırsınızsa, zəhmət olmasa, Məlumat və təlimat keçidinə klikləyin.';
const months='yanvar fevral mart aprel may iyun iyul avqust sentyabr oktyabr noyabr dekabr'.split(' ');
const dateParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'});
export function roomEndDate(value,now=new Date()){
 const match=String(value).trim().toLocaleLowerCase('az').match(/^(\d{1,2})\s+(\p{L}+)(?:\s+(\d{4}))?$/u);
 if(!match)return null;
 const [,day,month,explicitYear]=match,m=months.indexOf(month);
 if(m<0||Number(day)<1||Number(day)>31)return null;
 const p=Object.fromEntries(dateParts.formatToParts(now).map(x=>[x.type,x.value]));
 const today=Date.parse(p.year+'-'+p.month+'-'+p.day);
 const first=Number(explicitYear||p.year);
 for(let year=first;year<=first+(explicitYear?0:8);year++){
  const iso=String(year).padStart(4,'0')+'-'+String(m+1).padStart(2,'0')+'-'+day.padStart(2,'0');
  const end=Date.parse(iso);
  if(Number.isFinite(end)&&end>=today&&new Date(end).toISOString().slice(0,10)===iso)
   return {iso,label:Number(day)+' '+month+' '+year,days:(end-today)/86400000};
 }
 return null;
}
export function mountReadyStock(host,api){
 if(mounts.has(host)){void mounts.get(host)();return;}
 host.innerHTML=`<div class="readyStockLayout">
  <section class="readyStockCard">
   <h3>Hazır hesab stoku</h3><p>Hazır mesaj məhsulun bütün paketləri üçün istifadə olunur.</p>
   <form autocomplete="off">
    <label>Məhsul<select name="product" aria-label="Məhsul" required></select></label>
    <label>Paket<select name="plan" aria-label="Paket" required></select></label>
    <div class="readyStockCounts"><button type="button" data-edit-sales aria-expanded="false" aria-controls="readyStockSaleEditor">Satış stoku <strong data-sales>—</strong></button><span>Hazır hesab <strong data-ready>—</strong></span></div>
    <div id="readyStockSaleEditor" hidden>
     <div class="readyStockSale"><label>Satış miqdarı<input name="sales" type="number" min="0" max="10000" step="1" inputmode="numeric" aria-describedby="readyStockSaleHelp"></label><button class="btn" type="button" data-save-sales>Satış stokunu saxla</button></div>
     <p id="readyStockSaleHelp">Bu xanada 0 = Limitsiz. 1–10000 = satış limiti. Əvvəldən sıfır olan stok “Stokda yoxdur” kimi qalır.</p>
    </div>
    <p data-scope></p>
    <label class="readyStockCheck"><input name="auto" type="checkbox" role="switch"> Ödəniş təsdiqlənəndə avtomatik təhvil <strong data-auto aria-hidden="true">Bağlı</strong></label>
    <label>Müştəriyə təqdim ediləcək hazır mesaj<textarea name="template" rows="4" maxlength="8000" spellcheck="false"></textarea></label>
    <div class="readyStockActions"><button class="btn" type="button" data-add-guide>Məlumat və təlimat keçidini əlavə et</button><button class="btn" type="button" data-save-message>Hazır mesajı saxla</button></div>
    <div data-messages></div>
    <div class="readyStockActions"><button class="btn" type="button" data-add-unit>+ Yeni hesab əlavə et</button><button class="btn primary" type="submit">Hesabları və təhvil ayarını saxla</button></div>
   </form>
   <p role="status" aria-live="polite"></p>
  </section>
  <section class="readyStockCard"><h3>Məhsullar üzrə hazır stok</h3><p>Bütün paketlər üzrə sifarişə ayrılmamış hazır hesablar.</p><div data-product-list></div></section>
 </div><div class="readyStockLayout netflixRoomLayout"><section class="readyStockCard" data-netflix-room-stock></section></div>`;
 const form=host.querySelector('form'),{product,plan,sales,auto,template}=form.elements;
 const q=s=>host.querySelector(s),messageList=q('[data-messages]'),report=q('[role=status]'),list=q('[data-product-list]');
 const submit=form.querySelector('[type=submit]'),saveSales=q('[data-save-sales]'),editSales=q('[data-edit-sales]'),editor=q('#readyStockSaleEditor'),add=q('[data-add-unit]');
 const saveMessage=q('[data-save-message]'),addGuide=q('[data-add-guide]');
 const drafts=new Map(),lastPlan=new Map(),messageDrafts=new Map();
 let activeDraft=null,activeProduct;
 let products=[],pending=null,busy=false,loaded=false,read=null;
 const roomHost=q('[data-netflix-room-stock]');
 roomHost.innerHTML=`<h3>Netflix Şəxsi — hazır otaq stoku</h3>
  <p>Otaqlar saxlananda Google Sheets-ə göndərilir. Təsdiqlənmiş 1, 3 və 6 aylıq alışlarda boş otaq avtomatik ayrılır. Hesabın bitmə tarixi müştərinin ödənilmiş müddətini dəyişmir.</p>
  <form autocomplete="off" hidden>
   <div class="netflixRoomCredentials">
    <label>Netflix e-poçtu<input name="email" type="email" maxlength="254" required></label>
    <label>Netflix şifrəsi<input name="password" type="text" maxlength="512" autocomplete="off" spellcheck="false" autocapitalize="off" required></label>
   </div>
   <label>Bitmə tarixi<input name="endsOn" type="text" placeholder="məs. 10 dekabr" maxlength="24" required aria-describedby="netflixRoomDatePreview"></label>
   <p id="netflixRoomDatePreview" aria-live="polite"></p>
   <div data-rooms></div>
   <div class="readyStockActions"><button type="button" class="btn" data-room-add>+ Otaq əlavə et</button><button class="btn primary">Otaqları saxla</button></div>
  </form><p data-room-status role="status"></p><ul data-room-list></ul>`;
 const roomForm=roomHost.querySelector('form'),roomRows=roomHost.querySelector('[data-rooms]'),roomStatus=roomHost.querySelector('[data-room-status]'),roomList=roomHost.querySelector('[data-room-list]');
 let roomRequest=null,roomBusy=false;
 const roomFields='<label>Otaq adı<input name="room" maxlength="50" required></label><label>PIN<input name="pin" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" spellcheck="false" required></label>';
 function addRoom(){
  if(roomRows.children.length>=5)return;
  const row=document.createElement('div');row.className='readyStockAccount netflixRoomRow';
  row.innerHTML=roomFields+'<button type="button" class="btn" aria-label="Otağı sil">×</button>';
  const taken=new Set([...roomRows.querySelectorAll('[name=room]')].map(input=>input.value.trim()));
  row.querySelector('[name=room]').value=['1','2','3','4','5'].find(name=>!taken.has(name))||'';

  row.querySelector('button').onclick=()=>{if(roomRows.children.length>1){row.remove();roomRequest=null;}};
  roomRows.append(row);
 }
 const editRoom=data=>api(endpoint,{method:'POST',body:JSON.stringify({netflixRoomEdit:data})});
 async function openRoom(node,row,button){
  button.disabled=true;roomStatus.textContent='';
  try{
   const result=await editRoom({action:'open',id:row.id});
   if(!node.isConnected)return;
   const form=document.createElement('form');
   form.autocomplete='off';form.className='netflixRoomEdit';
   form.innerHTML='<div class="readyStockAccount netflixRoomRow">'+roomFields+'</div><div class="readyStockActions"><button type="submit" class="btn primary">Dəyişikliyi saxla</button><button type="button" class="btn">Bağla</button></div>';
   const {room,pin}=form.elements,save=form.querySelector('[type=submit]'),close=form.querySelector('[type=button]');
   room.value=result.name;pin.value=result.pin;
   if(!result.editable){room.readOnly=pin.readOnly=true;save.remove();}
   const expiryLabel=document.createElement('label'),expiry=document.createElement('input'),expirySave=document.createElement('button');
   expiryLabel.textContent='Netflix hesabının bitmə tarixi';expiry.type='date';expiry.value=row.endsOn;
   expirySave.type='button';expirySave.className='btn';expirySave.textContent='Bitmə tarixini saxla';expiryLabel.append(expiry,expirySave);form.append(expiryLabel);
   expirySave.onclick=async()=>{
    expirySave.disabled=true;
    try{await editRoom({action:'expiry',id:row.id,endsOn:expiry.value});await refresh();roomStatus.textContent='Hesabın bitmə tarixi yeniləndi. Müştərinin ödənilmiş müddəti qorundu.';}
    catch(e){roomStatus.textContent=e.message||'Tarix saxlanılmadı.';}
    finally{expirySave.disabled=false;}
   };
   const dismiss=()=>{pin.value='';if(form.elements.password)form.elements.password.value='';form.remove();button.hidden=false;button.focus();};
   close.onclick=dismiss;
   form.onsubmit=async event=>{
    event.preventDefault();if(!result.editable||save.disabled)return;
    save.disabled=close.disabled=room.disabled=pin.disabled=true;
    try{
     const updated=await editRoom({action:'save',id:row.id,name:room.value,pin:pin.value});
     row.name=updated.name;node.querySelector('[data-room-summary]').textContent=roomSummary(row);
     dismiss();roomStatus.textContent='Otaq yeniləndi.';
    }catch(e){roomStatus.textContent=e.message||'Otaq saxlanılmadı.';}
    finally{save.disabled=close.disabled=room.disabled=pin.disabled=false;}
   };
   button.hidden=true;node.append(form);pin.focus();
   void editRoom({action:'password',id:row.id}).then(({password})=>{
    if(!form.isConnected||typeof password!=='string')return;
    const label=document.createElement('label'),field=document.createElement('input');
    label.textContent='Netflix şifrəsi';field.name='password';field.type='text';field.readOnly=true;field.value=password;
    field.autocomplete='off';field.spellcheck=false;label.append(field);form.prepend(label);
   }).catch(e=>{if(form.isConnected&&e.status!==403)roomStatus.textContent='Netflix şifrəsi açıla bilmədi.';});
  }catch(e){roomStatus.textContent=e.message||'Otaq açıla bilmədi.';}
  finally{button.disabled=false;}
 }
 const roomSummary=row=>row.name+' · '+row.startsOn+' → '+row.endsOn+' · '+({free:'Satılmayıb',sold:'Satılıb',expired:'Müddəti bitib'}[row.status]||'—');
 function showRooms(rows){
  roomForm.hidden=!Array.isArray(rows);
  if(!Array.isArray(rows)){roomStatus.textContent='Otaq stoku bazada hələ aktiv deyil.';return;}
  roomList.replaceChildren(...rows.map(row=>{
   const node=document.createElement('li');
   const summary=document.createElement('span'),edit=document.createElement('button');
   summary.dataset.roomSummary='';summary.textContent=roomSummary(row);
   edit.type='button';edit.className='btn';edit.textContent='Redaktə et';edit.onclick=()=>void openRoom(node,row,edit);
   node.append(summary,' ',edit);
   if(row.deliveryId){
    const button=document.createElement('button');
    button.type='button';button.className='btn';button.textContent='Yenidən satışa çıxar';
    button.onclick=async()=>{
     const [year,month,day]=row.endsOn.split('-');
     const input=prompt('Otağın yeni bitmə tarixi (məs. 10 dekabr)',Number(day)+' '+months[Number(month)-1]+' '+year);
     if(input===null)return;
     const date=roomEndDate(input);
     if(!date||date.days<1){roomStatus.textContent='Gələcək bitmə tarixini yazın.';return;}
     if(!confirm('Bu otağı yenidən satışa çıxarmaq istəyirsiniz?'))return;
     button.disabled=true;
     try{
      await api(endpoint,{method:'POST',body:JSON.stringify({restockNetflixRoom:{id:row.id,deliveryId:row.deliveryId,endsOn:date.iso}})});
      showRooms((await api(endpoint)).netflixRooms);
      roomStatus.textContent='Otaq yenidən satışa çıxarıldı.';
     }catch(error){roomStatus.textContent=error.message;button.disabled=false;}
    };
    node.append(' ',button);
   }

   return node;
  }));
 }
 const datePreview=roomHost.querySelector('#netflixRoomDatePreview');
 function previewDate(){
  const value=roomForm.elements.endsOn.value,date=roomEndDate(value);
  datePreview.textContent=date?date.label+' · '+date.days+' gün qalıb':value?'Tarixi “10 dekabr” və ya “10 dekabr 2026” kimi yazın.':'';
  return date;
 }
 roomHost.querySelector('[data-room-add]').onclick=()=>{addRoom();roomRequest=null;};
 roomForm.oninput=()=>{roomRequest=null;previewDate();};
 roomForm.onsubmit=async event=>{
  event.preventDefault();if(roomBusy)return;
  const {email,password}=roomForm.elements,date=previewDate();
  if(!date||date.days===0){roomStatus.textContent='Bitmə tarixi Bakı vaxtı ilə bu gündən sonra olmalıdır.';return;}
  roomRequest??=crypto.randomUUID();
  const payload={requestId:roomRequest,email:email.value,password:password.value,endsOn:date.iso,
   rooms:[...roomRows.children].map(row=>({name:row.querySelector('[name=room]').value,pin:row.querySelector('[name=pin]').value}))};
  const fields=[...roomForm.querySelectorAll('input,button')];roomBusy=true;fields.forEach(x=>x.disabled=true);
  roomStatus.textContent='Otaqlar saxlanılır…';
  try{
   const result=await api(endpoint,{method:'POST',body:JSON.stringify({netflixRooms:payload})});
   roomRequest=null;roomForm.reset();previewDate();roomRows.replaceChildren();addRoom();
   roomStatus.textContent=result.added+' otaq saxlanıldı.';
   showRooms((await api(endpoint)).netflixRooms);
  }catch(e){roomStatus.textContent=e.message||'Saxlama təsdiqlənmədi. Yenidən cəhd edin.';}
  finally{roomBusy=false;fields.forEach(x=>x.disabled=false);}
 };
 addRoom();
 const selected=()=>{const p=products.find(x=>x.id===product.value);return {p,item:p?.plans.find(x=>String(x.index)===plan.value)};};
 const accounts=()=>[...messageList.children].map(row=>({email:row.querySelector('[type=email]').value.trim(),password:row.querySelector('[name=password]').value}));
 const say=(text,error=false)=>{report.textContent=text;report.dataset.error=String(error);};
 function controls(){
  const locked=busy||!!pending,absent=!selected().item;
  product.disabled=locked||!loaded;plan.disabled=locked||!loaded;auto.disabled=locked||absent;
  sales.disabled=locked||absent;editSales.disabled=locked||absent;
  for(const node of messageList.querySelectorAll('input,button'))node.disabled=locked||absent;
  template.disabled=locked||!selected().p;
  addGuide.disabled=template.disabled||template.value.trimEnd().split(/\r?\n/).at(-1)===guideText;
  saveMessage.disabled=busy||!selected().p||(pending&&pending.type!=='message')||(!pending&&template.value===selected().p?.message);
  add.disabled=locked||absent||accounts().length>=20;
  submit.disabled=busy||absent||(pending&&pending.type!=='accounts');
  saveSales.disabled=busy||absent||(pending&&pending.type!=='sales');
  for(const b of list.querySelectorAll('button'))b.disabled=locked;
 }
 function numberAccounts(){
  [...messageList.children].forEach((row,index)=>{
   const title='Hesab '+(index+1);
   row.querySelector('h4').textContent=title;
   row.setAttribute('aria-label',title);
  });
 }
 function addAccount(value={}){
  const row=document.createElement('section'),header=document.createElement('header'),heading=document.createElement('h4');
  row.className='readyStockAccount';row.setAttribute('role','group');
  const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Hesabı sil';
  remove.onclick=()=>{
   const nearby=row.nextElementSibling||row.previousElementSibling;
   row.remove();numberAccounts();controls();
   (nearby?.querySelector('button')||add).focus();
  };
  header.append(heading,remove);row.append(header);
  for(const [name,field,type,max] of [['Hesabın e-poçtu','email','email',254],['Hesabın şifrəsi','password','text',512]]){
   const label=document.createElement('label'),box=document.createElement('input');
   label.textContent=name;box.name=field;box.type=type;box.maxLength=max;box.autocomplete=field==='password'?'new-password':'off';box.value=value[field]||'';
   if(field==='password'){box.spellcheck=false;box.autocapitalize='off';}
   label.append(box);row.append(label);
  }
  messageList.append(row);numberAccounts();controls();
 }
 function fillPlans(wanted){
  plan.replaceChildren();for(const x of products.find(x=>x.id===product.value)?.plans||[])plan.add(new Option(x.title,String(x.index)));
  if([...plan.options].some(x=>x.value===wanted))plan.value=wanted;
 }
 function rememberDraft(){
  if(activeProduct){
   const saved=products.find(p=>p.id===activeProduct)?.message??'';
   if(template.value!==saved)messageDrafts.set(activeProduct,template.value);
   else messageDrafts.delete(activeProduct);
  }
  if(activeDraft)drafts.set(activeDraft.key,{accounts:accounts(),auto:activeDraft.originalAuto===auto.checked?undefined:auto.checked});
 }
 function setEditor(open){editor.hidden=!open;editSales.setAttribute('aria-expanded',String(open));}
 function renderSwitch(){const badge=q('[data-auto]');badge.textContent=auto.checked?'Aktiv':'Bağlı';badge.dataset.active=String(auto.checked);}
 function renderPlan(){
  const {p,item}=selected();
  activeProduct=p?.id;template.value=messageDrafts.get(activeProduct)??p?.message??'';
  q('[data-sales]').textContent=!item?'—':item.sales===null?'Limitsiz':item.sales===0?'Stokda yoxdur':item.sales+' satış vahidi';q('[data-ready]').textContent=item?.ready??'—';
  q('[data-scope]').textContent=p?.scope==='plan'?'Satış stoku bu paketə aiddir.':'Satış stoku məhsul üzrə ortaqdır.';
  sales.value=item?.sales>0?item.sales:'';setEditor(false);
  const draftKey=item?JSON.stringify([p.id,item.index,item.signature]):null;
  activeDraft=draftKey?{key:draftKey,originalAuto:item.autoWallet}:null;
  if(p&&item)lastPlan.set(p.id,plan.value);
  const draft=drafts.get(draftKey);
  auto.checked=draft?.auto??!!item?.autoWallet;renderSwitch();
  messageList.replaceChildren();
  for(const value of draft?.accounts||[{}])addAccount(value);
  for(const b of list.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.product===p?.id));
  controls();
 }
 function renderProducts(){
  list.replaceChildren();
  for(const x of products){
   const b=document.createElement('button');b.type='button';b.className='readyStockProduct';b.dataset.product=x.id;
   const image=document.createElement('span');image.className='readyStockImage';image.textContent='◇';image.setAttribute('aria-hidden','true');
   try{
    const url=new URL(x.image,'https://mirpanel.com/');
    if(x.image&&url.protocol==='https:'){
     const img=document.createElement('img');img.src=url.href;img.alt='';img.loading='lazy';img.addEventListener('error',()=>img.remove(),{once:true});image.append(img);
    }
   }catch{}
   const title=document.createElement('strong'),numbers=document.createElement('span');
   title.textContent=x.title;numbers.textContent=x.readyTotal+' hazır hesab';
   b.append(image,title,numbers);b.onclick=()=>{if(product.value!==x.id){rememberDraft();product.value=x.id;fillPlans(lastPlan.get(x.id));renderPlan();}};list.append(b);
  }
 }
 async function refresh(){
  if(read||pending)return;
  read=api(endpoint);
  try{const next=await read,p=product.value,i=plan.value;showRooms(next.netflixRooms);rememberDraft();products=next.products;loaded=true;product.replaceChildren(...products.map(x=>new Option(x.title,x.id)));if(products.some(x=>x.id===p))product.value=p;fillPlans(i);renderProducts();renderPlan();}
  catch(e){say(e.message,true);}
  finally{read=null;controls();}
 }
 async function send(type){
  if(busy||pending&&pending.type!==type)return;
  const {p,item}=selected();if(!item)return;
  if(!pending){
   const data={productId:p.id,index:item.index,planSignature:item.signature,requestId:crypto.randomUUID()};
   if(type==='message'){
    if(!template.value.trim())return say('Hazır mesajı yazın.',true);
    pending={type,data:{productId:p.id,message:template.value}};
   }else if(type==='sales'){
    if(!sales.value||!sales.reportValidity())return say('0–10000 arası satış miqdarı yazın. Limitsiz üçün 0 daxil edin.',true);
    Object.assign(data,{expectedVersion:p.version,available:Number(sales.value)===0?null:Number(sales.value)});
   }else{
    const values=accounts().filter(x=>x.email||x.password);
    if(values.some(x=>!x.email||!x.password.trim()))return say('Hər hesab üçün e-poçt və şifrə yazın.',true);
    Object.assign(data,{accounts:values});
    if(auto.checked!==item.autoWallet)data.autoWallet=auto.checked;
    if(!data.accounts.length&&data.autoWallet===undefined)return say('Hesab əlavə edin və ya təhvil ayarını dəyişin.',true);
   }
   pending??={type,data};
  }
  busy=true;controls();say('Saxlanılır…');
  try{
   const result=await api(endpoint+(type==='accounts'?'':'/'+type),{method:'POST',body:JSON.stringify(pending.data)});
   pending=null;if(type==='accounts'){drafts.delete(activeDraft?.key);activeDraft=null;messageList.replaceChildren();addAccount();}
   if(type==='message'){p.message=result.message;messageDrafts.delete(p.id);template.value=result.message;}
   say(type==='message'?'Hazır mesaj saxlanıldı.':type==='sales'?'Satış stoku saxlanıldı.':result.added?result.added+' hazır hesab saxlanıldı.':'Təhvil ayarı saxlanıldı.');
   await refresh();
  }catch(e){
   if([400,409,422].includes(e.status)){pending=null;say(e.message,true);await refresh();}
   else say((e.message||'Nəticə təsdiqlənmədi.')+' Eyni düymə ilə yenidən cəhd edin. Mətnlər qorunub.',true);
  }finally{busy=false;controls();}
 }
 product.onchange=()=>{rememberDraft();fillPlans(lastPlan.get(product.value));renderPlan();};
 plan.onchange=()=>{rememberDraft();renderPlan();};auto.onchange=renderSwitch;add.onclick=()=>{addAccount();messageList.lastElementChild.querySelector('input').focus();};
 template.oninput=controls;saveMessage.onclick=()=>void send('message');
 addGuide.onclick=()=>{
  if(addGuide.disabled)return;
  const text=template.value.trimEnd(),next=(text?text+'\n\n':'')+guideText;
  if(next.length>template.maxLength){say('Keçid üçün hazır mesajı bir qədər qısaldın.',true);return;}
  template.value=next;controls();template.focus();template.setSelectionRange(next.length,next.length);
  say('Keçid hazır mesaja əlavə edildi. Hazır mesajı saxlayın.');
 };
 editSales.onclick=()=>{setEditor(editor.hidden);if(!editor.hidden)sales.focus();};
 saveSales.onclick=()=>void send('sales');form.onsubmit=e=>{e.preventDefault();void send('accounts');};
 addAccount();mounts.set(host,refresh);void refresh();
}
