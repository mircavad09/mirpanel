const order=new Intl.Collator('az',{numeric:true,sensitivity:'base'});
export function sortStockRows(rows){return [...rows].sort((a,b)=>order.compare(a.email||'',b.email||'')||order.compare(a.room||a.plan||'',b.room||b.plan||'')||order.compare(a.id,b.id));}
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const key=r=>r.kind+':'+r.id;
export function createStockBrowser({search,renderRow}){
 const root=el('section','readyStockBrowser'),header=el('div','readyStockBrowserHeader'),title=el('h3','', 'Hazır stok');
 const label=el('label','readyStockSearch'),input=el('input'),clear=el('button','btn','Təmizlə');
 label.append(el('span','sr-only','Hazır və satılmış hesabları axtar'));input.type='search';input.placeholder='ID, sifariş, e-poçt, otaq, PIN və ya şifrə';input.autocomplete='off';input.spellcheck=false;input.maxLength=512;input.dataset.private='true';input.setAttribute('data-lpignore','true');label.append(input);clear.type='button';
 header.append(title,label,clear);const status=el('p','readyStockSearchStatus'),content=el('div','readyStockBrowserContent'),parking=el('div');parking.hidden=true;status.setAttribute('role','status');root.append(header,status,content,parking);
 const states=new Map(),inflight=new Map();let state,timer,expired=false;
 const anchor=()=>{const before=header.getBoundingClientRect().top;let scroller=root.parentElement;while(scroller&&getComputedStyle(scroller).overflowY!=='auto'&&getComputedStyle(scroller).overflowY!=='scroll')scroller=scroller.parentElement;return()=>requestAnimationFrame(()=>{const shift=header.getBoundingClientRect().top-before;if(scroller)scroller.scrollTop+=shift;else window.scrollBy(0,shift);});};
 function park(){for(const {node}of state.cache.values())if(node.isConnected)parking.append(node);}
 function record(row,compact){
  const id=key(row),snapshot=JSON.stringify(row),old=state.cache.get(id);
  if(old&&old.snapshot===snapshot){old.node.classList.toggle('is-archive',compact);return old.node;}
  if(old?.node.querySelector('form,dialog[open]'))return old.node;
  const node=el('article','readyStockRecord'+(compact?' is-archive':''));node.dataset.stockRecord=id;
  const heading=el('div','readyStockRecordHeading'),name=el('strong','',row.room?'Otaq '+row.room:row.email||'Hesab'),badge=el('span','readyStockRecordState',row.data?.statusLabel||(row.bucket==='sold'?'Satılıb / müştəriyə bağlı':row.bucket==='ready'?'Hazır':'Satışa hazır deyil'));
  heading.append(name,badge);const meta=el('p','readyStockRecordMeta',[row.plan,row.customerLabel,row.orderCode&&'Sifariş №'+row.orderCode].filter(Boolean).join(' · '));node.append(heading,meta);
  if(compact){const details=el('details','readyStockRecordOperations'),summary=el('summary','', 'İdarə et');details.append(summary);details.addEventListener('toggle',()=>{if(details.open&&!details.dataset.loaded){details.dataset.loaded='true';details.append(renderRow(row));}});node.append(details);}
  else node.append(renderRow(row));
  old?.node.remove();state.cache.set(id,{node,snapshot});return node;
 }
 function groups(rows,compact){
  const host=el('div','readyStockEmailGroups'),map=new Map();for(const row of sortStockRows(rows)){const email=(row.email||'E-poçtsuz hesablar').trim().toLowerCase();if(!map.has(email))map.set(email,[]);map.get(email).push(row);}
  let first=true;
  for(const [email,items]of map){const details=el('details','readyStockEmailGroup'),summary=el('summary'),body=el('div','readyStockEmailRows'),groupKey=(compact?'archive:':'ready:')+email;
   summary.append(el('strong','',items[0].email||'E-poçtsuz hesablar'),el('span','',items.length+' qeyd'));details.append(summary,body);
   details.open=state.q?true:state.open.has(groupKey)?state.open.get(groupKey):compact||first;first=false;
   const fill=()=>{if(details.open){body.replaceChildren(...items.map(row=>record(row,true)));}if(!state.q)state.open.set(groupKey,details.open);};
   details.addEventListener('toggle',()=>{if(details.isConnected)fill();});if(details.open)fill();host.append(details);
  }return host;
 }
 function pager(total,page,onPage){
  const pages=Math.max(1,Math.ceil(total/20)),nav=el('nav','readyStockPager');nav.setAttribute('aria-label','Hesab siyahısının səhifələri');
  for(const [delta,text]of[[-1,'Əvvəlki'],[1,'Növbəti']]){const b=el('button','btn',text);b.type='button';b.disabled=page+delta<1||page+delta>pages;b.onclick=()=>onPage(page+delta);nav.append(b);}
  nav.insertBefore(el('span','',page+' / '+pages+' · '+total+' qeyd'),nav.lastChild);return nav;
 }
 function draw(){
  if(!state||expired)return;const restore=anchor();park();content.replaceChildren();if(input.value!==state.q)input.value=state.q;clear.hidden=!state.q;
  if(state.q){
   status.textContent=state.error?'Axtarış alınmadı. Yenidən cəhd edin.':state.loading?'Axtarılır…':state.matches===null?'Axtarılır…':'';
   if(state.error){const retry=el('button','btn','Yenidən cəhd et');retry.type='button';retry.onclick=()=>void run(state);status.append(' ',retry);}
   if(state.loading||state.matches===null||state.error){restore();return;}
   const found=sortStockRows(state.rows.filter(r=>state.matches.has(key(r))));status.textContent=found.length?found.length+' hesab tapıldı':'Hesab tapılmadı';state.searchPage=Math.min(state.searchPage,Math.max(1,Math.ceil(found.length/20)));
   if(found.length){content.append(groups(found.slice((state.searchPage-1)*20,state.searchPage*20),true),pager(found.length,state.searchPage,p=>{state.searchPage=p;draw();}));}restore();return;
  }
  status.textContent='';const ready=state.rows.filter(r=>r.bucket==='ready'),sold=state.rows.filter(r=>r.bucket==='sold'),other=state.rows.filter(r=>r.bucket==='other');
  content.append(ready.length?groups(ready,false):el('p','', 'Satışa hazır hesab yoxdur.'));
  const archive=el('details','readyStockArchive'),summary=el('summary','', 'Satılan və müştəriyə bağlanan hesablar · '+sold.length),body=el('div');archive.append(summary,body);archive.open=state.archiveOpen;
  const fill=()=>{state.archiveOpen=archive.open;if(!archive.open)return;state.page=Math.min(state.page,Math.max(1,Math.ceil(sold.length/20)));body.replaceChildren(groups(sortStockRows(sold).slice((state.page-1)*20,state.page*20),true),pager(sold.length,state.page,p=>{state.page=p;fill();}));};
  archive.addEventListener('toggle',()=>{if(archive.isConnected)fill();});if(archive.open)fill();content.append(archive);
  if(other.length){const details=el('details','readyStockOther');details.append(el('summary','', 'Satışa hazır olmayan hesablar · '+other.length));details.addEventListener('toggle',()=>{if(details.open&&!details.dataset.loaded){details.dataset.loaded='true';details.append(groups(other,false));}});content.append(details);}
  restore();
 }
 async function run(s){
  const q=s.q.trim(),revision=++s.revision;if(!q){s.matches=null;s.loading=false;s.error=false;if(state===s)draw();return;}
  s.loading=true;s.error=false;if(state===s)draw();const requestKey=s.productId+'\0'+q;
  let request=inflight.get(requestKey);if(!request){request=search(s.productId,q);inflight.set(requestKey,request);request.finally(()=>{if(inflight.get(requestKey)===request)inflight.delete(requestKey);}).catch(()=>{});}
  try{const result=await request;if(expired||revision!==s.revision||s.q.trim()!==q)return;s.matches=new Set(result.matches.map(key));}
  catch{if(revision!==s.revision)return;s.error=true;}
  finally{if(revision===s.revision){s.loading=false;if(state===s)draw();}}
 }
 input.oninput=()=>{if(!state)return;state.q=input.value;state.searchPage=1;state.matches=null;state.error=false;state.loading=!!state.q;++state.revision;clearTimeout(timer);draw();const s=state;timer=setTimeout(()=>void run(s),250);};
 clear.onclick=()=>{clearTimeout(timer);state.q='';state.matches=null;state.loading=false;state.error=false;++state.revision;draw();input.focus();};
 function reset(){expired=true;clearTimeout(timer);for(const s of states.values()){s.q='';s.matches=null;s.cache.clear();++s.revision;}inflight.clear();states.clear();root.replaceChildren();}
 for(const name of ['mirpanel:session-expired','mirpanel:admin-logout'])window.addEventListener(name,reset,{once:true});
 return {element:root,update(productId,rows){if(expired)return;let next=states.get(productId);if(!next){next={productId,q:'',rows:[],cache:new Map(),open:new Map(),archiveOpen:false,page:1,searchPage:1,matches:null,revision:0};states.set(productId,next);}const changed=JSON.stringify(next.rows)!==JSON.stringify(rows);if(state===next&&!changed)return;if(state)park();state=next;state.rows=rows;draw();if(changed&&state.q)void run(state);},clear:reset};
}
