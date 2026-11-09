export function renderViewCatalog({app,api,el,button,link,navigate,notify,search,valid}){
 let alive=true;
 const money=(value,currency='₼')=>Number(value).toFixed(2).replace('.',',')+' '+currency;
 const home=()=>navigate('?page=products');
 const error=el('p',{role:'status'});
 app.replaceChildren(el('h1',{},'Məhsullar'),el('p',{},'Məlumat hazırlanır…'));
 void api('/api/payments/storefront').then(({products})=>{
  if(!alive||!valid())return;
  const slug=search.get('product'),product=products.find(p=>p.slug===slug||p.id===slug);
  const blocked=label=>{const n=button(label,notify,true);n.setAttribute('data-view-disabled','');return n;};
  if(slug&&product){
   let selected=Math.max(0,product.plans.findIndex(plan=>plan.index===Number(search.get('plan'))));
   const photo=el('img',{src:product.image,alt:product.title,class:'customer-view-product-photo'});
   const summary=el('strong',{class:'customer-view-price'});
   const choices=el('fieldset',{class:'customer-view-plans'},el('legend',{},'Müddət seçin'));
   for(const [index,plan]of product.plans.entries()){
    const input=el('input',{type:'radio',name:'view-plan',value:index,...(index===selected?{checked:''}:{})});
    input.addEventListener('change',()=>{selected=index;paint();});
    choices.append(el('label',{},input,el('span',{},plan.label),el('strong',{},money(plan.price,product.currency))));
   }
   const status=el('p',{role:'status'});
   function paint(){
    const plan=product.plans[selected]||product.plans[0];
    summary.textContent=plan?money(plan.price,product.currency):'Paket yoxdur';
    status.textContent=!plan?.canOrder?'Stokda yoxdur':Number.isSafeInteger(plan.available)?plan.available+' stokda':'Mövcuddur';
   }
   paint();
   const back=new URLSearchParams(search);back.delete('product');back.delete('plan');
   app.replaceChildren(link('← Məhsullara qayıt','?'+back),el('article',{class:'customer-view-product'},
    photo,el('section',{},el('h1',{},product.title),el('p',{},product.description||''),summary,choices,status,
    el('div',{class:'customer-view-purchase'},blocked('Səbətə əlavə et'),blocked('Sifariş et')))),error);
   return;
  }
  if(slug){app.replaceChildren(el('h1',{},'Məhsul tapılmadı'),button('Məhsullara qayıt',home));return;}
  const query=el('input',{type:'search',placeholder:'Məhsul axtar','aria-label':'Məhsul axtar',value:search.get('q')||''});
  const filter=el('select',{'aria-label':'Kateqoriya'},el('option',{value:''},'Bütün kateqoriyalar'));
  for(const category of [...new Set(products.map(p=>p.category).filter(Boolean))])
   filter.append(el('option',{value:category},category));
  filter.value=search.get('category')||'';
  let page=Math.max(1,Number(search.get('number'))||1);
  const grid=el('div',{class:'account-products customer-view-products'});
  const count=el('p',{role:'status'}),pages=el('nav',{'aria-label':'Məhsul səhifələri'});
  const setUrl=()=>{
   const u=new URL(location.href);u.search=new URLSearchParams({page:'products',q:query.value,category:filter.value,number:String(page)});
   history.replaceState({},'',u);
  };
  function draw(){
   const rows=products.filter(p=>(!filter.value||p.category===filter.value)&&p.title.toLocaleLowerCase('az').includes(query.value.toLocaleLowerCase('az')));
   const total=Math.max(1,Math.ceil(rows.length/8));page=Math.min(page,total);
   count.textContent=rows.length+' məhsul';
   grid.replaceChildren(...rows.slice((page-1)*8,page*8).map(p=>{
    const href='?'+new URLSearchParams({page:'products',product:p.slug||p.id,q:query.value,category:filter.value,number:String(page)});
    const prices=p.plans.map(plan=>Number(plan.price)).filter(v=>Number.isFinite(v)&&v>0);
    const card=el('article',{class:'account-product'});
    card.append(link('',href,'account-product-link'));
    card.firstChild.append(el('img',{src:p.image,alt:p.title,loading:'lazy'}),el('strong',{},p.title));
    if(prices.length)card.append(el('strong',{},money(Math.min(...prices),p.currency)));
    if(!p.plans.some(plan=>plan.canOrder))card.append(el('span',{},'Stokda yoxdur'));
    card.append(blocked('+'));
    return card;
   }));
   const back=button('←',()=>{page--;draw();}),next=button('→',()=>{page++;draw();});
   back.setAttribute('aria-label','Əvvəlki səhifə');next.setAttribute('aria-label','Növbəti səhifə');
   back.disabled=page<=1;next.disabled=page>=total;pages.replaceChildren(back,el('span',{},page+' / '+total),next);setUrl();
  }
  query.addEventListener('input',()=>{page=1;draw();});filter.addEventListener('change',()=>{page=1;draw();});
  app.replaceChildren(link('← Profilə qayıt','?tab=profile'),el('h1',{},'Məhsullar'),el('div',{class:'customer-view-filters'},query,filter),count,grid,pages,error);draw();
 }).catch(e=>{
  if(alive&&valid())app.replaceChildren(el('h1',{},'Məhsullar'),el('p',{role:'status'},e.message),button('Yenidən cəhd et',home));
 });
 return ()=>{alive=false;};
}
