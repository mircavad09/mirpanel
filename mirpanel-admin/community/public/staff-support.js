const el=(t,text)=>{const n=document.createElement(t);if(text!=null)n.textContent=text;return n;};
const date=v=>v?new Date(v).toLocaleString('az-AZ',{timeZone:'Asia/Baku'}):'—';
const money=v=>(Number(v)/100).toFixed(2)+' ₼';
const states={completed:'Əvəzləmə tamamlandı',waiting_stock:'Əvəzləmə üçün stok gözlənilir',admin_review:'Admin baxışı gözlənilir'};
export function supportView(content,data,{call,button,cards,reload}){
 const id=data.user.id;
 for(const o of data.details||[]){
  const card=cards.get(o.number)||el('article');card.append(el('p','Ödəniş üsulu: '+o.method));
  for(const u of o.units){const unit=el('section');unit.className='support-unit';unit.append(el('strong',u.product+' · '+u.package),el('p','Təhvil: '+date(u.deliveredAt)+' · '+u.quantity+' ədəd'),el('small','Vahid: '+(u.unitId||u.deliveryId)),el('p','Xidmətin son günü: '+(u.serviceUntil||'Dəqiq deyil')),el('p',(u.warranty||'Zəmanət qeyri-müəyyəndir')+(u.warrantyUntil?' · '+u.warrantyUntil:'')));
   const replace=button(u.previous?.state==='waiting_stock'?'Stoku yenidən yoxla':'Əvəzlə',()=>confirmReplacement(data.user,o,u));replace.disabled=!u.canReplace;unit.append(replace);if(u.reason)unit.append(el('p',u.reason));if(u.previous)unit.append(el('p',states[u.previous.state]));
   if(u.canReview)unit.append(button('Admin baxışına göndər',()=>confirmReplacement(data.user,o,u)));
   if(data.permissions.credentials)unit.append(button('Məhsul hesabına bax',async()=>{const d=await call('/credentials',{requestId:crypto.randomUUID(),userId:id,deliveryId:u.deliveryId});const box=el('div');box.append(el('p',d.email),el('p',d.password));unit.append(box);}));card.append(unit);
  }
 }
 content.append(el('h2','Balans artırma və ödəniş tarixçəsi'));
 for(const t of data.topups||[]){const row=el('article');row.append(el('strong',money(t.approved_cents||t.requested_cents)),el('p',date(t.created_at)+' · '+t.method+' · '+t.status));content.append(row);}
 const kinds={topup_credit:'Balans artırılması',purchase_debit:'Balansla ödəniş',purchase_refund:'Geri ödəniş',admin_credit:'Admin əlavəsi',admin_debit:'Admin çıxılması'};
 for(const l of data.ledger||[])content.append(el('p',date(l.created_at)+' · '+money(l.cents)+' · '+(kinds[l.kind]||l.kind)));
 content.append(el('h2','Əvəzləmə tarixçəsi'));
 for(const h of data.history||[]){const row=el('article');row.append(el('strong','№ '+h.order_code+' · '+states[h.state]),el('p',date(h.completed_at||h.created_at)+' · '+h.actor),el('p',h.reason));content.append(row);}
 content.append(el('h2','Dəstək qeydləri'));
 for(const n of data.notes||[]){const row=el('article');row.append(el('small',n.actor+' · '+date(n.created_at)),el('p',n.body));content.append(row);}
 const form=el('form'),note=el('textarea'),save=el('button','Qeydi saxla'),status=el('p');note.required=true;note.minLength=3;note.maxLength=1000;note.placeholder='Dəstək qeydi (şifrə və kod yazmayın)';note.setAttribute('aria-label',note.placeholder);save.type='submit';form.append(note,save,status);const requestId=crypto.randomUUID();form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await call('/note',{requestId,userId:id,body:note.value});await reload();}catch(e){status.textContent=e.message;}finally{save.disabled=false;}};content.append(form);
 function confirmReplacement(user,order,unit){
  const modal=el('dialog'),form=el('form'),title=el('h2','Hesab əvəzləmə'),reason=el('textarea'),err=el('p');title.id='replacementTitle';modal.setAttribute('aria-labelledby',title.id);reason.required=true;reason.minLength=5;reason.maxLength=500;reason.placeholder='Məcburi problem səbəbi (şifrə və kod yazmayın)';reason.setAttribute('aria-label',reason.placeholder);
  form.append(title,el('p',user.name+' · #'+user.memberNumber+' · Sifariş № '+order.number),el('strong',unit.product+' · '+unit.package),el('p','Əvəzlənəcək vahid: '+unit.unitId),el('p',(unit.warranty||'Zəmanət məlum deyil')+' · '+(unit.warrantyUntil||'—')),el('p','Xidmətin son günü dəyişmir: '+unit.serviceUntil),reason,err);
  const back=el('button','Geri'),confirm=el('button','Əvəzləməni təsdiqlə');back.type='button';confirm.type='submit';back.onclick=()=>modal.close();form.append(back,confirm);modal.append(form);document.body.append(modal);modal.onclose=()=>modal.remove();modal.showModal();reason.focus();
  const requestId=crypto.randomUUID();let sending=false;form.onsubmit=async e=>{e.preventDefault();if(sending)return;sending=true;confirm.disabled=true;back.disabled=true;reason.readOnly=true;try{const r=await call('/replace',{requestId,userId:user.id,deliveryId:unit.deliveryId,reason:reason.value,confirmed:true});modal.close();await reload();document.querySelector('#staffError').textContent=states[r.state]||'Nəticə saxlanıldı.';}catch(e){err.textContent=e.message+' Eyni təsdiqlə nəticəni yenidən yoxlaya bilərsiniz.';}finally{sending=false;confirm.disabled=false;back.disabled=false;}};
 }
}
