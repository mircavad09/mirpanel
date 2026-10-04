(() => {
  const MAX=20*1024*1024;
  let mounted=null, banners=[], loading=false;
  const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const jobs=new Map();
  async function refresh() {
    const result=await api('/api/admin/homepage-banners');
    if(result.maxBytes!==MAX) throw new Error('Banner ölçü konfiqurasiyası uyğun deyil.');
    banners=result.banners.sort((a,b)=>a.order-b.order || a.id.localeCompare(b.id)); render();
  }
  function render() {
    mounted.querySelector('[data-banner-list]').innerHTML=banners.map((b,index)=>`<article class="homepageBannerCard" data-banner-id="${esc(b.id)}">
      <img src="${esc(b.image)}" alt="${esc(b.title)}"><div class="homepageBannerControls">
      <strong>Banner ${index+1}</strong><input data-banner-order type="hidden" value="${b.order}">
      <label><input data-banner-active type="checkbox" ${b.active?'checked':''}> Aktiv</label>
      <button class="btn" data-banner-up ${index===0?'disabled':''}>↑ Yuxarı</button><button class="btn" data-banner-down ${index===banners.length-1?'disabled':''}>↓ Aşağı</button>
      <button class="btn" data-banner-replace>Şəkli dəyiş</button><button class="btn danger" data-banner-delete>Sil</button>
      <a class="btn" href="https://mirpanel.com/#heroSlider" target="_blank" rel="noopener noreferrer">Ana səhifədə bax</a>
      <p data-banner-status role="status">${b.active?'Yayımlandı':'Deaktivdir — ana səhifədə görünmür'}</p>
      <details><summary>Əlavə seçimlər</summary><label>Keçid ünvanı (istəyə bağlı)<input data-banner-url type="url" value="${esc(b.url)}" placeholder="https://..."></label></details>
      </div></article>`).join('') || '<p>Aktiv və ya deaktiv banner yoxdur.</p>';
  }
  function upload(url,file,onProgress) {
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest(); xhr.open('PUT',url); xhr.timeout=180000; xhr.setRequestHeader('x-upsert','true');
      xhr.upload.onprogress=event=>{if(event.lengthComputable) onProgress(Math.round(event.loaded/event.total*100));};
      xhr.onload=()=>xhr.status>=200 && xhr.status<300 ? resolve() : reject(Object.assign(new Error(`Storage şəkli qəbul etmədi (${xhr.status}).`),{status:xhr.status}));
      xhr.onerror=()=>reject(new Error('Bağlantı kəsildi. Şəkil seçimi qorunub.'));
      xhr.ontimeout=()=>reject(new Error('Yükləmə vaxtı bitdi. Şəkil seçimi qorunub.'));
      const ext=file.name.split('.').at(-1).toLowerCase();
      const mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';
      const body=new FormData(); body.append('cacheControl','3600'); body.append('',new File([file],file.name,{type:mime})); xhr.send(body);
    });
  }
  async function run(job) {
    if(job.busy) return; job.busy=true;
    const node=job.node, status=node.querySelector('[data-job-status]'), retry=node.querySelector('button'); retry.hidden=true;
    try {
      status.textContent='Upload hazırlanır…';
      const prepared=await api('/api/admin/homepage-banners/uploads',{method:'POST',body:JSON.stringify({operationId:job.id,targetId:job.targetId,fileName:job.file.name,size:job.file.size})});
      if(!prepared.completed) {
        status.textContent='Şəkil yüklənir…';
        await upload(prepared.signedUrl,job.file,percent=>{status.textContent=percent===100?'Ötürülmə tamamlandı. Server yoxlayır…':`Şəkil yüklənir… ${percent}%`;});
        await api(`/api/admin/homepage-banners/uploads/${job.id}/complete`,{method:'POST',body:'{}'});
      }
      status.textContent='Banner uğurla yükləndi və yayımlandı.';
      job.done=true; jobs.delete(job.id); URL.revokeObjectURL(job.preview);
      mounted.querySelector('[data-banner-message]').textContent=status.textContent;
      node.remove();
      await refresh().catch(()=>{mounted.querySelector('[data-banner-message]').textContent='Banner yayımlandı. Siyahını yeniləmək üçün səhifəni yeniləyin.';});
    } catch(error) {
      status.textContent=error.message || 'Şəkil yüklənmədi.'; retry.hidden=false;
    } finally {job.busy=false;}
  }
  async function select(file,targetId) {
    if(!file) return;
    if(!/\.(jpe?g|png|webp)$/i.test(file.name) || (file.type && !['image/jpeg','image/png','image/webp'].includes(file.type))) return toast('Yalnız JPG, PNG və WebP şəkli seçin.','bad');
    if(file.size>MAX) return toast('Şəkil maksimum 20 MiB ola bilər.','bad');
    if([...jobs.values()].some(job=>job.targetId===targetId && !job.done)) return toast('Əvvəlki şəkil upload-unu tamamlayın.','bad');
    const preview=URL.createObjectURL(file), image=new Image(); image.src=preview;
    try {await image.decode();} catch {URL.revokeObjectURL(preview); return toast('Şəkil zədələnib və açıla bilmir.','bad');}
    const node=document.createElement('div'); node.className='homepageBannerJob';
    node.innerHTML=`<img src="${esc(preview)}" alt="Seçilmiş şəkil"><div><strong>${esc(file.name)}</strong><small>${(file.size/1024/1024).toFixed(1)} MB · ${image.naturalWidth}×${image.naturalHeight}</small><p data-job-status role="status"></p><button class="btn primary" hidden>Yenidən cəhd et</button></div>`;
    mounted.querySelector('[data-banner-jobs]').appendChild(node);
    const job={id:crypto.randomUUID(),file,targetId,preview,node}; jobs.set(job.id,job);
    node.querySelector('button').onclick=()=>run(job); await run(job);
  }
  function pick(targetId) {
    const input=mounted.querySelector('[data-banner-file]'); input.value='';
    input.onchange=()=>select(input.files?.[0],targetId); input.click();
  }
  function mount(host) {
    if(mounted===host) return; mounted=host;
    host.innerHTML='<button class="btn primary homepageBannerAdd" data-banner-add>+ Şəkil əlavə et</button><input data-banner-file type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden><p>JPG, PNG və WebP · maksimum 20 MiB · 4K (3840×2160) dəstəklənir.</p><p data-banner-message role="status"></p><div data-banner-jobs></div><div data-banner-list></div>';
    host.addEventListener('click',async event=>{
      if(event.target.closest('[data-banner-add]')) return pick();
      const row=event.target.closest('[data-banner-id]'), b=banners.find(b=>b.id===row?.dataset.bannerId); if(!b) return;
      if(event.target.closest('[data-banner-up], [data-banner-down]')) {
        if(loading) return; const index=banners.indexOf(b), next=index+(event.target.closest('[data-banner-up]')?-1:1);
        if(next<0 || next>=banners.length) return;
        const ordered=[...banners]; [ordered[index],ordered[next]]=[ordered[next],ordered[index]];
        loading=true; host.querySelectorAll('[data-banner-list] button, [data-banner-list] input').forEach(el=>el.disabled=true);
        row.querySelector('[data-banner-status]').textContent='Sıra yenilənir…';
        try {await api('/api/admin/homepage-banners/reorder',{method:'POST',body:JSON.stringify({items:ordered.map(i=>({id:i.id,version:i.version}))})}); await refresh();}
        catch(error) {render(); mounted.querySelector('[data-banner-message]').textContent=error.message;}
        finally {loading=false;} return;
      }
      if(event.target.closest('[data-banner-replace]')) return pick(b.id);
      if(event.target.closest('[data-banner-delete]') && confirm('Bu banner silinsin?')) {
        event.target.disabled=true;
        try {await api(`/api/admin/homepage-banners/${b.id}`,{method:'DELETE',body:JSON.stringify({version:b.version})}); await refresh();} catch(error) {toast(error.message,'bad'); event.target.disabled=false;}
      }
    });
    host.addEventListener('change',async event=>{
      if(!event.target.matches('[data-banner-active], [data-banner-url]')) return;
      const row=event.target.closest('[data-banner-id]'), b=banners.find(b=>b.id===row.dataset.bannerId); if(!b || loading) return;
      loading=true; row.querySelectorAll('input,button').forEach(el=>el.disabled=true);
      row.querySelector('[data-banner-status]').textContent='Yadda saxlanır…';
      try {await api(`/api/admin/homepage-banners/${b.id}`,{method:'PATCH',body:JSON.stringify({order:b.order,active:row.querySelector('[data-banner-active]').checked,url:row.querySelector('[data-banner-url]').value.trim(),version:b.version})}); await refresh();}
      catch(error) {toast(error.message,'bad'); render();} finally {loading=false;}
    });
    refresh().catch(error=>{host.querySelector('[data-banner-message]').textContent=error.message;});
  }
  window.addEventListener('beforeunload',event=>{if([...jobs.values()].some(job=>!job.done)){event.preventDefault(); event.returnValue='';}});
  window.MirpanelHomepageBanners={mount};
})();
