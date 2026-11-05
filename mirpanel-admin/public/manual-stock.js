(()=>{'use strict';
const admin=document.body.dataset.manualRole==='admin',base=admin?'/api/admin/workforce/manual-stock':'/api/employee/manual-stock',app=document.getElementById('stockApp'),status=document.getElementById('status'),life=new AbortController();let csrf='',account,state,source,productId='',planId='',currentAllocation=null,busy=false,tab='catalog',filter='',events=null,refreshing=false,refreshNeeded=false;
const el=(t,text,cls)=>{const n=document.createElement(t);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;},btn=(text,fn,cls='')=>{const b=el('button',text,cls);b.type='button';b.onclick=()=>act(b,fn);return b;},date=v=>new Date(v).toLocaleString('az-AZ',{timeZone:'Asia/Baku',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),panel=title=>{const n=el('section',null,'panel');if(title)n.append(el('h2',title));return n;};
let adminReauth=false;
async function api(p,b,key){if(admin&&b!==undefined&&adminReauth){csrf=(await api('/api/session')).csrfToken;adminReauth=false;}const r=await fetch(p.startsWith('/api/')?p:base+p,{method:b===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:b===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf,'X-Idempotency-Key':key||crypto.randomUUID()},body:b===undefined?undefined:JSON.stringify(b),signal:AbortSignal.any([life.signal,AbortSignal.timeout(25000)])});let d;try{d=await r.json();}catch{throw Error('Cavab təsdiqlənmədi. Eyni əməliyyatı yenidən sınayın.');}if(!r.ok){if(r.status===401){if(admin){adminReauth=true;throw Object.assign(Error('Sessiya bitib. Yazdıqlarınız saxlanılır. Yenidən daxil olub bu formada təkrar sınayın.'),{reauth:true});}showExpired();}throw Error(d.error||'Sorğu tamamlanmadı. Yenidən cəhd edin.');}return d;}
async function act(b,fn){if(busy)return;busy=true;b.disabled=true;status.textContent='';try{await fn();}catch(e){status.textContent=e.name==='TimeoutError'?'Cavab gecikdi. Eyni əməliyyatı təhlükəsiz təkrar sınayın.':e.message;if(e.reauth){const a=el('a',' Admin girişini aç');a.href='/login.html';a.target='_blank';a.rel='noopener';status.append(a);}}finally{busy=false;if(b.isConnected)b.disabled=false;if(refreshNeeded)void refreshWorker();}}
const pendingKey=()=> 'mirpanel.manual-stock.pending.'+account.id,readPending=()=>{try{return JSON.parse(localStorage.getItem(pendingKey())||'null');}catch{return null;}},savePending=v=>{try{localStorage.setItem(pendingKey(),JSON.stringify(v));}catch{}},clearPending=()=>{try{localStorage.removeItem(pendingKey());}catch{}};
function history(){const h=panel('◷ Son götürülənlər');h.classList.add('history');if(!state.history.length)h.append(el('p','Hələ götürülən hesab yoxdur.','muted'));for(const a of state.history){const b=btn('',async()=>showMessage(await api('/allocation?id='+a.id)));const d=el('div');d.append(el('strong',a.product_name+' · '+a.plan_name),el('small',date(a.created_at)+(admin?' · '+a.employee_name:'')));b.append(d,el('span',a.recalled_at?'Geri çağırılıb':'›',a.recalled_at?'recalled':''));h.append(b);}return h;}
function products(){currentAllocation=null;if(!state.products.some(p=>p.id===productId)){const only=state.products.length===1?state.products[0]:null;productId=only?.id||'';planId=only?.plans.find(p=>Number(p.available)>0)?.id||only?.plans[0]?.id||'';}const layout=el('div',null,'stock-layout'),left=panel(),right=el('div');left.append(el('h1','⬡ Hesab stoku'),el('p','Məhsulu və paketi seçin.','muted'));const search=el('input');search.type='search';search.placeholder='Məhsul axtar';search.setAttribute('aria-label','Məhsul axtar');search.value=filter;const grid=el('div',null,'products'),plans=el('div');
function draw(){grid.replaceChildren();for(const p of state.products.filter(p=>p.name.toLocaleLowerCase('az').includes(filter.toLocaleLowerCase('az')))){const n=p.plans.reduce((sum,x)=>sum+Number(x.available),0),b=btn('',async()=>{productId=p.id;planId=p.plans.find(x=>Number(x.available)>0)?.id||p.plans[0]?.id||'';draw();drawPlans();});b.className='product';b.setAttribute('aria-pressed',String(productId===p.id));if(p.image){const img=el('img');img.src=p.image;img.alt='';b.append(img);}else b.append(el('span','◇','product-icon'));const d=el('div');d.append(el('strong',p.name),el('span',n+' hesab','count'+(n?'':' zero')));b.append(d);grid.append(b);}if(!grid.children.length)grid.append(el('p','İcazəli məhsul tapılmadı.','muted'));}
function drawPlans(){plans.replaceChildren();const p=state.products.find(x=>x.id===productId);if(!p)return;plans.append(el('h2','◇ Paket seçin'));for(const pl of p.plans){const b=btn(pl.name,async()=>{planId=pl.id;drawPlans();});b.className='plan';b.setAttribute('aria-pressed',String(pl.id===planId));b.append(el('small',pl.available+' hesab'));plans.append(b);}const pl=p.plans.find(x=>x.id===planId);if(!pl)return;plans.append(el('p',Number(pl.available)>0?'Stokda: '+pl.available+' hesab':'Stokda yoxdur','stock-count'));const take=btn('⬡ Stokdan al',async()=>{const old=readPending(),key=old?.planId===pl.id?old.key:crypto.randomUUID();if(old?.allocationId){showMessage(await api('/allocation?id='+old.allocationId));return;}savePending({planId:pl.id,key});const a=await api('/claim',{planId:pl.id},key);savePending({planId:pl.id,key,allocationId:a.id});state=await api('/state');showMessage(a);},'gold wide');take.disabled=Number(pl.available)===0;plans.append(take);}
search.oninput=()=>{filter=search.value;draw();};left.append(search,grid,plans);right.append(history(),btn('Siyahını yenilə',async()=>{state=await api('/state');products();},'wide'));draw();drawPlans();layout.append(left,right);app.replaceChildren(layout);}
function showMessage(a){workerTab='accounts';workerNav();currentAllocation=a;const layout=el('div',null,'stock-layout'),box=panel('▤ Hazır mesaj');box.append(el('p',a.product+' · '+a.plan,'muted'),el('p',a.recalled?'Bu götürmə admin tərəfindən geri çağırılıb. Məlumatları müştəriyə göndərməyin.':'✓ Hesab sizə ayrıldı','success'),el('p','Qalan stok: '+a.remaining+' hesab','count'));const message=readableText(a.recalled?'Məlumatları göstərmək üçün adminlə əlaqə saxlayın.':a.message);box.append(message);const copy=btn('▣ Mesajı kopyala',async()=>{if(a.recalled)return;try{await navigator.clipboard.writeText(a.message);status.textContent='Hazır mesaj kopyalandı.';}catch{status.textContent='Kopyalama alınmadı. Mətni seçib kopyalayın.';}},'gold wide');copy.disabled=a.recalled;box.append(copy);if(!a.recalled)box.append(...internalBlocks(a));box.append(btn('← Məhsullara qayıt',async()=>{if(!admin)await api('/acknowledge',{id:a.id});clearPending();a.message='';message.replaceChildren();state=await api('/state');products();},'wide'),el('p','Mesajı müştəriyə özünüz göndərin. Kopyalama yeni hesab ayırmır.','secret-note'));layout.append(box,history());app.replaceChildren(layout);}
function instructionUrl(id){return base+'/instruction-image?'+new URLSearchParams({id,v:Date.now()});}
function instructionPreview(src){
 const box=el('div'),trigger=btn('',async()=>{const image=el('img'),tools=el('div',null,'row instruction-tools');image.src=src;image.alt='İşçi təlimatı';const zoom=btn('2× böyüt',async()=>{const on=image.classList.toggle('zoomed');zoom.textContent=on?'Kiçilt':'2× böyüt';});tools.append(zoom,btn('Bağla',async()=>dialog.close()));dialog.replaceChildren(tools,image);dialog.showModal();},'instruction-preview');
 const img=el('img'),dialog=el('dialog',null,'instruction-dialog');img.src=src;img.alt='Təlimat şəklini böyüt';trigger.setAttribute('aria-label',img.alt);trigger.append(img);box.append(trigger,dialog);return box;
}
function imageInput(container,onChange){
 const input=field(container,'Təlimat şəkli (istəyə bağlı, maksimum 2 MB)','instructionImage','','file');input.accept='image/png,image/jpeg,image/webp';
 const preview=el('div'),remove=btn('Seçilən şəkli çıxar',async()=>{input.value='';input.onchange();});remove.hidden=true;container.append(preview,remove);let seq=0;
 input.onchange=()=>{const token=++seq,file=input.files[0];preview.replaceChildren();remove.hidden=true;input.instructionFile=null;
  if(!file){onChange();return;}if(file.size>2097152||!['image/png','image/jpeg','image/webp'].includes(file.type)){input.value='';status.textContent='PNG, JPG və ya WebP seçin (maksimum 2 MB).';onChange();return;}
  const reader=new FileReader();input.instructionFile=new Promise((resolve,reject)=>{reader.onload=()=>{const src=String(reader.result);if(token===seq&&input.isConnected){preview.replaceChildren(instructionPreview(src));remove.hidden=false;}resolve({data:src.split(',')[1],mime:file.type});};reader.onerror=()=>reject(Error('Şəkil oxunmadı.'));reader.readAsDataURL(file);});input.instructionFile.catch(()=>{if(token===seq)status.textContent='Şəkil oxunmadı.';});onChange();
 };return input;
}
const mobileText=matchMedia('(max-width: 720px)'),textViews=new Map();
const textResize=new ResizeObserver(entries=>{for(const {target} of entries)textViews.get(target)?.();});
new MutationObserver(()=>{for(const n of textViews.keys())if(!n.isConnected){textResize.unobserve(n);textViews.delete(n);}}).observe(app,{childList:true,subtree:true});
mobileText.addEventListener('change',()=>{for(const measure of textViews.values())measure();});
function linkText(node,value){
 let offset=0;
 for(const match of value.matchAll(/(?<![\p{L}\p{N}@:/])(?:https?:\/\/|www\.)[^\s<>"`]+/giu)){
  let shown=match[0].replace(/[.,!?;:]+$/u,'');
  const formatting=value.slice(0,match.index).match(/[*_~]+$/u)?.[0]||'';
  if(formatting&&shown.endsWith([...formatting].reverse().join('')))shown=shown.slice(0,-formatting.length);
  for(const [open,close] of [['(',')'],['[',']'],['{','}']])while(shown.endsWith(close)&&shown.split(close).length>shown.split(open).length)shown=shown.slice(0,-1);
  try{
   const url=new URL(/^www\./i.test(shown)?'https://'+shown:shown);
   if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)continue;
   const a=el('a',shown);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';
   node.append(document.createTextNode(value.slice(offset,match.index)),a);offset=match.index+shown.length;
  }catch{/* Unparseable addresses remain plain text. */}
 }
 node.append(document.createTextNode(value.slice(offset)));
}
function readableText(value,kind='message'){
 const box=el('div',null,'readable-text'),body=el('div',null,kind+' readable-content');body.id='worker-text-'+crypto.randomUUID();linkText(body,value);
 let expanded=false;const toggle=el('button','Davamını göstər','readable-toggle');toggle.type='button';toggle.hidden=true;toggle.setAttribute('aria-controls',body.id);toggle.setAttribute('aria-expanded','false');
 function measure(){
  const height=parseFloat(getComputedStyle(body).lineHeight)*5;const long=mobileText.matches&&height>0&&body.scrollHeight>height+1;
  toggle.hidden=!long;body.classList.toggle('text-folded',long&&!expanded);
  toggle.textContent=expanded?'Yığ':'Davamını göstər';toggle.setAttribute('aria-expanded',String(expanded));box.dataset.expanded=String(expanded);
  const bottom=body.getBoundingClientRect().top+height;
  for(const a of body.querySelectorAll('a')){const clipped=long&&!expanded&&[...a.getClientRects()].every(r=>r.top>=bottom-1);a.tabIndex=clipped?-1:0;}
 }
 toggle.onclick=()=>{expanded=!expanded;measure();};box.expandText=()=>{expanded=true;measure();};
 box.append(body,toggle);textViews.set(body,measure);textResize.observe(body);return box;
}
function internalBlocks(a){return [['2FA məlumatı',a.twoFactor,false],['İşçi təlimatı',a.instruction,a.hasInstructionImage]].filter(([,v,img])=>v||img).map(([label,value,img])=>{const n=el('section',null,'stock-account internal-data');n.append(el('h3',label),el('p','Yalnız işçi üçün','notice'));if(value)n.append(readableText(value));if(img)n.append(instructionPreview(instructionUrl(admin?a.unitId:a.id)));return n;});}
function editInstructionImage(a,reopen){
 const box=el('section',null,'stock-account'),input=imageInput(box,()=>{});box.append(btn('Şəkli yadda saxla',async()=>{if(!input.instructionFile)throw Error('Əvvəl şəkil seçin.');await api('/instruction-image',{id:a.unitId,file:await input.instructionFile});await reopen();status.textContent='Təlimat şəkli saxlanıldı.';}));
 if(a.hasInstructionImage)box.append(btn('Şəkli sil',async()=>{if(!confirm('Təlimat şəkli silinsin?'))return;await api('/instruction-image',{id:a.unitId,remove:true});await reopen();status.textContent='Təlimat şəkli silindi.';},'danger'));
 return box;
}
function field(form,label,name,value='',type='text'){const l=el('label',label),i=el(type==='textarea'?'textarea':'input');i.name=name;i.value=value??'';if(type!=='textarea')i.type=type;i.autocomplete='off';l.append(i);form.append(l);return i;}
function select(form,label,name,rows,value){const l=el('label',label),s=el('select');s.name=name;s.setAttribute('aria-label',label);for(const [id,t]of rows){const o=el('option',t);o.value=id;s.append(o);}s.value=value||rows[0]?.[0]||'';l.append(s);form.append(l);return s;}
function check(form,label,name,value=false){const l=el('label',null,'check'),i=el('input');i.type='checkbox';i.name=name;i.checked=value;l.append(i,document.createTextNode(label));form.append(l);return i;}
function formBox(title,endpoint,build,initial={}){const box=panel(title),f=el('form');build(f);const save=el('button','Yadda saxla','gold');save.type='submit';f.append(save);f.oninput=()=>delete f.dataset.request;f.onsubmit=e=>{e.preventDefault();void act(save,async()=>{const b={...initial,...Object.fromEntries(new FormData(f))};for(const c of f.querySelectorAll('[type=checkbox]'))b[c.name]=c.checked;const key=f.dataset.request||(f.dataset.request=crypto.randomUUID());await api(endpoint,b,key);f.reset();delete f.dataset.request;state=await api('/state');adminView();status.textContent='Saxlanıldı.';});};box.append(f);return{box,form:f};}
function intakeForm(){
 const box=panel('Hazır mesaj əlavə et'),f=el('form'),search=field(f,'Məhsul axtar','sourceSearch','','search');
 const ps=select(f,'Məhsul','sourceProduct',[]),pls=select(f,'Paket','sourcePlan',[]),editor=el('div');
 const rows=el('div'),save=el('button','Yadda saxla','gold wide'),add=btn('+ Yeni stok əlavə et',async()=>appendMessage());
 search.placeholder='CapCut, Netflix və ya başqa məhsul';save.type='submit';editor.append(rows,add,save);f.append(editor);
 let attempt;
 const option=(label,value)=>{const n=el('option',label);n.value=value;return n;};
 const messages=()=>[...rows.children].map(row=>({...Object.fromEntries([...row.querySelectorAll('textarea')].map(i=>[i.name,i.value])),image:row.querySelector('input[type=file]').instructionFile})).filter(v=>v.image||v.message.trim()||v.twoFactor.trim()||v.instruction.trim());
 function update(){editor.hidden=!pls.value;save.disabled=!messages().length;add.disabled=rows.children.length>=15;}
 function appendMessage(){if(rows.children.length>=15)return;const row=el('div',null,'stock-account');const input=field(row,'Hazır mesaj','message','','textarea');input.rows=5;input.maxLength=12000;input.placeholder='Müştəriyə göndərəcəyiniz tam mətni bura yapışdırın…';input.oninput=update;for(const [label,name,max] of [['2FA məlumatı (istəyə bağlı)','twoFactor',3000],['İşçi təlimatı (istəyə bağlı)','instruction',6000]]){const n=field(row,label,name,'','textarea');n.maxLength=max;n.rows=2;n.oninput=update;}imageInput(row,update);if(rows.children.length)row.append(btn('Sahəni sil',async()=>{row.remove();queueMicrotask(update);}));rows.append(row);update();}
 function drawPlans(){const p=source.products.find(p=>p.id===ps.value);pls.replaceChildren(option('Paket seçin',''),...(p?.plans||[]).map(pl=>option(pl.name,pl.key)));pls.disabled=!p;update();}
 function drawProducts(){const chosen=ps.value,results=source.products.filter(p=>p.name.toLocaleLowerCase('az').includes(search.value.trim().toLocaleLowerCase('az')));ps.replaceChildren(option(results.length?'Məhsul seçin':'Məhsul tapılmadı',''),...results.map(p=>option(p.name,p.id)));if(results.some(p=>p.id===chosen))ps.value=chosen;else drawPlans();}
 search.oninput=drawProducts;ps.onchange=drawPlans;pls.onchange=update;drawProducts();appendMessage();
 f.onsubmit=e=>{e.preventDefault();void act(save,async()=>{
  const body={productId:ps.value,planKey:pls.value,units:messages()};if(!body.productId||!body.planKey||!body.units.length)return;if(body.units.some(u=>!u.message.trim()))throw Error('Daxili məlumat olan hər vahid üçün hazır mesaj yazın.');
  const controls=[...f.querySelectorAll('input,select,textarea,button')].filter(n=>!n.disabled);controls.forEach(n=>n.disabled=true);
  try{body.units=await Promise.all(body.units.map(async u=>({...u,image:await u.image})));const payload=JSON.stringify(body);if(attempt?.payload!==payload)attempt={payload,key:crypto.randomUUID()};const r=await api('/ready-message',body,attempt.key);rows.replaceChildren();appendMessage();attempt=null;status.textContent=r.saved+' hazır mesaj stoka əlavə edildi.';try{state=await api('/state');}catch{/* Write confirmed. */}}
  finally{controls.forEach(n=>n.disabled=false);setTimeout(update,0);}
 });};
 box.append(el('p','Hər saxlama seçilmiş paketə bir stok vahidi əlavə edir.','muted'),f);return box;
}
const baku=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function exactTime(value){return value?baku.format(new Date(value)).replaceAll('/','.'):'Məlumat yoxdur';}
function paged(box,fetchPage,render,empty){
 let page=0,seq=0;const list=el('div',null,'items');box.append(list);
 async function load(n=0){const token=++seq;list.replaceChildren(el('p','Yüklənir…','muted'));try{const r=await fetchPage(n);if(token!==seq||!list.isConnected)return;page=n;list.replaceChildren(...r.rows.map(render));if(!r.rows.length)list.append(el('p',empty,'muted'));if(page||r.more){const nav=el('div',null,'row');if(page)nav.append(btn('Əvvəlki',()=>load(page-1)));if(r.more)nav.append(btn('Növbəti',()=>load(page+1)));list.append(nav);}}catch(e){if(token===seq)list.replaceChildren(el('p',e.message),btn('Yenidən cəhd et',()=>load(n)));}}
 return load;
}
function stockRecords(){
 const box=panel('Stok qeydləri');
 if(!state.products.length)box.append(el('p','Hələ stok qeydi yoxdur.','muted'));
 for(const p of state.products){const product=el('details',null,'stock-account');product.append(el('summary',p.name));box.append(product);
  for(const pl of p.plans){const plan=el('details',null,'stock-account'),title=el('summary',pl.name+' · Mövcud stok: '+pl.available);plan.append(title);product.append(plan);
   const load=paged(plan,async page=>{const r=await api('/units?planId='+pl.id+'&page='+page);return{rows:r.units,more:r.more};},u=>{
    const row=el('div',null,'stock-account'),label=({AVAILABLE:'Mövcuddur',TAKEN:'Götürülüb',QUARANTINED:'Karantində',DISABLED:'Bağlı'})[u.state]||u.state;
    row.append(el('strong',label),el('p','#'+u.id.slice(0,8)+' · '+exactTime(u.taken_at||u.created_at),'muted'));
    const secret=el('div',null,'message');secret.hidden=true;
    async function reveal(){const r=await api('/record?id='+u.id);if(!plan.open||!product.open||document.hidden)return;secret.replaceChildren(el('div',r.message??'Hazır mesaj mətni qeydə alınmayıb.'),...internalBlocks(r),editInstructionImage(r,reveal));secret.hidden=false;open.textContent='Mesajı gizlət';}
    const open=btn('Mesajı aç',async()=>{if(!secret.hidden){secret.hidden=true;secret.replaceChildren();open.textContent='Mesajı aç';return;}await reveal();});
    secret.classList.add('private-record');row.append(open,secret);
    if(u.state==='AVAILABLE')row.append(btn('Stoku bağla',async()=>{if(!confirm('Bu stok vahidi bağlansın?'))return;await api('/unit-disable',{id:u.id});state=await api('/state');title.textContent=pl.name+' · Mövcud stok: '+(state.products.find(x=>x.id===p.id)?.plans.find(x=>x.id===pl.id)?.available??0);await load();}));
    return row;
   },'Bu paketdə stok qeydi yoxdur.');
   plan.ontoggle=()=>{if(plan.open)void load();else clearPrivateRecords(plan);};
  }
  product.ontoggle=()=>{if(!product.open)clearPrivateRecords(product);};
 }
 return box;
}
function clearPrivateRecords(root){for(const n of root.querySelectorAll('.private-record')){n.hidden=true;n.textContent='';if(n.previousElementSibling)n.previousElementSibling.textContent='Mesajı aç';}}
function accessRecords(a){const d=el('details',null,'stock-account');d.append(el('summary','Giriş tarixçəsi'));const load=paged(d,async page=>{const r=await api('/access-history?id='+a.id+'&page='+page);return{rows:r.events,more:r.more};},x=>el('p',({login:'Uğurlu giriş',logout:'İşçi özü çıxdı',expired:'Sessiyanın müddəti bitdi'})[x.action]+' · '+exactTime(x.created_at)),'Məlumat yoxdur');d.append(el('p','Yalnız qeydə alınmış hadisələr göstərilir. Qeydə alınmayan hadisələr: Məlumat yoxdur.','muted'));d.ontoggle=()=>{if(d.open)void load();};return d;}
function claimRecords(){
 const box=panel('Götürmə tarixçəsi'),filters=el('div',null,'form-grid');
 const emp=select(filters,'İşçiyə görə süz','employee',[['','Bütün işçilər'],...state.accounts.map(a=>[a.id,a.name])]),prod=select(filters,'Məhsula görə süz','product',[['','Bütün məhsullar'],...state.products.map(p=>[p.id,p.name])]);box.append(filters);
 const load=paged(box,async page=>{const r=await api('/claims?'+new URLSearchParams({page,employee:emp.value,product:prod.value}));return{rows:r.entries,more:r.more};},a=>{const row=el('div',null,'stock-account');row.append(el('strong',(state.accounts.find(x=>x.id===a.employee_id)?.name||'Məlumat yoxdur')+' · '+a.product_name+' · '+a.plan_name),el('p',exactTime(a.created_at),'muted'));if(!a.recalled_at)row.append(btn('Geri çağır',async()=>{if(!confirm('Hesab artıq müştəriyə verilmiş ola bilər. Karantinə keçirilsin?'))return;await api('/recall',{id:a.id,confirmed:true});await load();},'danger'));else row.append(el('p','Geri çağırılıb','muted'));return row;},'Hələ götürmə yoxdur');
 emp.onchange=prod.onchange=()=>void load();queueMicrotask(()=>void load());return box;
}
let workerTab='accounts',problemProduct='',workerTabs;
function workerNav(){
 if(admin)return;
 if(!workerTabs){workerTabs=el('nav');workerTabs.setAttribute('aria-label','İşçi paneli');app.before(workerTabs);}
 workerTabs.replaceChildren();
 for(const [id,label] of [['accounts','Hesablar'],['problems','Problemlər']]){
  const b=btn(label,async()=>{if(id===workerTab)return;workerTab=id;currentAllocation=null;workerNav();if(id==='problems')app.replaceChildren(problemPanel(false));else{const pending=readPending();if(pending?.allocationId)showMessage(await api('/allocation?id='+pending.allocationId));else products();}});
  b.setAttribute('aria-pressed',String(id===workerTab));workerTabs.append(b);
 }
}
function problemPanel(owner){
 const box=panel('Məhsul problemləri'),catalog=owner?source.products:state.products;
 let form,editing=null,attempt;
 const picker=el('div',null,'row problem-products');box.append(picker);
 if(!catalog.some(p=>p.id===problemProduct))problemProduct=catalog[0]?.id||'';
 if(owner){
  form=el('form',null,'stock-account');form.hidden=!problemProduct;
  const title=field(form,'Problem başlığı','title'),image=field(form,'Şəkil (PNG, JPG, WebP — 5 MB)','image','','file'),explanation=field(form,'İşçiyə izah','explanation','','textarea'),answer=field(form,'Müştəriyə cavab','answer','','textarea');
  title.required=explanation.required=answer.required=true;title.maxLength=160;explanation.maxLength=answer.maxLength=6000;image.accept='image/png,image/jpeg,image/webp';
  const submit=el('button','Problemi saxla','gold');submit.type='submit';form.append(submit,btn('Yeni problem',async()=>reset()));box.append(form);
  function reset(){form.reset();editing=null;attempt=null;submit.textContent='Problemi saxla';}
  form.resetEditor=reset;form.edit=x=>{reset();editing=x.id;title.value=x.title;explanation.value=x.explanation;answer.value=x.answer;submit.textContent='Dəyişiklikləri saxla';title.focus();};
  form.oninput=()=>attempt=null;
  form.onsubmit=e=>{e.preventDefault();void act(submit,async()=>{const file=image.files[0];if(!file&&!editing)throw Error('Problem üçün şəkil seçin.');if(file?.size>5242880)throw Error('Şəkil maksimum 5 MB ola bilər.');const controls=[title,image,explanation,answer];controls.forEach(n=>n.disabled=true);try{let data;if(file){const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Şəkil oxunmadı.'));reader.readAsDataURL(file);});data=url.split(',')[1];}attempt||=crypto.randomUUID();await api('/problem-save',{id:editing,product:problemProduct,title:title.value,explanation:explanation.value,answer:answer.value,image:data,mime:file?.type},attempt);reset();status.textContent='Problem saxlanıldı.';await load();}finally{controls.forEach(n=>n.disabled=false);}});};
 }
 const load=paged(box,async page=>{if(!problemProduct)return{rows:[],more:false};const r=await api('/problems?'+new URLSearchParams({product:problemProduct,page}));return{rows:r.entries,more:r.more};},x=>{
  const row=el('article',null,'stock-account'),img=el('img',null,'problem-image');img.loading='lazy';img.alt=x.title;img.src=base+'/problem-image?'+new URLSearchParams({product:problemProduct,id:x.id,v:Date.now()});
  const title=el('h3');linkText(title,x.title);
  row.append(title,img,el('strong','İşçiyə izah'),readableText(x.explanation,'problem-text'),el('strong','Müştəriyə cavab'),readableText(x.answer,'problem-text'));
  if(owner)row.append(btn('Redaktə et',async()=>form.edit(x)),btn('Problemi sil',async()=>{if(!confirm('Problem qeydi silinsin?'))return;await api('/problem-delete',{id:x.id,product:problemProduct,confirmed:true});form.resetEditor();await load();},'danger'));
  else row.append(btn('Cavabı kopyala',async()=>{await navigator.clipboard.writeText(x.answer);status.textContent='Müştəriyə cavab kopyalandı.';}));
  return row;
 },catalog.length?'Bu məhsul üçün problem qeydi yoxdur.':'İcazəli məhsul tapılmadı.');
 function draw(){picker.replaceChildren(...catalog.map(p=>{const b=btn(p.name,async()=>{problemProduct=p.id;form?.resetEditor();draw();await load();});b.setAttribute('aria-pressed',String(p.id===problemProduct));return b;}));}
 draw();queueMicrotask(()=>void load());return box;
}
function adminView(){app.replaceChildren();const tabs=document.getElementById('tabs');tabs.replaceChildren();for(const [id,label]of [['catalog','Stok və mesaj əlavə et'],['units','Hesablar'],['accounts','İşçi girişləri'],['history','Götürmələr'],['problems','Problemlər'],['audit','Audit']]){const b=btn(label,async()=>{if(id==='units'||id==='accounts'||id==='history')state=await api('/state');tab=id;await adminView();});b.setAttribute('aria-pressed',String(tab===id));tabs.append(b);}
 if(tab==='catalog'){
  app.append(intakeForm());
 }else if(tab==='units'){
  app.append(stockRecords());
 }else if(tab==='accounts'){
  app.append(formBox('İşçi girişi yarat','/accounts',f=>{field(f,'Ad','name').required=true;field(f,'Giriş adı','login').required=true;const p=field(f,'Şifrə (12–200 simvol)','password','','password');p.minLength=12;p.maxLength=200;p.required=true;}).box);
  const list=panel('Girişlər və məhsul icazələri');for(const a of state.accounts.filter(a=>!a.archivedAt)){const row=panel(a.name+' · '+a.login);row.append(el('p',a.active?'Giriş aktivdir':'Giriş bağlıdır','muted'),btn(a.active?'Girişi bağla':'Girişi aç',async()=>{await api('/account-control',{id:a.id,action:a.active?'disable':'enable'});state=await api('/state');adminView();}),btn('Bütün sessiyaları bağla',async()=>{await api('/account-control',{id:a.id,action:'revoke'});status.textContent='Sessiyalar bağlandı.';}));for(const p of state.products){const label=el('label',null,'check'),c=el('input');c.type='checkbox';c.checked=state.permissions.some(x=>x.employee_id===a.id&&x.product_id===p.id);c.onchange=()=>void act(c,async()=>{try{await api('/permission',{employeeId:a.id,productId:p.id,allowed:c.checked});}catch(e){c.checked=!c.checked;throw e;}});label.append(c,document.createTextNode(p.name));row.append(label);}row.append(btn('İşçini sil',async()=>{if(!confirm(a.name+' ('+a.login+') siyahıdan çıxarılsın? Giriş bağlanacaq, tarixçə qalacaq.'))return;await api('/account-archive',{id:a.id,confirmed:true});state=await api('/state');adminView();status.textContent='İşçi siyahıdan çıxarıldı.';},'danger'),accessRecords(a));list.append(row);}app.append(list);const archived=state.accounts.filter(a=>a.archivedAt);if(archived.length){const archive=el('details',null,'stock-account');archive.append(el('summary','Arxivlənmiş işçilərin tarixçəsi'));for(const a of archived){const row=panel(a.name+' · '+a.login);row.append(accessRecords(a));archive.append(row);}app.append(archive);}
 }else if(tab==='problems'){
  app.append(problemPanel(true));
 }else if(tab==='history'){
  app.append(claimRecords());
 }else{const box=panel('Moderasiya deyil — işçi stokunun audit tarixçəsi');app.append(box);void api('/audit').then(r=>{for(const a of r.events)box.append(el('p',date(a.created_at)+' · '+a.actor+' · '+a.action));}).catch(e=>status.textContent=e.message);}
}
function editSubmit(f,path,initial){return e=>{e.preventDefault();const b=f.querySelector('button[type=submit]');void act(b,async()=>{const data={...initial,...Object.fromEntries(new FormData(f))};for(const c of f.querySelectorAll('[type=checkbox]'))data[c.name]=c.checked;const key=f.dataset.request||(f.dataset.request=crypto.randomUUID());await api(path,data,key);f.reset();state=await api('/state');adminView();status.textContent='Yadda saxlanıldı.';});};}
function showExpired(){events?.close();events=null;currentAllocation=null;workerTabs?.replaceChildren();app.replaceChildren(el('p','Sessiya bitib. Yenidən daxil olun.'));const a=el('a','Yenidən daxil ol');a.href='/employee/stock/login';app.append(a);}
async function refreshWorker(){if(admin||document.hidden||life.signal.aborted)return;if(busy||refreshing){refreshNeeded=true;return;}refreshing=true;refreshNeeded=false;try{const next=await api('/state'),changed=JSON.stringify(next)!==JSON.stringify(state);state=next;if(changed&&workerTab==='problems'){app.replaceChildren(problemPanel(false));}else if(changed&&!currentAllocation){const focus=app.querySelector('input[type=search]')===document.activeElement,pos=document.activeElement?.selectionStart;products();if(focus){const search=app.querySelector('input[type=search]');search?.focus();search?.setSelectionRange(pos,pos);}}}catch(e){status.textContent=e.message;}finally{refreshing=false;if(refreshNeeded&&!busy)void refreshWorker();}}
function connect(){if(admin||events||document.hidden||life.signal.aborted)return;const stream=events=new EventSource(base+'/events');stream.addEventListener('changed',()=>void refreshWorker());stream.addEventListener('expired',showExpired);stream.addEventListener('error',()=>{if(stream.readyState===EventSource.CLOSED&&events===stream){events=null;void refreshWorker();}});}
async function start(){try{const s=await api(admin?'/api/session':'/api/employee/session');csrf=s.csrfToken;account=s.account||{id:'owner'};if(!admin){document.getElementById('workerName').textContent=account.name;document.getElementById('logout').onclick=()=>void act(document.getElementById('logout'),async()=>{await api('/api/employee/logout',{});events?.close();events=null;clearPending();currentAllocation=null;app.replaceChildren();location.assign('/employee/stock/login');});}if(admin){[state,source]=await Promise.all([api('/state'),api('/source-catalog')]);adminView();}else{state=await api('/state');workerNav();const pending=readPending();if(pending?.allocationId)showMessage(await api('/allocation?id='+pending.allocationId));else if(pending?.key){const a=await api('/claim',{planId:pending.planId},pending.key);savePending({...pending,allocationId:a.id});showMessage(a);}else products();connect();}}catch(e){status.textContent=e.message;app.replaceChildren(btn('Yenidən cəhd et',start));}}
let resumeLink=null;
app.addEventListener('click',e=>{if(!admin&&currentAllocation&&e.target.closest('.readable-content a')){const record={id:currentAllocation.id,y:scrollY,expanded:[...app.querySelectorAll('.readable-text')].map(n=>n.dataset.expanded==='true'),left:false};resumeLink=record;setTimeout(()=>{if(resumeLink===record&&!record.left)resumeLink=null;},10000);}});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&currentAllocation){
  if(resumeLink?.id===currentAllocation.id)resumeLink.left=true;
  currentAllocation.message='';currentAllocation.twoFactor='';currentAllocation.instruction='';for(const n of app.querySelectorAll('.internal-data'))n.remove();
  const n=app.querySelector('.readable-text');if(n)n.replaceChildren(el('p','Məxfi mesaj gizlədildi. Yenidən açmaq üçün aşağıdakı düyməyə basın.'));
  const c=app.querySelector('.gold');if(c){c.textContent='Hazır mesajı yenidən aç';c.onclick=()=>void act(c,async()=>showMessage(await api('/allocation?id='+currentAllocation.id)));}
 }else if(!document.hidden&&resumeLink?.left){
  const saved=resumeLink;resumeLink=null;const c=app.querySelector('.gold');
  if(c&&currentAllocation?.id===saved.id)void act(c,async()=>{const a=await api('/allocation?id='+saved.id);if(document.hidden||currentAllocation?.id!==saved.id)return;showMessage(a);[...app.querySelectorAll('.readable-text')].forEach((n,i)=>{if(saved.expanded[i])n.expandText();});requestAnimationFrame(()=>scrollTo(0,saved.y));});
 }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){events?.close();events=null;if(admin)clearPrivateRecords(app);}else if(!admin){connect();void refreshWorker();}});
window.addEventListener('pagehide',()=>{life.abort();events?.close();events=null;currentAllocation=null;for(const n of document.querySelectorAll('textarea,input[type=password]'))n.value='';app.replaceChildren();});void start();
})();
