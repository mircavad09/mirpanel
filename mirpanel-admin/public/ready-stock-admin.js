const mounts=new WeakMap();
const endpoint='/api/admin/payment-ready-stock';
const guideText='Girişdə çətinlik yaşayırsınızsa, zəhmət olmasa, Məlumat və təlimat keçidinə klikləyin.';
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
 </div><section class="readyStockCard" data-netflix-room-stock></section>`;
 const form=host.querySelector('form'),{product,plan,sales,auto,template}=form.elements;
 const q=s=>host.querySelector(s),messageList=q('[data-messages]'),report=q('[role=status]'),list=q('[data-product-list]');
 const submit=form.querySelector('[type=submit]'),saveSales=q('[data-save-sales]'),editSales=q('[data-edit-sales]'),editor=q('#readyStockSaleEditor'),add=q('[data-add-unit]');
 const saveMessage=q('[data-save-message]'),addGuide=q('[data-add-guide]');
 const drafts=new Map(),lastPlan=new Map(),messageDrafts=new Map();
 let activeDraft=null,activeProduct;
 let products=[],pending=null,busy=false,loaded=false,read=null;
 const roomHost=q('[data-netflix-room-stock]');
 roomHost.innerHTML=`<h3>Netflix Şəxsi — hazır otaq stoku</h3>
  <p>Sheets bağlantısı olmadan otaq əlavə edə bilərsiniz. Bu bölmədəki otaqlar hələ avtomatik satışa ayrılmır.</p>
  <form autocomplete="off" hidden>
   <label>Netflix hesabının e-poçtu<input name="email" type="email" maxlength="254" required></label>
   <label>Netflix hesabının şifrəsi<input name="password" type="password" maxlength="512" autocomplete="new-password" required></label>
   <label>Dövrün başlanğıcı<input name="startsOn" type="date" required></label>
   <label>Dövrün bitməsi<input name="endsOn" type="date" required></label>
   <div data-rooms></div>
   <div class="readyStockActions"><button type="button" class="btn" data-room-add>+ Otaq əlavə et</button><button class="btn primary">Otaqları saxla</button></div>
  </form><p data-room-status role="status"></p><ul data-room-list></ul>`;
 const roomForm=roomHost.querySelector('form'),roomRows=roomHost.querySelector('[data-rooms]'),roomStatus=roomHost.querySelector('[data-room-status]'),roomList=roomHost.querySelector('[data-room-list]');
 let roomRequest=null,roomBusy=false;
 function addRoom(){
  if(roomRows.children.length>=20)return;
  const row=document.createElement('div');row.className='readyStockAccount';
  row.innerHTML='<label>Otaq adı<input name="room" maxlength="50" required></label><label>Dördrəqəmli PIN<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label><button type="button" class="btn">Otağı sil</button>';
  row.querySelector('button').onclick=()=>{if(roomRows.children.length>1)row.remove();};
  roomRows.append(row);
 }
 function showRooms(rows){
  roomForm.hidden=!Array.isArray(rows);
  if(!Array.isArray(rows)){roomStatus.textContent='Otaq stoku bazada hələ aktiv deyil.';return;}
  roomList.replaceChildren(...rows.map(row=>{
   const node=document.createElement('li');
   node.textContent=row.name+' · '+row.startsOn+' → '+row.endsOn+' · '+({free:'Boş',sold:'Satılıb',expired:'Yenilənməyib'}[row.status]||'—');
   return node;
  }));
 }
 roomHost.querySelector('[data-room-add]').onclick=addRoom;
 roomForm.oninput=()=>{roomRequest=null;};
 roomForm.onsubmit=async event=>{
  event.preventDefault();if(roomBusy)return;
  const {email,password,startsOn,endsOn}=roomForm.elements;
  roomRequest??=crypto.randomUUID();
  const payload={requestId:roomRequest,email:email.value,password:password.value,startsOn:startsOn.value,endsOn:endsOn.value,
   rooms:[...roomRows.children].map(row=>({name:row.querySelector('[name=room]').value,pin:row.querySelector('[name=pin]').value}))};
  const fields=[...roomForm.querySelectorAll('input,button')];roomBusy=true;fields.forEach(x=>x.disabled=true);
  roomStatus.textContent='Otaqlar saxlanılır…';
  try{
   const result=await api(endpoint,{method:'POST',body:JSON.stringify({netflixRooms:payload})});
   roomRequest=null;roomForm.reset();roomRows.replaceChildren();addRoom();
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
