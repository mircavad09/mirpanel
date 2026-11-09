(() => {
  const url = '/api/admin/api-integrations';
  const $ = id => document.getElementById(id);
  const supplier = $('supplierForm'), test = $('testForm'), mapping = $('mappingForm');
  const field = (form,name) => form.elements.namedItem(name);
  const select = (element,items) => {
    const previous = element.value;
    element.replaceChildren(new Option('Seçin',''),...items.map(([value,label])=>new Option(label,value)));
    if (items.some(([value])=>value===previous)) element.value=previous;
  };
  const notice = message => { $('notice').textContent=message; };
  let data, csrf;
  async function request(path,body) {
    const response = await fetch(path,{
      cache:'no-store',
      ...(body ? {method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},
        body:JSON.stringify(body)} : {})
    });
    if (response.status===401) throw Error('Sessiya bitib. Yenidən daxil olun.');
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Sorğu tamamlanmadı.');
    return result;
  }
  function plans() {
    const product = data.products.find(p=>p.id===field(mapping,'productId').value);
    select(field(mapping,'plan'),(product?.plans||[]).map(p=>[p.key,p.label]));
  }
  function existing() {
    const product = data.products.find(p=>p.id===field(mapping,'productId').value);
    const plan = product?.plans.find(p=>p.key===field(mapping,'plan').value);
    $('checkoutFields').textContent = (plan?.fields||[]).map(({key,label})=>label+' → customer.'+key).join(' · ');
    const match = data.mappings.find(m=>m.product_id===field(mapping,'productId').value &&
      m.plan_key===field(mapping,'plan').value);
    if (match) {
      for (const [name,value] of Object.entries(match.settings)) {
        field(mapping,name).value=name==='fields' ? JSON.stringify(value,null,2) : value;
      }
      field(mapping,'supplierId').value=match.supplier_id;
    }
    field(mapping,'active').checked=match?.active===true;
  }
  const states = {queued:'Növbədə',checking:'Təchizatçıdan cavab gözlənilir',
    succeeded:'Təchizatçı təsdiqlədi',delivered:'Təhvil tamamlandı',failed:'Uğursuz',skipped:'Göndərilmədi'};
  async function refresh() {
    data = await request(url);
    select(field(supplier,'base'),data.origins.map(origin=>[origin,origin]));
    const providers = data.suppliers.map(p=>[p.id,p.name]);
    select(field(test,'supplierId'),providers);
    select(field(mapping,'supplierId'),providers);
    select(field(mapping,'productId'),data.products.map(p=>[p.id,p.title]));
    plans();
    existing();
    $('jobs').replaceChildren(...data.jobs.map(job=>{
      const li=document.createElement('li');
      li.textContent=[job.order_code,'Məhsul '+(job.line_index+1),states[job.state],job.external_id].filter(Boolean).join(' · ');
      return li;
    }));
    if (!data.origins.length) notice('Serverdə təsdiqlənmiş təchizatçı ünvanı yoxdur.');
  }
  function submit(form,fn) {
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=event.submitter;
      button.disabled=true;
      notice('Sorğu işlənir…');
      try { await fn(Object.fromEntries(new FormData(form))); }
      catch (error) { notice(error instanceof SyntaxError ? 'Sahələrin JSON formatını yoxlayın.' : error.message); }
      finally { button.disabled=false; }
    });
  }
  submit(supplier,async values=>{
    await request(url,{...values,action:'add'});
    supplier.reset();
    await refresh();
    notice('Təchizatçı saxlandı.');
  });
  submit(test,async values=>{
    const {ok}=await request(url,{...values,action:'test'});
    notice(ok ? 'Bağlantı uğurludur.' : 'Bağlantı alınmadı. Ünvanı, yoxlama yolunu və giriş açarını yoxlayın.');
  });
  submit(mapping,async ({supplierId,productId,plan,active,...settings})=>{
    settings.fields=JSON.parse(settings.fields);
    for (const key of ['success','failure']) settings[key]=settings[key].split(',').map(x=>x.trim()).filter(Boolean);
    await request(url,{action:'map',supplierId,productId,plan,active:active==='on',settings});
    await refresh();
    notice('Məhsul bağlaması saxlandı.');
  });
  field(mapping,'productId').addEventListener('change',()=>{plans();existing();});
  field(mapping,'plan').addEventListener('change',existing);
  $('refresh').addEventListener('click',()=>refresh().catch(error=>notice(error.message)));

  let operations=[];
  $('openapi').addEventListener('change',async event=>{
    operations=[];
    select($('operations'),[]);
    const [file]=event.target.files;
    if (!file) return;
    try {
      if (file.size>2000000) throw Error();
      const spec=JSON.parse(await file.text());
      if (!String(spec.openapi).startsWith('3.') || !spec.paths) throw Error();
      operations=Object.entries(spec.paths).flatMap(([path,item])=>
        ['get','post'].filter(method=>item?.[method]).map(method=>({path,method}))).slice(0,300);
      select($('operations'),operations.map(({method,path},index)=>[String(index),method.toUpperCase()+' '+path]));
      notice('Sifariş və status yollarını sənəddən seçin.');
    } catch { notice('OpenAPI 3 JSON sənədini yoxlayın.'); }
  });
  $('operations').addEventListener('change',event=>{
    if (!event.target.value) return;
    const {path,method}=operations[Number(event.target.value)];
    field(mapping,method==='post' ? 'orderPath' : 'statusPath').value=path;
  });
  request('/api/session').then(session=>{
    csrf=session.csrfToken;
    return refresh();
  }).catch(error=>notice(error.message));
})();
