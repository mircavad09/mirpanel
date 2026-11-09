(() => {
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
  const catalogCards=new Map();
  let catalogPending=false, catalogConnected=false, catalogLoaded=false,catalogGames=[],categoryRun=0;
  const norm=value=>String(value||'').toLocaleLowerCase('az').normalize('NFC').trim();
  function filterCatalog(){
    const {search,game,category}=Object.fromEntries(new FormData(catalogFilters));
    const query=norm(search);let count=0;
    for(const {card,item} of catalogCards.values()){
      card.hidden=Boolean((game&&game!==item.game)||(category&&category!==item.category)||
        (query&&!norm([item.game,item.name,item.package].join(' ')).includes(query)));
      if(!card.hidden)count++;
    }
    if(catalogLoaded){
      $('gameCatalogEmptyTitle').textContent=catalogCards.size?'Bu seçimə uyğun paket tapılmadı.':'Epinby kataloqunda paket yoxdur.';
      $('gameCatalogEmptyTitle').parentElement.hidden=count>0;
      $('gameCatalogHint').textContent=count+' paket · Alış müvəqqəti bağlıdır.';
    }
  }
  catalogFilters?.addEventListener('input',filterCatalog);
  catalogFilters?.addEventListener('reset',()=>queueMicrotask(filterCatalog));
  field(catalogFilters,'game').addEventListener('change',async()=>{
    const run=++categoryRun,game=catalogGames.find(g=>g.name===field(catalogFilters,'game').value);
    if(!game)return;
    try{
      const result=await request(url+'?view=epinby-categories&gameId='+game.id);
      if(run!==categoryRun)return;
      if(result.error)throw Error(result.error);
      for(const {item,card} of catalogCards.values()){
        if(item.game!==game.name||item.image)continue;
        const image=result.categories.find(c=>c.id===item.categoryId||c.name===item.category)?.image;
        if(image){item.image=image;const img=card.querySelector('img');img.hidden=false;img.src=image;}
      }
      const select=field(catalogFilters,'category'),current=select.value;
      select.replaceChildren(new Option('Bütün kateqoriyalar',''),...result.categories.map(c=>new Option(c.name,c.name)));
      select.disabled=!result.categories.length;
      if(result.categories.some(c=>c.name===current))select.value=current;
      filterCatalog();
    }catch(error){if(run===categoryRun)$('gameCatalogHint').textContent=error.message;}
  });
  async function addPackage(item,card){
    const price=card.querySelector('[data-sale-price]'), picker=card.querySelector('[data-product-file]');
    const button=card.querySelector('[data-game-add]'), file=picker.files[0];
    if(!price.reportValidity()||button.disabled||!catalogConnected)return;
    if(!state.data){toast('MirPanel kataloqu hələ yüklənir.','bad');return;}
    if(state.dirty){toast('Əvvəl mövcud qaralamanı yayımlayın və ya bağlayın.','bad');return;}
    const id='epinby_'+item.id;
    if(state.data.products.some(p=>p.id===id)){toast('Bu paket artıq MirPanel kataloqundadır.','bad');return;}
    if(!item.image&&!file){picker.setCustomValidity('Məhsul üçün şəkil seçin.');picker.reportValidity();picker.setCustomValidity('');return;}
    button.disabled=true;
    try{
      let image=item.image;
      if(file){
        if(!productImageUpload.allowedTypes.has(file.type)||file.size>productImageUpload.maxSize)throw Error('JPG, PNG və ya WebP (ən çox 5 MB) seçin.');
        const uploaded=await api('/api/upload-product-image',{method:'POST',body:JSON.stringify({
          productId:id,fileName:file.name,mimeType:file.type,contentBase64:await readFileAsBase64(file)
        })});
        if(!uploaded.ok||!uploaded.staged||!uploaded.path)throw Error('Şəkil saxlanılmadı.');
        image=uploaded.path;
      }
      if(state.dirty||state.data.products.some(p=>p.id===id))throw Error('Kataloq dəyişdi. Yenidən yoxlayın.');
      const category='epinby-games';
      if(!state.data.categories.some(c=>c.key===category))state.data.categories.push({key:category,name:'Oyun məhsulları'});
      state.data.products.push(ensureProduct({id,title:item.name,category,image,currency:'₼',
        seoSlug:id,order:nextProductOrder(),active:true,soldOut:true,flow:'out_of_stock',stockEnabled:false,
        availabilityText:'Alış hələ açılmayıb',plans:[{label:item.package||item.name,price:Number(price.value)}]}));
      markDirty();renderAll();
      toast('Paket qaralamaya əlavə edildi. Canlıya çıxarmaq üçün yayımı təsdiqləyin.','good');
      $('saveBtn').click();
    }catch(error){toast(error.message,'bad');}
    finally{button.disabled=false;}
  }
  function showCatalog(products,currency){
    const previous=new Map(catalogCards);catalogCards.clear();
    const list=$('gameCatalogProducts');
    for(const item of products){
      const old=previous.get(item.id);
      const card=old?.card||$('gameCatalogProductTemplate').content.firstElementChild.cloneNode(true);
      const put=(selector,value)=>{card.querySelector(selector).textContent=value||'';};
      put('[data-game-name]',[item.game,item.category].filter(Boolean).join(' · '));put('[data-product-name]',item.name);
      put('[data-product-package]',item.package);put('[data-supplier-price]',item.price);put('[data-supplier-currency]',currency);
      put('[data-stock]',item.stockStatus==='UNLIMITED'?'Mövcuddur · limitsiz':item.stockCount===0||item.stockStatus==='OUT_OF_STOCK'?'Stokda yoxdur':
        item.stockCount>0?'Mövcuddur · '+item.stockCount+' ədəd':'Mövcudluq məlum deyil');
      const image=card.querySelector('img');image.hidden=!item.image;
      image.onerror=()=>{image.hidden=true;const entry=catalogCards.get(item.id);if(entry?.item===item)item.image=null;};
      if(item.image)image.src=item.image;else image.removeAttribute('src');
      const saved=state.data?.products.find(p=>p.id==='epinby_'+item.id),button=card.querySelector('[data-game-add]');
      if(saved)card.querySelector('[data-sale-price]').value=saved.plans[0]?.price??'';
      button.textContent=saved?'Kataloqda var':'Sayta əlavə et';button.disabled=!!saved;
      button.onclick=()=>void addPackage(item,card);
      catalogCards.set(item.id,{item,card});list.append(card);previous.delete(item.id);
    }
    for(const {card} of previous.values())card.remove();
    for(const [name,label] of [['game','Bütün oyunlar'],['category','Bütün kateqoriyalar']]){
      const select=field(catalogFilters,name),current=select.value;
      const values=[...new Set(products.map(p=>p[name]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'az'));
      select.replaceChildren(new Option(label,''),...values.map(v=>new Option(v,v)));select.disabled=!values.length;
      if(values.includes(current))select.value=current;
    }
    filterCatalog();
  }
  async function loadGameCatalog(){
    if(!catalogFilters||catalogPending)return;
    catalogPending=true;
    $('gameCatalogRefresh').disabled=true;$('gameCatalogHint').textContent='Kataloq yüklənir…';
    try{
      const result=await request(url+'?view=epinby-catalog');
      const connection=result.connection;catalogGames=result.games||[];categoryRun++;
      catalogConnected=connection.lastStatus==='confirmed'&&!result.error;
      $('gameCatalogStatus').textContent=connection.lastStatus==='confirmed'?'Bağlantı təsdiqləndi':connection.apiKeySaved?'Bağlantını yoxlayın':'API bağlantısı qurulmayıb';
      if(result.error)throw Error(result.error);
      catalogLoaded=catalogConnected;
      showCatalog(result.products,connection.currency);
      if(!catalogConnected){$('gameCatalogEmptyTitle').parentElement.hidden=false;$('gameCatalogEmptyTitle').textContent='Məhsulları görmək üçün Epinby API bağlantısını qurun';$('gameCatalogHint').textContent='';}
    }catch(error){
      catalogConnected=false;
      $('gameCatalogHint').textContent=error.message;
      if(!catalogCards.size)$('gameCatalogEmptyTitle').textContent='Kataloq yüklənmədi';
    }finally{catalogPending=false;$('gameCatalogRefresh').disabled=false;}
  }
  $('gameCatalogRefresh')?.addEventListener('click',()=>void loadGameCatalog());
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
    const badge=$('gameCatalogStatus');
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
    if(event.detail==='apiIntegrations')open();
    if(event.detail==='gameProducts')void loadGameCatalog();
  });
  if(location.hash==='#apiIntegrations')open();
})();
