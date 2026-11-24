(() => {
  'use strict';
  const rows=new Map(),drafts=new Map(),saving=new Set(),messages=new Map(),conflicts=new Set();
  const key=(product,id)=>JSON.stringify([String(product),String(id)]);
  let pending,revision=0,loaded=false;
  function accept(result){
    rows.clear();for(const row of result.rows||[])rows.set(key(row.productId,row.planId),row);
    loaded=true;revision++;
  }
  async function load(){
    if(pending)return pending;
    const generation=revision;
    pending=api('/api/admin/payment-costs').then(result=>{if(generation===revision)accept(result);}).finally(()=>{pending=null;});
    return pending;
  }
  function paint(){
    for(const host of document.querySelectorAll('[data-package-cost]')){
      const id=host.dataset.packageCost,row=rows.get(id),draft=drafts.get(id),input=host.querySelector('input'),button=host.querySelector('[data-cost-save]'),status=host.querySelector('[role=status]');
      const supplier=!!row?.costEvidence;
      input.disabled=!row||supplier||saving.has(id);
      if(document.activeElement!==input)input.value=draft?.value??(row?.costAmount??'');
      button.disabled=!row||supplier||!draft||saving.has(id)||conflicts.has(id);
      button.textContent=saving.has(id)?'Saxlanılır…':'Mayanı saxla';
      host.querySelector('[data-cost-reload]').hidden=!messages.has(id)&&!conflicts.has(id);
      status.textContent=messages.get(id)||(supplier?`Təchizatçı mayası · ${row.costAmount??'məlum deyil'} AZN. Əl ilə dəyişdirilmir.`:!loaded?'Maya yüklənir…':!row?'Yeni paketin mayasını yazmaq üçün əvvəl məhsulu yayımlayın.':draft?'Maya dəyişib; hələ serverdə saxlanmayıb.':'Serverdə saxlanmış maya · AZN. Boş: qeyd edilməyib.');
    }
  }
  function render(product){
    for(const [index,plan] of (product.plans||[]).entries()){
      const body=document.querySelector(`#plans [data-package="${index}"] .packageBody`);if(!body||body.querySelector('[data-package-cost]'))continue;
      const id=key(product.id,plan.id??index),host=document.createElement('div');host.className='packageCost';host.dataset.packageCost=id;
      host.innerHTML='<label>Maya qiyməti — AZN<span class="planPrice"><input type="text" inputmode="decimal" autocomplete="off" placeholder="Qeyd edilməyib" aria-label="Maya qiyməti — AZN"><span aria-hidden="true">₼</span></span></label><div class="packageCostActions"><button type="button" class="btn compact" data-cost-save>Mayanı saxla</button><button type="button" class="btn compact" data-cost-reload hidden>Son dəyəri yüklə</button></div><small role="status"></small><small>Bu maya serverdə ayrıca saxlanır; məhsulun qaralaması və “Yayımla” düyməsi ilə dəyişmir.</small>';
      body.querySelector('[data-field="regularPrice"]').closest('label').after(host);
      const prices=document.createElement('div');prices.className='packagePrices';host.before(prices);
      prices.append(body.querySelector('[data-field="price"]').closest('label'),body.querySelector('[data-field="regularPrice"]').closest('label'),host);
      const input=host.querySelector('input');
      input.addEventListener('input',()=>{const row=rows.get(id);if(!row)return;const old=drafts.get(id);drafts.set(id,{value:input.value,expectedUpdatedAt:old?old.expectedUpdatedAt:row.updatedAt});messages.delete(id);paint();});
      host.querySelector('[data-cost-save]').onclick=async()=>{
        const draft=drafts.get(id),row=rows.get(id);if(!draft||!row||saving.has(id)||conflicts.has(id))return;
        const value=draft.value.trim().replace(',','.');
        if(value&&(!/^\d+(?:\.\d{1,2})?$/.test(value)||Number(value)>9999999.99)){messages.set(id,'Mənfi olmayan, ən çox iki onluq rəqəmli məbləğ yazın.');paint();return;}
        saving.add(id);messages.delete(id);paint();revision++;
        try{
          const result=await api('/api/admin/payment-costs',{method:'POST',body:JSON.stringify({items:[{productId:row.productId,planId:row.planId,cost:value||null,expectedUpdatedAt:draft.expectedUpdatedAt}]})});
          accept(result);drafts.delete(id);messages.set(id,'Maya saxlanıldı. '+Number(result.reconciliation?.updatedOrders||0)+' sifarişin boş mayası tamamlandı.'+(result.reconciliation?.unmatched?.length?' Paket uyğunsuzluğu: '+result.reconciliation.unmatched.map(x=>x.orderCode+' / '+(x.planId??'ID yoxdur')).join(', '):''));window.dispatchEvent(new CustomEvent('mirpanel:costs-saved',{detail:result}));
        }catch(error){messages.set(id,error.message||'Maya saxlanmadı. Yenidən cəhd edin.');if(error.status===409)conflicts.add(id);}
        finally{saving.delete(id);paint();}
      };
      host.querySelector('[data-cost-reload]').onclick=async()=>{try{await load();drafts.delete(id);conflicts.delete(id);messages.delete(id);}catch(error){messages.set(id,error.message||'Maya yüklənmədi.');}paint();};
    }
    paint();
    void load().then(paint).catch(error=>{for(const host of document.querySelectorAll('[data-package-cost]'))messages.set(host.dataset.packageCost,error.message||'Maya yüklənmədi. Yenidən cəhd edin.');paint();});
  }
  window.addEventListener('mirpanel:costs-saved',event=>{accept(event.detail);paint();});
  document.addEventListener('click',event=>{if(event.target.closest('.navBtn[data-view="products"]'))void load().then(paint).catch(()=>{});});
  window.addEventListener('mirpanel:admin-logout',()=>{rows.clear();drafts.clear();messages.clear();conflicts.clear();loaded=false;revision++;paint();});
  window.MirpanelPackageCosts={render};
})();
