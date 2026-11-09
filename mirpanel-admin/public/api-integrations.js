(() => {
  // Catalog presentation only: no supplier traffic, import, or price writes in stage one.
  const catalogFilters = document.getElementById('gameCatalogFilters');
  catalogFilters?.addEventListener('submit',event=>event.preventDefault());
  document.getElementById('gameCatalogIntegration')?.addEventListener('click',()=>{
    document.querySelector('.navBtn[data-view="apiIntegrations"]')?.click();
  });
  const url = '/api/admin/api-integrations';
  const $ = id => document.getElementById(id);
  const mapping = $('mappingForm');
  if (!mapping) return;
  const defaults = Object.fromEntries(new FormData(mapping));
  let draftId = '', loading;
  const field = (form,name) => form.elements.namedItem(name);
  const select = (element,items) => {
    const previous = element.value;
    element.replaceChildren(new Option(element.name==='supplierId' ? 'Yeni təchizatçı' : 'Seçin',''),...items.map(([value,label])=>new Option(label,value)));
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
    const product = data?.products.find(p=>p.id===field(mapping,'productId').value);
    select(field(mapping,'plan'),(product?.plans||[]).map(p=>[p.key,p.label]));
  }
  function existing() {
    const product = data?.products.find(p=>p.id===field(mapping,'productId').value);
    const plan = product?.plans.find(p=>p.key===field(mapping,'plan').value);
    $('checkoutFields').textContent = (plan?.fields||[]).map(({key,label})=>label+' → customer.'+key).join(' · ');
    const match = data?.mappings.find(m=>m.product_id===field(mapping,'productId').value &&
      m.plan_key===field(mapping,'plan').value);
    if (match) {
      for (const [name,value] of Object.entries(match.settings)) {
        field(mapping,name).value=name==='fields' ? JSON.stringify(value,null,2) : value;
      }
      field(mapping,'supplierId').value=match.supplier_id;
    }
    $('integrationState').textContent=match?.active ? 'Aktiv' : match ? 'Deaktiv' : '';
    $('integrationDisable').hidden=!match?.active;
    toggleSupplier();
  }
  function toggleSupplier() {
    $('integrationNewSupplier').hidden=Boolean(field(mapping,'supplierId').value);
    $('integrationTest').hidden=!field(mapping,'supplierId').value;
  }
  const states = {queued:'Növbədə',checking:'Təchizatçıdan cavab gözlənilir',
    succeeded:'Təchizatçı təsdiqlədi',delivered:'Təhvil tamamlandı',failed:'Uğursuz',skipped:'Göndərilmədi'};
  function renderDrafts() {
    select($('integrationDrafts'),data.drafts.map(d=>[d.id,
      [d.details.name || 'Təchizatçı',d.details.productId,d.reason].filter(Boolean).join(' · ')]));
    $('integrationDrafts').value=draftId;
  }
  async function refresh() {
    data = await request(url);
    select(field(mapping,'supplierId'),data.suppliers.map(p=>[p.id,p.name]));
    renderDrafts();
    select(field(mapping,'productId'),data.products.map(p=>[p.id,p.title]));
    plans();
    existing();
    $('jobs').replaceChildren(...data.jobs.map(job=>{
      const li=document.createElement('li');
      li.textContent=[job.order_code,'Məhsul '+(job.line_index+1),states[job.state],job.external_id].filter(Boolean).join(' · ');
      return li;
    }));

  }
  function submit(form,fn) {
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if (!data || !csrf) { notice('Bölmə hələ yüklənir.'); return; }
      const button=event.submitter;
      button.disabled=true;
      notice('Sorğu işlənir…');
      try { await fn(Object.fromEntries(new FormData(form))); }
      catch (error) { notice(error instanceof SyntaxError ? 'Sahələrin JSON formatını yoxlayın.' : error.message); }
      finally { button.disabled=false; }
    });
  }
  submit(mapping,async ({supplierId,name,base,key,testPath,productId,plan,...settings})=>{
    for (const k of ['success','failure']) settings[k]=settings[k].split(',').map(x=>x.trim()).filter(Boolean);
    const result=await request(url,{action:'activate',draftId,supplierId,name,base,key,testPath,productId,plan,settings});
    field(mapping,'key').value='';
    if (!result.ok) {
      draftId=result.draftId;
      const saved=await request(url);
      data.drafts=saved.drafts;
      renderDrafts();
      notice('Qaralama saxlandı. '+result.reason);
      return;
    }
    draftId='';
    await refresh();
    notice('Bağlantı uğurludur. İnteqrasiya aktivdir.');
  });
  field(mapping,'productId').addEventListener('change',()=>{plans();existing();});
  field(mapping,'plan').addEventListener('change',existing);
  field(mapping,'supplierId').addEventListener('change',toggleSupplier);
  $('integrationDrafts').addEventListener('change',()=>{
    draftId=$('integrationDrafts').value;
    const saved=data.drafts.find(d=>d.id===draftId);
    const details=saved?.details || {};
    mapping.reset();
    $('integrationDrafts').value=draftId;
    for(const name of ['supplierId','name','base','testPath','productId']) field(mapping,name).value=details[name]||'';
    plans();
    field(mapping,'plan').value=details.plan||'';
    existing();
    if(saved) {
      field(mapping,'supplierId').value=details.supplierId||'';
      for(const name of ['serviceId','orderPath','statusPath','fields','idField','statusField','success','failure']) {
        const value=details.settings?.[name] ?? defaults[name] ?? '';
        field(mapping,name).value=typeof value==='object'&&!Array.isArray(value)?JSON.stringify(value,null,2):value;
      }
    }
    toggleSupplier();
    notice(saved ? 'Qaralama. '+saved.reason : '');
  });
  $('integrationTest').addEventListener('click',async ()=>{
    const button=$('integrationTest');
    button.disabled=true;
    try {
      const {ok}=await request(url,{action:'test',supplierId:field(mapping,'supplierId').value});
      notice(ok ? 'Bağlantı uğurludur.' : 'Bağlantı alınmadı. Ünvanı, yoxlama yolunu və giriş açarını yoxlayın.');
    } catch(error) { notice(error.message); }
    finally { button.disabled=false; }
  });
  $('integrationDisable').addEventListener('click',async ()=>{
    const match=data.mappings.find(m=>m.product_id===field(mapping,'productId').value &&
      m.plan_key===field(mapping,'plan').value);
    if(!match)return;
    const button=$('integrationDisable');
    button.disabled=true;
    try {
      await request(url,{action:'map',supplierId:match.supplier_id,productId:match.product_id,
        plan:match.plan_key,active:false,settings:match.settings});
      await refresh();
      notice('İnteqrasiya deaktiv edildi.');
    } catch(error) { notice(error.message); }
    finally { button.disabled=false; }
  });
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
  const epinbyForm=$('epinbyForm');
  const epinbyFeedback=$('epinbyFeedback');
  const epinbyLabels={
    confirmed:'Bağlantı təsdiqləndi',invalid_key:'Açar qəbul edilmədi',
    network_error:'Şəbəkə xətası',timeout:'Cavab gecikdi',
    invalid_response:'Cavab formatı düzgün deyil',unavailable:'Xidmət əlçatan deyil'
  };
  const at=value=>value?new Date(value).toLocaleString('az-AZ',{timeZone:'Asia/Baku'}):'Yoxlanılmayıb';
  function renderEpinby(connection){
    const badge=document.querySelector('.gameCatalogStatus');
    if(badge)badge.textContent=connection.lastStatus==='confirmed'?'Epinby · Bağlantı təsdiqləndi'
      :connection.lastStatus==='invalid_key'?'Epinby · Açar qəbul edilmədi'
      :connection.apiKeySaved?'Epinby · Bağlantı yoxlanılmayıb':'API bağlantısı qurulmayıb';
    for(const [name,saved] of [['apiKey',connection.apiKeySaved],['webhookSecret',connection.webhookSecretSaved]]){
      field(epinbyForm,name).placeholder=saved?'•••••••• (saxlanılıb)':'Daxil edin';
    }
    const rows=[
      ['Son yoxlama cəhdi',at(connection.lastAttemptAt)],
      ['Son cəhdin nəticəsi',epinbyLabels[connection.lastAttemptStatus]||'Yoxlanılmayıb'],
      ['Son təsdiqlənmiş yoxlama',at(connection.lastCheckedAt)],
      ['Son məlum status',epinbyLabels[connection.lastStatus]||'Yoxlanılmayıb']
    ];
    if(connection.balance!==null)rows.push(['Son məlum təchizatçı balansı',connection.balance+' '+connection.currency]);
    $('epinbyStatus').replaceChildren(...rows.flatMap(([label,value])=>{
      const dt=document.createElement('dt'),dd=document.createElement('dd');
      dt.textContent=label;dd.textContent=value;return [dt,dd];
    }));
  }
  async function epinbyAction(action){
    if(!csrf)return;
    const controls=[...epinbyForm.querySelectorAll('input,button')];
    const credentials=action==='epinby-save'
      ? Object.fromEntries(new FormData(epinbyForm)) : {};
    if(action==='epinby-test'&&[...epinbyForm.querySelectorAll('input')].some(input=>input.value)){
      epinbyFeedback.textContent='Yeni açarları əvvəl yadda saxlayın.';
      return;
    }
    controls.forEach(control=>{control.disabled=true;});
    epinbyFeedback.textContent=action==='epinby-test'?'Bağlantı yoxlanılır…':'';
    try{
      const connection=await request(url,{action,...credentials});
      renderEpinby(connection);
      epinbyFeedback.textContent=connection.message||(action==='epinby-save'?'Məlumatlar saxlanıldı.':'');
    }catch(error){epinbyFeedback.textContent=error.message;}
    finally{
      if(action==='epinby-save')epinbyForm.reset();
      controls.forEach(control=>{control.disabled=false;});
    }
  }
  epinbyForm.addEventListener('submit',event=>{event.preventDefault();void epinbyAction('epinby-save');});
  $('epinbyTest').addEventListener('click',()=>void epinbyAction('epinby-test'));
  function open() {
    if (data || loading) return;
    loading=request('/api/session').then(session=>{
      csrf=session.csrfToken;
      return Promise.all([refresh(),epinbyAction('epinby-read')]);
    }).catch(error=>notice(error.message)).finally(()=>{loading=null;});
  }
  window.addEventListener('admin-community-view',event=>{
    if(['apiIntegrations','gameProducts'].includes(event.detail)) open();
  });
  if(['#apiIntegrations','#gameProducts'].includes(location.hash)) open();
})();
