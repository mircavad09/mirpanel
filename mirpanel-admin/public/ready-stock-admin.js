const mounts=new WeakMap();
const endpoint='/api/admin/payment-ready-stock';
export function mountReadyStock(host,api){
 if(mounts.has(host)){void mounts.get(host)();return;}
 host.innerHTML=`<div class="readyStockLayout">
  <section class="readyStockCard">
   <h3>Hazır hesab əlavə et</h3><p>Bu mətn ödənişdən sonra yalnız sifariş sahibinə göstərilir.</p>
   <form autocomplete="off">
    <label>Məhsul<select name="product" aria-label="Məhsul" required></select></label>
    <label>Paket<select name="plan" aria-label="Paket" required></select></label>
    <div class="readyStockCounts"><span>Satış stoku <strong data-sales>—</strong></span><span>Hazır hesab <strong data-ready>—</strong></span></div>
    <div class="readyStockSale"><label>Satış miqdarı<input name="sales" type="number" min="0" max="10000" step="1"></label><label class="readyStockCheck"><input name="unlimited" type="checkbox"> Limitsiz</label><button class="btn" type="button" data-save-sales>Satış stokunu saxla</button></div>
    <p data-scope></p>
    <label class="readyStockCheck"><input name="auto" type="checkbox"> Balansla avtomatik təhvil</label>
    <div data-messages></div>
    <div class="readyStockActions"><button class="btn" type="button" data-add-unit>+ Yeni hesab əlavə et</button><button class="btn primary" type="submit">Yadda saxla</button></div>
   </form>
   <p role="status" aria-live="polite"></p>
  </section>
  <section class="readyStockCard"><h3>Paketlər üzrə stok</h3><p>Satış limiti və təhvil üçün hazır hesablar ayrı göstərilir.</p><div data-plan-list></div></section>
 </div>`;
 const form=host.querySelector('form'),{product,plan,sales,unlimited,auto}=form.elements;
 const q=s=>host.querySelector(s),messageList=q('[data-messages]'),report=q('[role=status]'),list=q('[data-plan-list]');
 const submit=form.querySelector('[type=submit]'),saveSales=q('[data-save-sales]'),add=q('[data-add-unit]');
 let products=[],pending=null,busy=false,loaded=false,read=null;
 const selected=()=>{const p=products.find(x=>x.id===product.value);return {p,item:p?.plans.find(x=>String(x.index)===plan.value)};};
 const messages=()=>[...messageList.querySelectorAll('textarea')];
 const say=(text,error=false)=>{report.textContent=text;report.dataset.error=String(error);};
 function controls(){
  const locked=busy||!!pending,absent=!selected().item;
  product.disabled=locked||!loaded;plan.disabled=locked||!loaded;auto.disabled=locked||absent;
  sales.disabled=locked||absent||unlimited.checked;unlimited.disabled=locked||absent;
  for(const node of messageList.querySelectorAll('textarea,button'))node.disabled=locked||absent;
  add.disabled=locked||absent||messages().length>=20;
  submit.disabled=busy||absent||pending?.type==='sales';
  saveSales.disabled=busy||absent||pending?.type==='accounts';
  for(const b of list.querySelectorAll('button'))b.disabled=locked;
 }
 function addMessage(){
  const row=document.createElement('div');row.className='readyStockMessage';
  const label=document.createElement('label'),title=document.createElement('span'),box=document.createElement('textarea');
  title.textContent='Müştəriyə təqdim ediləcək mətn';box.rows=4;box.maxLength=8000;box.spellcheck=false;
  label.append(title,box);row.append(label);
  if(messages().length){const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Sahəni sil';remove.onclick=()=>{row.remove();controls();};row.append(remove);}
  messageList.append(row);controls();
 }
 function fillPlans(wanted){
  plan.replaceChildren();for(const x of products.find(x=>x.id===product.value)?.plans||[])plan.add(new Option(x.title,String(x.index)));
  if([...plan.options].some(x=>x.value===wanted))plan.value=wanted;
 }
 function renderPlan(){
  const {p,item}=selected();
  q('[data-sales]').textContent=item?(item.sales??'Limitsiz'):'—';q('[data-ready]').textContent=item?.ready??'—';
  q('[data-scope]').textContent=p?.scope==='plan'?'Satış stoku bu paketə aiddir.':'Satış stoku məhsul üzrə ortaqdır.';
  sales.value=item?.sales??'';unlimited.checked=!!item&&item.sales===null;auto.checked=!!item?.autoWallet;
  list.replaceChildren();
  for(const x of p?.plans||[]){
   const b=document.createElement('button');b.type='button';b.className='readyStockPlan';b.setAttribute('aria-pressed',String(x===item));
   const title=document.createElement('strong'),numbers=document.createElement('span'),mode=document.createElement('small');
   title.textContent=x.title;numbers.textContent='Satış: '+(x.sales??'Limitsiz')+' · Hazır: '+x.ready;
   mode.textContent=x.autoWallet?'Avtomatik təhvil açıqdır':'Avtomatik təhvil bağlıdır';
   b.append(title,numbers,mode);b.onclick=()=>{plan.value=String(x.index);renderPlan();};list.append(b);
  }
  controls();
 }
 async function refresh(){
  if(read||pending)return;
  const p=product.value,i=plan.value;read=api(endpoint);
  try{products=(await read).products;loaded=true;product.replaceChildren(...products.map(x=>new Option(x.title,x.id)));if(products.some(x=>x.id===p))product.value=p;fillPlans(i);renderPlan();}
  catch(e){say(e.message,true);}
  finally{read=null;controls();}
 }
 async function send(type){
  if(busy||pending&&pending.type!==type)return;
  const {p,item}=selected();if(!item)return;
  if(!pending){
   const data={productId:p.id,index:item.index,planSignature:item.signature,requestId:crypto.randomUUID()};
   if(type==='sales'){
    if(!unlimited.checked&&(!sales.value||!sales.reportValidity()))return say('0–10000 arası satış miqdarı yazın və ya Limitsiz seçin.',true);
    Object.assign(data,{expectedVersion:p.version,available:unlimited.checked?null:Number(sales.value)});
   }else{
    Object.assign(data,{messages:messages().map(x=>x.value).filter(x=>x.trim())});
    if(auto.checked!==item.autoWallet)data.autoWallet=auto.checked;
    if(!data.messages.length&&data.autoWallet===undefined)return say('Hazır mətn yazın və ya təhvil ayarını dəyişin.',true);
   }
   pending={type,data};
  }
  busy=true;controls();say('Saxlanılır…');
  try{
   const result=await api(endpoint+(type==='sales'?'/sales':''),{method:'POST',body:JSON.stringify(pending.data)});
   pending=null;if(type==='accounts'){messageList.replaceChildren();addMessage();}
   say(type==='sales'?'Satış stoku saxlanıldı.':result.added?result.added+' hazır hesab saxlanıldı.':'Təhvil ayarı saxlanıldı.');
   await refresh();
  }catch(e){
   if([400,409,422].includes(e.status)){pending=null;say(e.message,true);await refresh();}
   else say((e.message||'Nəticə təsdiqlənmədi.')+' Eyni düymə ilə yenidən cəhd edin. Mətnlər qorunub.',true);
  }finally{busy=false;controls();}
 }
 product.onchange=()=>{fillPlans();renderPlan();};
 plan.onchange=renderPlan;unlimited.onchange=controls;add.onclick=addMessage;
 saveSales.onclick=()=>void send('sales');form.onsubmit=e=>{e.preventDefault();void send('accounts');};
 addMessage();mounts.set(host,refresh);void refresh();
}
