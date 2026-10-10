(function(){
  const editor=document.getElementById('salesEditor'), status=document.getElementById('salesStatus');
  if(!editor || !status) return;
  let data=null, busy=false, dirty=false;
  const number=new Intl.NumberFormat('az-AZ');
  const el=(tag,value,className='')=>{const e=document.createElement(tag);e.textContent=value;e.className=className;return e;};
  async function load(){
    if(busy) return;
    if(dirty && !confirm('Yadda saxlanmamış tarixi say dəyişiklikləri itəcək. Davam edirsiniz?')) return;
    await run(async()=>{data=await api('/api/admin/product-sales');dirty=false;render();});
  }
  async function run(operation){
    if(busy) return;
    busy=true;
    document.getElementById('salesRefresh').disabled=true;
    editor.querySelectorAll('button,input').forEach(e=>e.disabled=true);
    status.textContent='Statistika işlənir…';
    try{await operation();status.textContent='Statistika yeniləndi.';}
    catch(error){status.textContent=error.message;}
    finally{busy=false;document.getElementById('salesRefresh').disabled=false;editor.querySelectorAll('input,button').forEach(e=>e.disabled=false);if(data?.initializedAt)checkTotal();}
  }
  function render(){
    editor.replaceChildren();
    const distributed=Number(data.distributed)||0;
    editor.append(el('p',`Tarixi ümumi: 10.000 · Bölüşdürülüb: ${number.format(distributed)} · Qalıq: ${number.format(10000-distributed)}`));
    editor.append(el('p',`Initialization: ${data.initializedAt?new Intl.DateTimeFormat('az-AZ',{timeZone:'Asia/Baku',dateStyle:'medium',timeStyle:'short'}).format(new Date(data.initializedAt)):'Hələ yaradılmayıb'} · Versiya: ${data.version}`));
    editor.append(el('p',`Saytda real tamamlanmış: ${number.format(data.realTotal)} · Ümumi: ${number.format(data.total)}`));
    if(!data.initializedAt){
      const init=el('button','10.000 tarixi sifarişi bölüşdür','btn primary');init.type='button';
      init.addEventListener('click',()=>{
        if(busy || !confirm('10.000 tarixi satış bir dəfə canonical məhsullar arasında çəkili bölüşdürüləcək. CapCut, Spotify və Netflix Şəxsi daha yüksək pay alacaq. Təsdiqləyirsiniz?')) return;
        void run(async()=>{data=await api('/api/admin/product-sales/initialize',{method:'POST',body:JSON.stringify({confirm:true})});render();});
      });editor.append(init);return;
    }
    const table=el('div','','salesProductList');
    for(const product of data.products){
      const row=el('label','','salesProductRow');
      const name=el('span',`${product.title} (${product.productId})`);
      const input=document.createElement('input');input.type='number';input.min='0';input.step='1';input.value=product.historical;input.dataset.productId=product.productId;
      input.setAttribute('aria-label',`${product.title}: tarixi başlanğıc sayı`);
      const result=el('span',`Real: ${number.format(product.real)} · Görünən: ${number.format(product.total)}`);
      input.addEventListener('input',()=>{dirty=true;result.textContent=`Real: ${number.format(product.real)} · Görünən: ${number.format((Number(input.value)||0)+product.real)}`;checkTotal();});
      row.append(name,input,result);table.append(row);
    }
    editor.append(table);
    const diff=el('p','','salesSumStatus');diff.id='salesSumStatus';editor.append(diff);
    const save=el('button','Tarixi sayları yadda saxla','btn primary');save.type='button';save.id='salesSave';
    save.addEventListener('click',()=>{
      if(busy || !checkTotal())return;
      const items=[...editor.querySelectorAll('[data-product-id]')].map(e=>({product_id:e.dataset.productId,count:Number(e.value)}));
      void run(async()=>{data=await api('/api/admin/product-sales',{method:'PATCH',body:JSON.stringify({items,version:data.version})});dirty=false;render();});
    });editor.append(save);checkTotal();
  }
  function checkTotal(){
    const inputs=[...editor.querySelectorAll('[data-product-id]')], total=inputs.reduce((s,e)=>s+Number(e.value),0);
    const valid=total===10000 && inputs.every(e=>e.value!=='' && Number.isSafeInteger(Number(e.value)) && Number(e.value)>=0);
    const label=document.getElementById('salesSumStatus');if(label)label.textContent=valid?'Cəm: 10.000.':'Cəm dəqiq 10.000 olmalıdır. Fərq: '+number.format(10000-total);
    const save=document.getElementById('salesSave');if(save)save.disabled=busy || !valid;return valid;
  }
  document.getElementById('salesRefresh').addEventListener('click',load);
  window.addEventListener('mirpanel:product-catalog-loaded',load);
  if(typeof state!=='undefined' && state.data?.products && state.csrfToken)void load();
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
})();
