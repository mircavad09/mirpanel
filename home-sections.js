/* Shared homepage grouping, also used by the static publisher. */
(function(root){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const paths={
  products:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  sparkles:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
  game:'M7 8h10c2 0 3 2 3.5 4l1 6c.3 2-2 3-3.5 1l-2-3H8l-2 3c-1.5 2-3.8 1-3.5-1l1-6C4 10 5 8 7 8Z M7 10v4 M5 12h4 M16 11h.01 M18 13h.01',
  ai:'M8 4v3M16 4v3M8 17v3M16 17v3M4 8h3M4 16h3M17 8h3M17 16h3M7 7h10v10H7z M10 10h4v4h-4z',
  image:'M3 3h18v18H3z M3 16l6-6 5 5 3-3 4 4 M15 7h.01',
  shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z M8 12l3 3 5-6'
 };
 const icons=Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>']));
 const url=p=>'/mehsul/'+encodeURIComponent(String(p.seoSlug||p.id).replace(/-almaq$/,''));
 function render(products,categories,card,{query='',filtered=false,title='Məhsullar'}={}){
  const active=[...new Map(products.filter(p=>p.active!==false).map(p=>[p.id,p])).values()];
  const prices=p=>(p.plans||[]).filter(v=>v.active!==false).map(v=>Number(v.price)).filter(v=>Number.isFinite(v)&&v>0);
  const mini=p=>{const values=prices(p),price=values.length?Math.min(...values):null;return '<a class="home-mini-card" data-product-id="'+esc(p.id)+'" href="'+url(p)+'"><span class="home-mini-image"><img src="'+esc(p.image||'')+'" alt="" loading="lazy" decoding="async"><span class="home-mini-fallback" aria-hidden="true">'+icons.image+'</span></span><span class="home-mini-name">'+esc(p.title)+'</span><strong>'+ (price===null?'—':price.toFixed(2).replace('.',',')+' '+esc(p.currency||'₼'))+'</strong></a>';};
  const wrap=(key,title,items,icon,href,limited=true)=>{
   if(!items.length)return '';
   const id='home-section-'+encodeURIComponent(key);
   if(limited){const id='home-section-'+encodeURIComponent(key),values=items.flatMap(p=>root.MirpanelInventory?.instantValid?.()?(p.plans||[]).flatMap((v,i)=>root.MirpanelInventory.planState(p,i)?.canOrder&&v.active!==false&&Number(v.price)>0?[Number(v.price)]:[]):[]),start=values.length?'<small class="home-category-from">'+Math.min(...values).toFixed(2).replace('.',',')+' ₼-dan</small>':'';
    return '<section class="home-product-section" aria-labelledby="'+id+'"><header class="home-section-heading"><h2 id="'+id+'"><span aria-hidden="true">'+(icons[icon]||icons.products)+'</span>'+esc(title)+'</h2>'+start+'<a href="'+href+'">Hamısına bax ›</a></header><div class="home-category-controls"><button type="button" data-home-scroll="-1" aria-label="'+esc(title)+' — əvvəlki məhsullar">‹</button><button type="button" data-home-scroll="1" aria-label="'+esc(title)+' — növbəti məhsullar">›</button></div><div class="home-category-row" tabindex="0" role="region" aria-label="'+esc(title)+' məhsulları">'+items.map(mini).join('')+'</div></section>';
   }
   const cards=items.map((p,i)=>card(p,i).replaceAll('home-card-'+p.id,'home-card-'+key+'-'+p.id)).join('');
   return '<section class="home-product-section" aria-labelledby="'+id+'"><header class="home-section-heading"><h2 id="'+id+'"><span aria-hidden="true">'+(icons[icon]||icons.products)+'</span>'+esc(title)+'</h2>'+(href?'<a href="'+href+'">Hamısına bax →</a>':'')+'</header><div class="home-section-grid'+(limited?' home-section-limited':'')+'">'+cards+'</div></section>';
  };
  if(query||filtered)return wrap('results',query?'Axtarış nəticələri':title,active,'products','',false);
  const configured=[...(categories||[])].sort((a,b)=>Number(a.order)-Number(b.order));
  const visible=configured.filter(c=>c.active!==false);
  const sections=visible.map(c=>wrap(c.key,c.name,active.filter(p=>p.category===c.key),c.icon,'/mehsul?category='+encodeURIComponent(c.key))).join('');
  const known=new Set(configured.map(c=>c.key));
  const unassigned=active.filter(p=>!known.has(p.category));
  const featured=active.filter(p=>root.MirpanelHomeFeaturedIds?root.MirpanelHomeFeaturedIds.includes(p.id):p.bestSeller===true);
  const names=duplicate=>active.map(p=>'<a href="'+url(p)+'"'+(duplicate?' tabindex="-1"':'')+'>'+esc(p.title)+'</a>').join('');
  const ticker='<div class="home-trending"><h2>Hamı bunu alır</h2><div class="home-name-strip"><div class="home-name-track"><div class="home-name-group">'+names(false)+'</div><div class="home-name-group" aria-hidden="true">'+names(true)+'</div></div></div><a class="home-trending-all" href="/mehsul?category=featured">Hamısına bax →</a></div>';
  const hero=featured.length?'<div class="home-section-grid home-featured">'+featured.map((p,i)=>card(p,i).replaceAll('home-card-'+p.id,'home-card-featured-'+p.id)).join('')+'</div>':'';
  return ticker+hero+sections+wrap('unassigned','Digər məhsullar',unassigned,'products','/mehsul');
 }
 if(typeof module==='object'&&module.exports)module.exports={render};else {
  root.MirpanelHomeSections={render};
  document.addEventListener('click',e=>{const button=e.target.closest('[data-home-scroll]');if(!button)return;const row=button.closest('section').querySelector('.home-category-row');row.scrollBy({left:Number(button.dataset.homeScroll)*row.clientWidth*.8,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});});
  document.addEventListener('keydown',e=>{const row=e.target;if(!row.matches('.home-category-row')||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();row.scrollBy({left:(e.key==='ArrowRight'?1:-1)*row.clientWidth*.7,behavior:'instant'});});
  document.addEventListener('error',e=>{if(e.target.matches?.('.home-mini-image img')){e.target.hidden=true;e.target.parentElement.classList.add('missing');}},true);
  let pending=false,last='',lastAt=0;
  async function refresh(){if(document.hidden||pending||Date.now()-lastAt<15000)return;pending=true;lastAt=Date.now();const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);try{const r=await fetch((root.MIRPANEL_ADMIN_BASE||'https://mirpanel-frankfurt.onrender.com')+'/api/home-featured',{credentials:'omit',cache:'no-store',signal:c.signal});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.ids))throw Error();const key=JSON.stringify(data.ids);root.MirpanelHomeFeaturedIds=data.ids;if(key!==last){last=key;if(typeof root.renderGrid==='function')root.renderGrid();}}catch{}finally{clearTimeout(timer);pending=false;}}
  root.addEventListener('mirpanel:catalog-runtime-ready',refresh);document.addEventListener('visibilitychange',refresh);root.addEventListener('online',refresh);setInterval(refresh,30000);
 }

})(globalThis);
