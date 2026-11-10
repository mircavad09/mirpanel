const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;},money=c=>c===null?'Məlumat yoxdur':(Number(c)/100).toFixed(2)+' AZN';
const button=(text,fn)=>{const n=el('button',text);n.type='button';n.className='btn';n.onclick=fn;return n;};
export async function renderControlsTab({content,tab,selected,call,valid}){
 const error=el('p');error.setAttribute('role','alert');const safe=fn=>async()=>{try{await fn();}catch(e){error.textContent=e.message;}};
 content.replaceChildren(el('p','Yüklənir…'));
 if(tab==='stats'){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),v=k=>parts.find(p=>p.type===k).value,today=[v('year'),v('month'),v('day')].join('-');
  const from=el('input'),to=el('input');from.type=to.type='date';from.value=today.slice(0,8)+'01';to.value=today;from.setAttribute('aria-label','Başlanğıc tarix');to.setAttribute('aria-label','Son tarix');const graphs=el('div');
  async function load(){const data=await Promise.all(['day','month'].map(period=>call('/user-statistics?'+new URLSearchParams({userId:selected.user.id,from:from.value,to:to.value,period}))));if(!valid())return;graphs.replaceChildren();for(const r of data){graphs.append(el('h3',r.period==='day'?'Günlər':'Aylar'));const grid=el('div');grid.className='uc-grid';for(const [field,label,currency]of [['revenue_cents','Gəlir',true],['profit_cents','Mənfəət',true],['orders','Sifarişlər',false],['cancellations','Ləğvlər',false]]){const card=el('article');card.className='panel';const unknown=field==='profit_cents'&&r.items.some(x=>x[field]===null),sum=r.items.reduce((n,x)=>n+Number(x[field]||0),0);card.append(el('h4',label),el('strong',unknown?'Məlumat yoxdur':currency?money(sum):String(sum)));if(!r.items.length)card.append(el('p','Bu aralıqda sifariş yoxdur.'));else{const chart=el('div');chart.className='uc-chart';const max=Math.max(1,...r.items.map(x=>Number(x[field]||0)));for(const row of r.items){const bar=el('div');bar.title=row.bucket+': '+(currency?money(row[field]):row[field]);const fill=el('span');fill.style.height=Math.max(1,Number(row[field]||0)/max*70)+'px';bar.append(fill,el('small',row.bucket));chart.append(bar);}card.append(chart);}if(field==='cancellations')card.append(el('small','Ləğv edilmiş sifariş məbləği: '+money(r.items.reduce((s,x)=>s+Number(x.cancelled_amount_cents),0))));grid.append(card);}graphs.append(grid);if(r.items.some(x=>x.excluded_non_azn))graphs.append(el('p','AZN-dən fərqli məbləğlər çevirmə qaydası olmadığından maliyyə cəminə daxil edilmir.'));}}
  const tools=el('div');tools.append(from,to,button('Yenilə',safe(load)));content.replaceChildren(tools,error,graphs);await load();return;
 }
 const data=await call('/user-controls?userId='+encodeURIComponent(selected.user.id));if(!valid())return;
 if(tab==='prices'){
  const priceMoney=c=>c==null?'—':(Number(c)/100).toFixed(2).replace('.',',')+' ₼';
  const seller=el('input');seller.type='checkbox';seller.checked=data.seller;seller.style.cssText='width:18px;height:18px;margin:0;flex:0 0 18px';
  const role=el('label','Satıcı — xüsusi qiymətlə alış edən müştəri');role.style.cssText='display:flex;align-items:center;gap:10px';role.prepend(seller);
  seller.onchange=safe(async()=>{seller.disabled=true;try{await call('/user-controls',{kind:'seller',userId:selected.user.id,enabled:seller.checked});await renderControlsTab({content,tab,selected,call,valid});}catch(e){seller.checked=data.seller;throw e;}finally{seller.disabled=false;}});
  const product=el('select'),plan=el('select'),amount=el('input'),standard=el('p'),list=el('div');
  product.setAttribute('aria-label','Məhsul');plan.setAttribute('aria-label','Paket');amount.setAttribute('aria-label','İstifadəçinin qiyməti (₼)');amount.inputMode='decimal';
  for(const p of data.plans)if(![...product.options].some(o=>o.value===p.productId)){const o=el('option',p.product);o.value=p.productId;product.append(o);}
  const selectedPlan=()=>data.plans.find(p=>p.productId===product.value&&p.planKey===plan.value);
  const show=()=>{const p=selectedPlan();amount.value=p?.special==null?'':(Number(p.special)/100).toFixed(2);standard.textContent='Standart qiymət: '+priceMoney(p?.standard);};
  const choose=()=>{plan.replaceChildren();for(const p of data.plans.filter(p=>p.productId===product.value)){const o=el('option',p.plan);o.value=p.planKey;plan.append(o);}show();};product.onchange=choose;plan.onchange=show;choose();
  const savePrice=async value=>{const p=selectedPlan();if(!p)throw Error('Paket seçin.');await call('/user-controls',{kind:'price',userId:selected.user.id,productId:p.productId,planKey:p.planKey,amount:value});await renderControlsTab({content,tab,selected,call,valid});};
  for(const p of data.plans.filter(p=>p.special!==null)){const row=el('p',p.product+' · '+p.plan+' · '+priceMoney(p.special)+' ');row.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap';row.append(button('Redaktə et',()=>{product.value=p.productId;choose();plan.value=p.planKey;show();amount.focus();}));list.append(row);}
  const saveButton=button('Qiyməti saxla',safe(()=>savePrice(amount.value.replace(',','.'))));saveButton.disabled=!data.seller;
  const fields=el('div');fields.style.cssText='display:grid;gap:10px';for(const [name,input]of [['Məhsul',product],['Paket',plan],['İstifadəçinin qiyməti (₼)',amount]]){const label=el('label',name);label.append(input);if(input===amount)fields.append(standard);fields.append(label);}
  content.replaceChildren(el('h3','Xüsusi qiymətlər'),role,el('p',data.seller?data.rule:'Satıcı seçimi bağlıdır. Saxlanmış qiymətlər qorunur; alışda standart qiymət tətbiq olunur.'),fields,saveButton,button('Xüsusi qiyməti sil',safe(()=>savePrice(null))),el('h4','Saxlanmış qiymətlər'),list,error);return;
 }
 if(tab==='referrals'){
  const input=el('input');input.setAttribute('aria-label','Yönləndirmə faizi');input.inputMode='decimal';input.value=data.referralBasisPoints===null?'':String(data.referralBasisPoints/100);const info=el('p',data.referralBasisPoints===null?'Xüsusi faiz yoxdur. Standart referal qaydası hələ qurulmayıb.':input.value+'% — standart qaydanı əvəz edən xüsusi ayar.');
  content.replaceChildren(el('h3','Xüsusi yönləndirmə faizi'),info,input,button('Faizi idarə et',safe(async()=>{await call('/user-controls',{kind:'referral',userId:selected.user.id,percent:input.value});await renderControlsTab({content,tab,selected,call,valid});})),button('Xüsusi faizi sil',safe(async()=>{await call('/user-controls',{kind:'referral',userId:selected.user.id,percent:null});await renderControlsTab({content,tab,selected,call,valid});})),el('h3','Statistika'));
  const grid=el('div');grid.className='uc-grid';for(const label of ['Dəvət olunanlar','Aylıq qazanc','Ümumi qazanc']){const card=el('article');card.className='panel';card.append(el('h4',label),el('strong','—'));grid.append(card);}content.append(grid,el('p','Referal mexanizmi hələ aktiv deyil. Faiz ayarı saxlanılır, komissiya və balans ödənişi hesablanmır.'),el('h3','Referallar'),el('p','Referal məlumatı yoxdur.'),error);return;
 }
 const identity=data.identity,profile=selected.profile||{};
 const view=button('İstifadəçi gözündən bax',safe(async()=>{
  if(view.disabled)return;const tab=window.open('about:blank','_blank');
  if(!tab)throw Error('Yeni tab açıla bilmədi. Brauzerdə yeni pəncərələrə icazə verin.');
  tab.opener=null;view.disabled=true;
  try{const r=await call('/customer-view',{userId:identity.id});tab.location.replace(r.url);}
  catch(e){tab.close();throw e;}finally{view.disabled=false;}
 }));
 const banned=selected.user.blocked&&(!selected.user.banUntil||Date.parse(selected.user.banUntil)>Date.now()),ban=button(banned?'Banı aç':'Ban et',safe(async()=>{if(!banned&&!confirm(selected.user.name+' hesabının sayta girişini bağlamaq istəyirsiniz?'))return;await call('/moderate',{action:banned?'unban':'ban',targetId:identity.id,minutes:null,confirmed:!banned,requestId:crypto.randomUUID()});Object.assign(selected,await call('/users/'+encodeURIComponent(identity.id)));await renderControlsTab({content,tab,selected,call,valid});}));
 const other=el('div');other.className='uc-other';
 const card=title=>{const n=el('section');n.className='uc-other-card';n.append(el('h3',title));other.append(n);return n;};
 const field=(parent,label,value)=>{const n=el('div');n.className='uc-other-field';n.append(el('span',label),el('div',value==null||String(value).trim()===''?'Əlavə edilməyib':value));parent.append(n);return n;};
 const addIcon=(node,path)=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),p=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');p.setAttribute('d',path);svg.append(p);node.prepend(svg);};
 addIcon(view,'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0');
 addIcon(ban,'M5 5l14 14 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0');ban.classList.add('uc-ban');
 const management=card('İdarəetmə'),actions=el('div');actions.className='uc-other-actions';actions.append(view,ban);management.append(actions);
 const login=card('Giriş məlumatları');field(login,'Giriş üsulu',identity.password_login?'E-poçt və şifrə':'Google ilə giriş edir');field(login,'Giriş ünvanı',identity.email);
 const email=field(login,'E-poçt',identity.email),copy=button('Kopyala',safe(async()=>{await navigator.clipboard.writeText(identity.email);copy.textContent='Kopyalandı';}));copy.classList.add('uc-copy');copy.disabled=!identity.email;copy.setAttribute('aria-label','E-poçtu kopyala');email.append(copy);login.append(el('p','E-poçt hazırda dəyişdirilə bilmir'));
 if(identity.password_login&&identity.emailVerified){const reset=button('Şifrəni sıfırla',safe(async()=>{const r=await call('/reset-user-password',{userId:identity.id});error.textContent=r.sent?'Bərpa məktubu göndərildi.':r.message;}));login.append(reset);}else login.append(el('p',identity.password_login?'Şifrə bərpası üçün təsdiqlənmiş e-poçt tələb olunur.':'Şifrə Google hesabınızdan idarə olunur'));
 const personal=card('Şəxsi məlumatlar');for(const [label,value]of [['Ad / soyad',selected.user.name],['Üzv ID-si',selected.user.memberNumber],['Telefon',profile.phone],['WhatsApp',profile.whatsapp],['Instagram',profile.social_links?.instagram],['Facebook',profile.social_links?.facebook],['TikTok',profile.social_links?.tiktok]])field(personal,label,value);
 error.setAttribute('aria-live','polite');other.append(error);content.replaceChildren(other);
}
