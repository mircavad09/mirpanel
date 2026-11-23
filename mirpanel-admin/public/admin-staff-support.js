export async function staffSupportSettings(panel,call,userId,valid){
 const el=(t,text)=>{const n=document.createElement(t);if(text)n.textContent=text;return n;};
 const status=el('p','İşçi icazələri yüklənir…');panel.append(status);
 try{
  const role=await call('/staff-role?userId='+encodeURIComponent(userId));if(!valid())return;
  const checks={};for(const [key,label] of [['enabled','İşçi panelinə giriş (yalnız oxuma)'],['support','Müştəri dəstəyi'],['replacement','Hesab əvəzləmə'],['credentials','Məhsul hesabı məlumatlarına baxış']]){
   const row=el('label'),box=el('input');box.type='checkbox';box.checked=role[key]===true;checks[key]=box;row.style.display='block';row.append(box,document.createTextNode(' '+label));panel.append(row);
  }
  const save=el('button','İşçi icazələrini saxla');save.type='button';save.onclick=async()=>{save.disabled=true;try{await call('/staff-role',{userId,...Object.fromEntries(Object.entries(checks).map(([k,v])=>[k,v.checked]))});status.textContent='İcazələr saxlanıldı. Dəstək üçün giriş və Müştəri dəstəyi birlikdə açıq olmalıdır.';}catch(e){status.textContent=e.message;}finally{save.disabled=false;}};
  const entry=el('a','İşçi girişi: /isci');entry.href='https://mirpanel.com/isci';entry.target='_blank';entry.rel='noopener';panel.append(save,entry);status.textContent='İcazələr müstəqildir. Əvəzləmə balansı və zəmanəti dəyişmir.';
  const policies=el('details'),summary=el('summary','Məhsul/paket üzrə əvəzləmə qaydaları və tarixçə');policies.append(summary);panel.append(policies);
  let loaded=false;policies.ontoggle=async()=>{if(!policies.open||loaded)return;loaded=true;try{
   const data=await call('/staff-policy');if(!valid())return;
   policies.append(el('p','Yalnız e-poçt/şifrə ilə hazır stokdan təhvil verilmiş hesablar. Bir təhvil vahidi üçün bir əvəzləmə; növbəti müraciət admin baxışına keçir. Müddət və zəmanət yenidən başlamır.'));
   const search=el('input');search.placeholder='Məhsul və ya paket axtar';search.setAttribute('aria-label',search.placeholder);policies.append(search);
   const list=el('div');policies.append(list);
   const render=()=>{list.replaceChildren();const found=data.plans.filter(p=>(p.title+' '+p.package).toLocaleLowerCase('az').includes(search.value.toLocaleLowerCase('az')));for(const p of found){const row=el('label'),box=el('input');box.type='checkbox';box.checked=p.enabled;box.disabled=!p.eligible;row.style.display='block';row.append(box,document.createTextNode(' '+p.title+' · '+p.package+(!p.eligible?' — uyğun deyil':'')));box.onchange=async()=>{box.disabled=true;try{await call('/staff-policy',{productId:p.productId,index:p.index,signature:p.signature,enabled:box.checked});p.enabled=box.checked;}catch(e){box.checked=p.enabled;status.textContent=e.message;}finally{box.disabled=false;}};list.append(row);}};search.oninput=render;render();
   policies.append(el('h3','Son əvəzləmələr və admin baxışı'));
   for(const h of data.history){const a=el('article');a.append(el('strong','№ '+h.order_code+' · '+h.customer),el('p',h.state+' · '+h.actor+' · '+new Date(h.created_at).toLocaleString('az-AZ')),el('p',h.reason),el('small','Təhvil: '+h.delivery_id+' · əvvəlki: '+(h.old_unit_id||'—')+' · yeni: '+(h.new_unit_id||'—')));policies.append(a);}
  }catch(e){loaded=false;status.textContent=e.message;}};
 }catch(e){status.textContent=e.message;}
}
