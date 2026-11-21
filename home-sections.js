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
  const active=products.filter(p=>p.active!==false);
  const wrap=(key,title,items,icon,href,limited=true)=>{
   if(!items.length)return '';
   const id='home-section-'+encodeURIComponent(key);
   const cards=items.slice(0,limited?10:items.length).map((p,i)=>card(p,i).replaceAll('home-card-'+p.id,'home-card-'+key+'-'+p.id)).join('');
   return '<section class="home-product-section" aria-labelledby="'+id+'"><header class="home-section-heading"><h2 id="'+id+'"><span aria-hidden="true">'+(icons[icon]||icons.products)+'</span>'+esc(title)+'</h2>'+(href?'<a href="'+href+'">Hamısına bax →</a>':'')+'</header><div class="home-section-grid'+(limited?' home-section-limited':'')+'">'+cards+'</div></section>';
  };
  if(query||filtered)return wrap('results',query?'Axtarış nəticələri':title,active,'products','',false);
  const configured=[...(categories||[])].sort((a,b)=>Number(a.order)-Number(b.order));
  const visible=configured.filter(c=>c.active!==false);
  const sections=visible.map(c=>wrap(c.key,c.name,active.filter(p=>p.category===c.key),c.icon,'/mehsul?category='+encodeURIComponent(c.key))).join('');
  const known=new Set(configured.map(c=>c.key));
  const unassigned=active.filter(p=>!known.has(p.category));
  const featured=active.filter(p=>p.bestSeller===true);
  const names=duplicate=>active.map(p=>'<a href="'+url(p)+'"'+(duplicate?' tabindex="-1"':'')+'>'+esc(p.title)+'</a>').join('');
  const ticker='<div class="home-trending"><h2>Hamı bunu alır</h2><div class="home-name-strip"><div class="home-name-track"><div class="home-name-group">'+names(false)+'</div><div class="home-name-group" aria-hidden="true">'+names(true)+'</div></div></div><a class="home-trending-all" href="/mehsul?category=featured">Hamısına bax →</a></div>';
  const hero=featured.length?'<div class="home-section-grid home-section-limited home-featured">'+featured.slice(0,10).map((p,i)=>card(p,i).replaceAll('home-card-'+p.id,'home-card-featured-'+p.id)).join('')+'</div>':'';
  return ticker+hero+sections+wrap('unassigned','Digər məhsullar',unassigned,'products','/mehsul');
 }
 if(typeof module==='object'&&module.exports)module.exports={render};else root.MirpanelHomeSections={render};
})(globalThis);
