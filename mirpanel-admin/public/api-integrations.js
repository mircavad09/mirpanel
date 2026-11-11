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
  let catalogPending=false, catalogConnected=false, catalogLoaded=false,catalogGames=[],categoryRun=0,catalogRun=0,catalogPage=0,catalogLast=1,catalogTotal=0,searchRun=0,searchTimer;
  const norm=value=>String(value||'').toLocaleLowerCase('az').normalize('NFC').trim();
  function filterCatalog(){
    const {search,game,category}=Object.fromEntries(new FormData(catalogFilters));
    const query=norm(search);let count=0;
    for(const {card,item} of catalogCards.values()){
      card.hidden=Boolean((game&&Number(game)!==item.gameId)||(category&&Number(category)!==item.categoryId)||
        (query&&!norm([item.game,item.name,item.package].join(' ')).includes(query)));
      if(!card.hidden)count++;
    }
    if(catalogLoaded){
      $('gameCatalogEmptyTitle').textContent=catalogPage<catalogLast?'Yüklənmiş paketlərdə nəticə yoxdur. Digər səhifələri yükləyin.':'Bu seçimə uyğun paket tapılmadı.';
      $('gameCatalogEmptyTitle').parentElement.hidden=count>0;
      $('gameCatalogHint').textContent=count+' görünən · '+catalogCards.size+' / '+catalogTotal+' paket yüklənib'+(catalogPage<catalogLast?' · Kataloq natamamdır.':'');
    }
  }
  catalogFilters?.addEventListener('input',filterCatalog);
  // The provider has no documented product-name search. Extend the matching
  // game/category page by page, exposing partial results until the scan finishes.
  field(catalogFilters,'search').addEventListener('input',()=>{
    const run=++searchRun;clearTimeout(searchTimer);
    if(!norm(field(catalogFilters,'search').value))return;
    searchTimer=setTimeout(async()=>{
      while(run===searchRun&&catalogPage<catalogLast){
        if(await loadProductPage(catalogPage+1)!==true)break;
      }
    },250);
  });
  catalogFilters?.addEventListener('reset',()=>queueMicrotask(()=>{searchRun++;categoryRun++;field(catalogFilters,'category').replaceChildren(new Option('Bütün kateqoriyalar',''));void loadProductPage(1);}));
  const categoryRetry=document.createElement('button');categoryRetry.type='button';categoryRetry.className='btn';categoryRetry.textContent='Kateqoriyaları yenidən yoxla';categoryRetry.hidden=true;
  $('gameCatalogHint')?.after(categoryRetry);categoryRetry.onclick=()=>field(catalogFilters,'game').dispatchEvent(new Event('change'));
  field(catalogFilters,'game').addEventListener('change',async()=>{
    searchRun++;const run=++categoryRun,game=catalogGames.find(g=>g.id===Number(field(catalogFilters,'game').value));
    categoryRetry.hidden=true;
    const categories=field(catalogFilters,'category');categories.replaceChildren(new Option('Bütün kateqoriyalar',''));categories.disabled=true;
    void loadProductPage(1);
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
      select.replaceChildren(new Option('Bütün kateqoriyalar',''),...result.categories.map(c=>new Option(c.name,c.id)));
      select.disabled=!result.categories.length;
      if(result.categories.some(c=>String(c.id)===current))select.value=current;
      filterCatalog();
    }catch(error){if(run===categoryRun){$('gameCatalogHint').textContent=error.message;categoryRetry.hidden=false;}}
  });
  field(catalogFilters,'category').addEventListener('change',()=>{searchRun++;void loadProductPage(1);});
  const pubgImages={3436:'/uploads/products/epinby_3436-1794438474049-f9e16779.png',...Object.fromEntries([325,660,1800,3850,8100].map((uc,i)=>[3437+i,'/uploads/products/pubg-'+uc+'-uc.png']))};
  function packageLocation(id){
    const products=state.data?.products||[];
    for(const product of products.filter(p=>p.active!==false)){
      const plan=product.plans.find(p=>Number(p.supplier?.productId)===id);
      if(plan)return {product,plan,legacy:false};
    }
    const product=products.find(p=>p.active!==false&&p.id==='epinby_'+id&&p.plans.length===1);
    return product?{product,plan:product.plans[0],legacy:true}:null;
  }
  function chooseProduct(item,existing){
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='gameProductPicker';dialog.setAttribute('aria-label','Hansı məhsula əlavə edilsin?');
      dialog.innerHTML='<form method="dialog"><h3>Hansı məhsula əlavə edilsin?</h3><label>Məhsul axtar <input type="search" placeholder="Ad və ya məhsul kodu"></label><label>Kateqoriya <select data-category aria-label="Kateqoriya"></select></label><label>Məhsullar <select data-target aria-label="Məhsullar" size="6" required></select></label><div class="gameProductPickerActions"><button type="button" class="btn" data-cancel>Ləğv et</button><button class="btn primary" value="confirm">Təsdiqlə</button></div></form>';
      const categories=dialog.querySelector('[data-category]'),target=dialog.querySelector('[data-target]'),search=dialog.querySelector('input');
      const all=state.data.products.filter(p=>p.id!==existing?.product.id);
      const game=item.game||item.category, suggested=game?all.find(p=>p.active!==false&&norm(p.title)===norm(game)):null;
      categories.append(new Option('Bütün kateqoriyalar',''),...state.data.categories.map(c=>new Option(c.name,c.key)));
      let selected=suggested?.id||'';
      function draw(){
        const filtered=all.filter(p=>(!categories.value||p.category===categories.value)&&(!norm(search.value)||norm(p.title+' '+p.id).includes(norm(search.value))));
        target.replaceChildren(...filtered.map(p=>new Option(p.title+(p.active===false?' (passiv)':''),p.id)));
        if(game&&!suggested&&!categories.value&&(!norm(search.value)||norm(game).includes(norm(search.value))))target.append(new Option('Yeni məhsul yarat: '+game,'__new_game__'));
        target.value=selected;dialog.querySelector('button[value=confirm]').disabled=!target.value;
      }
      search.oninput=categories.onchange=draw;target.onchange=()=>{selected=target.value;draw();};
      dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
      dialog.addEventListener('close',()=>{const id=dialog.returnValue==='confirm'?target.value:null;dialog.remove();resolve(id);},{once:true});
      draw();document.body.append(dialog);dialog.showModal();
    });
  }
  async function addPackage(item,card){
    const price=card.querySelector('[data-sale-price]'), picker=card.querySelector('[data-product-file]');
    const button=card.querySelector('[data-game-add]'), file=picker.files[0];
    if(button.disabled||!catalogConnected)return;
    if(!state.data){toast('MirPanel kataloqu hələ yüklənir.','bad');return;}
    if(state.dirty){toast('Əvvəl mövcud qaralamanı yayımlayın və ya bağlayın.','bad');return;}
    const existing=packageLocation(item.id);
    if(existing&&!existing.legacy){toast('Bu paket artıq '+existing.product.title+' məhsulundadır.','bad');return;}
    if(!existing&&!price.reportValidity())return;
    let image=existing?.plan.image||existing?.product.image||pubgImages[item.id]||item.image;
    if(!image&&!file){picker.setCustomValidity('Paket üçün şəkil seçin.');picker.reportValidity();picker.setCustomValidity('');return;}
    const providerFields=item.fields||[];
    if(!existing?.product.supplier&&(!['TOPUP','VOUCHER'].includes(item.type)||providerFields.some(f=>!['player_id','server_id','input_2','input_3','input_4','input_5','input_6','input_7','input_8'].includes(f.key)))){toast('Bu məhsulun xüsusi sifariş sahələri hələ dəstəklənmir.','bad');return;}
    const expected=state.data;
    button.disabled=true;
    try{
      const targetId=await chooseProduct(item,existing);if(!targetId)return;
      const target=expected.products.find(p=>p.id===targetId);
      const title=item.game||item.category,groupId=slug(title);
      if(targetId==='__new_game__'&&(!groupId||expected.products.some(p=>p.id===groupId)))throw Error('Məhsulun adı artıq istifadə olunur. Siyahıdan mövcud məhsulu seçin.');
      if(!target&&targetId!=='__new_game__')throw Error('Məhsul tapılmadı.');
      if(target?.supplier)throw Error('Bu ayrıca Epinby kartıdır. Əsas məhsulu seçin.');
      const cents=existing?Number(existing.plan.price):Number(price.value);
      if(file){
        if(!productImageUpload.allowedTypes.has(file.type)||file.size>productImageUpload.maxSize)throw Error('JPG, PNG və ya WebP (ən çox 5 MB) seçin.');
        const uploaded=await api('/api/upload-product-image',{method:'POST',body:JSON.stringify({
          productId:'epinby_'+item.id,fileName:file.name,mimeType:file.type,contentBase64:await readFileAsBase64(file)
        })});
        if(!uploaded.ok||!uploaded.staged||!uploaded.path)throw Error('Şəkil saxlanılmadı.');
        image=uploaded.path;
      }
      const current=packageLocation(item.id);
      if(state.data!==expected||state.dirty||current?.product!==existing?.product)throw Error('Kataloq dəyişdi. Yenidən yoxlayın.');
      const category='epinby-games';
      if(!target&&!expected.categories.some(c=>c.key===category))expected.categories.push({key:category,name:'Oyun məhsulları'});
      const destination=target||ensureProduct({id:groupId,title,category,image,currency:'₼',seoSlug:groupId,order:nextProductOrder(),active:true,epinbyGroup:true,plans:[]});
      const supplier=existing?.product.supplier||{provider:'epinby',productId:item.id,type:item.type,gameId:item.gameId,categoryId:item.categoryId,fields:providerFields};
      destination.plans.push({...existing?.plan,id:'epinby_'+item.id,pricingId:existing?.plan.pricingId||crypto.randomUUID(),label:existing?.plan.label||item.package||item.name,price:cents,image,supplier});
      if(!target)expected.products.push(destination);
      if(existing){existing.product.active=false;existing.product.seoIndex=false;existing.product.includeInSitemap=false;}
      markDirty();renderAll();
      toast('Paket '+destination.title+' məhsuluna bağlandı. Canlıya çıxarmaq üçün yayımı təsdiqləyin.','good');
      $('saveBtn').click();
    }catch(error){toast(error.message,'bad');}
    finally{button.disabled=Boolean(packageLocation(item.id)&&!packageLocation(item.id).legacy);}
  }
  function showCatalog(products,currency,append=false){
    const previous=append?new Map():new Map(catalogCards);if(!append)catalogCards.clear();
    const list=$('gameCatalogProducts');
    for(const item of products){
      const old=previous.get(item.id)||catalogCards.get(item.id);
      const card=old?.card||$('gameCatalogProductTemplate').content.firstElementChild.cloneNode(true);
      const put=(selector,value)=>{card.querySelector(selector).textContent=value||'';};
      put('[data-game-name]',[item.game,item.category].filter(Boolean).join(' · '));put('[data-product-name]',item.name);
      put('[data-product-package]',item.package);put('[data-supplier-price]',item.price);put('[data-supplier-currency]',currency);
      put('[data-stock]',['UNLIMITED','INFINITE'].includes(item.stockStatus)?'Mövcuddur · limitsiz':item.stockCount===0||item.stockStatus==='OUT_OF_STOCK'?'Stokda yoxdur':
        item.stockCount>0?'Mövcuddur · '+item.stockCount+' ədəd':'Mövcudluq məlum deyil');
      const image=card.querySelector('img');image.hidden=!item.image;
      image.onerror=()=>{image.hidden=true;const entry=catalogCards.get(item.id);if(entry?.item===item)item.image=null;};
      if(item.image)image.src=item.image;else image.removeAttribute('src');
      const saved=packageLocation(item.id),button=card.querySelector('[data-game-add]'),picker=card.querySelector('[data-product-file]');
      const price=card.querySelector('[data-sale-price]'),thumb=card.querySelector('[data-package-preview]');
      const fallback=saved?.plan.image||saved?.product.image||pubgImages[item.id]||item.image;
      const preview=()=>{
        if(thumb.dataset.objectUrl)URL.revokeObjectURL(thumb.dataset.objectUrl);
        const file=picker.files[0],source=file?URL.createObjectURL(file):fallback;
        thumb.dataset.objectUrl=file?source:'';thumb.hidden=!source;
        if(source)thumb.src=/^(?:https?:|blob:)/i.test(source)?source:'https://mirpanel.com/'+source.replace(/^\/+/, '');else thumb.removeAttribute('src');
      };
      picker.onchange=preview;preview();
      if(saved)price.value=saved.plan.price??'';
      price.readOnly=!!saved;picker.disabled=!!saved&&!saved.legacy;
      button.textContent=saved&&!saved.legacy?'Kataloqda var · '+saved.product.title:saved?'Məhsula bağla':'Sayta əlavə et';button.disabled=!!saved&&!saved.legacy;
      button.onclick=()=>void addPackage(item,card);
      catalogCards.set(item.id,{item,card});list.append(card);previous.delete(item.id);
    }
    for(const {card} of previous.values()){const thumb=card.querySelector('[data-package-preview]');if(thumb.dataset.objectUrl)URL.revokeObjectURL(thumb.dataset.objectUrl);card.remove();}
    filterCatalog();
  }
  const more=document.createElement('button');more.type='button';more.className='btn';more.textContent='Daha çox paket yüklə';more.hidden=true;
  $('gameCatalogProducts')?.after(more);more.onclick=()=>void loadProductPage(catalogPage+1);
  async function loadProductPage(page){
    const run=++catalogRun,params=new URLSearchParams({view:'epinby-catalog',page,gameId:field(catalogFilters,'game').value,categoryId:field(catalogFilters,'category').value});
    more.disabled=true;$('gameCatalogHint').textContent='Paketlər yüklənir… Mövcud nəticələr saxlanılır.';
    try{
      const result=await request(url+'?'+params);if(run!==catalogRun)return false;
      if(result.error)throw Error(result.error);
      catalogPage=result.meta.page;catalogLast=result.meta.lastPage;catalogTotal=result.meta.total;catalogLoaded=true;
      showCatalog(result.products,result.connection.currency,page>1);more.hidden=catalogPage>=catalogLast;more.textContent='Daha çox paket yüklə';more.onclick=()=>void loadProductPage(catalogPage+1);
      return true;
    }catch(error){if(run===catalogRun){$('gameCatalogHint').textContent=error.message+' · Mövcud nəticələr natamam ola bilər.';more.hidden=false;more.textContent='Yenidən cəhd et';more.onclick=()=>void loadProductPage(page);}return false;}
    finally{if(run===catalogRun)more.disabled=false;}
  }
  async function loadGameCatalog(){
    if(!catalogFilters||catalogPending)return;
    catalogPending=true;
    $('gameCatalogRefresh').disabled=true;$('gameCatalogHint').textContent='Kataloq yüklənir…';
    try{
      const result=await request(url+'?view=epinby-catalog&gamesOnly=true');
      const connection=result.connection;catalogGames=result.games||[];categoryRun++;
      catalogConnected=connection.lastStatus==='confirmed'&&!result.error;
      $('gameCatalogStatus').textContent=connection.lastStatus==='confirmed'?'Bağlantı təsdiqləndi':connection.apiKeySaved?'Bağlantını yoxlayın':'API bağlantısı qurulmayıb';
      if(result.error)throw Error(result.error);
      catalogLoaded=catalogConnected;
      const games=field(catalogFilters,'game'),previous=games.value;
      games.replaceChildren(new Option('Bütün oyunlar',''),...catalogGames.map(g=>new Option(g.name,g.id)));games.value=previous;games.disabled=!catalogGames.length;
      if(catalogConnected)void loadProductPage(1);
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
      li.textContent=[job.order_code,'Məhsul '+(job.line_index+1),states[job.state],job.external_id,job.reason].filter(Boolean).join(' · ');
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
