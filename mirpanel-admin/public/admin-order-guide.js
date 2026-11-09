(() => {
 const labels={general:'Ümumi addımlar',phone:'Telefonda giriş',desktopQr:'Kompüterdə QR ilə giriş'};
 let selectedProduct,activePlan,activeTab="information";
 function node(tag,text){const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;}
 function btn(text,click){const b=node('button',text);b.type='button';b.className='btn';b.onclick=click;return b;}
 function field(text,input){const label=node('label',text);label.append(input);return label;}
 function validImage(text){
  try{const u=new URL(text,'https://mirpanel.com');return u.protocol==='https:'&&!u.username&&!u.password&&(/^https:\/\//i.test(text)||text.startsWith('/uploads/')&&u.pathname.startsWith('/uploads/'));}catch{return false;}
 }
 window.adminOrderGuideError=products=>{
  for(const product of products)for(const target of [product,...(product.plans||[])])for(const steps of Object.values(target.orderGuide?.tracks||{}))for(const [i,step] of steps.entries()){
   const url=String(step.image||'').trim(),description=String(step.description||'').trim();
   if((url||description)&&(!validImage(url)||!description))return (target===product?product.title:product.title+' · '+(target.label||target.name||'Paket'))+' — addım '+(i+1)+': etibarlı şəkil ünvanı və izah yazın.';
  }
  return '';
 };
 function renderEditor(shell,product,dirty){
  const plans=product.plans||[],index=plans.indexOf(activePlan),selected=index<0?'product':String(index);
  const select=node('select');
  for(const [key,name] of [['product','Məhsul üzrə ümumi təlimat'],...plans.map((p,i)=>[String(i),p.label||p.name||('Paket '+(i+1))])]){
   const option=node('option',name);option.value=key;select.append(option);
  }
  select.value=selected;
  const draw=()=>renderEditor(shell,product,dirty);
  select.onchange=()=>{activePlan=plans[Number(select.value)]||null;draw();};
  const target=index<0?product:activePlan,data=target.orderGuide||{information:'',tracks:{}};
  const changed=()=>{target.orderGuide=data;dirty();};
  const info=node('textarea');info.maxLength=12000;info.rows=6;info.value=data.information||'';info.oninput=()=>{data.information=info.value;changed();};
  const information=node('div'),tutorial=node('div'),tabs=node('div');
  tabs.className='guideEditorTabs';
  for(const [id,label] of [['information','Məlumat'],['tutorial','Təlimat']]){
   const tab=btn(label,()=>{activeTab=id;switchTab();});
   tab.dataset.guideTab=id;tabs.append(tab);
  }
  function switchTab(){
   information.hidden=activeTab!=='information';
   tutorial.hidden=activeTab!=='tutorial';
   for(const tab of tabs.children)tab.setAttribute('aria-pressed',String(tab.dataset.guideTab===activeTab));
  }
  information.append(node('p','Başlıq üçün #, siyahı üçün - və ya 1. istifadə edin. Abzasları boş sətirlə ayırın.'),field('Məlumat mətni',info));
  tutorial.append(node('p','Təlimat addımları yalnız əlavə edildikdə müştəriyə görünür.'));
  shell.replaceChildren(field('Məhsul və ya paket',select),tabs,information,tutorial);
  switchTab();
  const title=target.label||target.name||'';
  const inferred=/(?:^|[^\p{L}])telefon(?:da|la)?(?:$|[^\p{L}])/iu.test(title)&&!/kompüter|desktop|(?:^|\W)pc(?:$|\W)/iu.test(title);
  if(selected!=='product'){
   const only=node('input');only.type='checkbox';only.checked=inferred||data.phoneOnly===true;only.disabled=inferred;
   only.onchange=()=>{data.phoneOnly=only.checked;changed();draw();};
   const line=field('Yalnız telefon paketi',only);line.className='switchLine';tutorial.append(line);
  }
  for(const name of selected==='product'?['general','phone']:Object.keys(labels).filter(key=>key!=='desktopQr'||!(inferred||data.phoneOnly))){
   const box=node('fieldset'),steps=data.tracks[name]||[];
   box.append(node('legend',labels[name]));
   steps.forEach((step,i)=>{
    const row=node('section');row.className='guide-editor-step';
    const url=node('input');url.type='text';url.maxLength=1500;url.value=step.image||'';url.placeholder='/uploads/… və ya https://…';
    const desc=node('textarea');desc.maxLength=1500;desc.rows=2;desc.value=step.description||'';
    url.oninput=()=>{step.image=url.value;changed();};desc.oninput=()=>{step.description=desc.value;changed();};
    const animation=node('select');
    for(const [key,label] of [['','Animasiya yoxdur'],['ben','Ben · toxunma'],['sign-in','E-poçtla giriş düyməsi'],['email','Nümunə e-poçt yazılır'],['password','Şifrə və Devam'],['pro','Pro nişanı']]){
     const option=node('option',label);option.value=key;animation.append(option);
    }
    animation.value=step.animation||'';
    animation.onchange=()=>{if(animation.value)step.animation=animation.value;else delete step.animation;changed();};
    const actions=node('div');
    for(const [text,offset] of [['Yuxarı',-1],['Aşağı',1]]){
     const b=btn(text,()=>{const j=i+offset;[steps[i],steps[j]]=[steps[j],steps[i]];changed();draw();});b.disabled=i+offset<0||i+offset>=steps.length;actions.append(b);
    }
    const preview=node('div');
    actions.append(btn('Şəklə bax',()=>{const value=url.value.trim();if(!validImage(value)){preview.textContent='Etibarlı şəkil ünvanı yazın.';return;}const img=node('img');img.alt='Addım '+(i+1);img.referrerPolicy='no-referrer';img.onerror=()=>{preview.textContent='Şəkil açıla bilmədi.';};img.src=new URL(value,"https://mirpanel.com/").href;preview.replaceChildren(img);}),
     btn('Sil',()=>{steps.splice(i,1);changed();draw();}));
    row.append(node('strong','Addım '+(i+1)),field('Şəklin ünvanı',url),field('Addımın izahı',desc),field('Animasiya',animation),actions,preview);box.append(row);
   });
   const add=btn('+ Addım əlavə et',()=>{steps.push({image:'',description:''});data.tracks[name]=steps;changed();draw();});
   add.disabled=steps.length>=12;box.append(add);tutorial.append(box);
  }
 };
 window.mountAdminOrderGuide=(host,products,dirty,publish)=>{
  const editor=node('section'),catalog=node('section'),panel=node('div');
  editor.className='panel guideEditor';
  catalog.className='panel guideCatalog';
  const grid=node('div');grid.className='guideProductGrid';
  catalog.append(node('h3','Məhsullar'),grid);
  const back=btn('← Məhsullara qayıt',()=>{
   host.classList.remove('guideHasSelection');
   const selected=grid.querySelector('[aria-pressed="true"]');
   selected?.focus();
  });
  back.classList.add('guideBack');
  const save=btn('Yoxla və yayımla',publish);
  save.classList.add('primary');
  const cards=new Map();
  function select(product,focus=false){
   if(selectedProduct!==product.id){activePlan=null;activeTab='information';}
   selectedProduct=product.id;
   for(const [id,card] of cards)card.setAttribute('aria-pressed',String(id===selectedProduct));
   host.classList.add('guideHasSelection');
   const heading=node('h3',product.title);heading.tabIndex=-1;
   editor.replaceChildren(back,heading,panel,save);
   renderEditor(panel,product,dirty);
   if(focus){heading.focus({preventScroll:true});editor.scrollIntoView({block:'nearest'});}
  }
  for(const product of products){
   const card=btn('',()=>select(product,true));
   card.setAttribute('aria-pressed','false');
   if(product.image){
    try{
     const url=new URL(product.image,'https://mirpanel.com/');
     if(url.protocol==='https:'&&!url.username&&!url.password){
      const img=node('img');img.src=url.href;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();card.append(img);
     }
    }catch{}
   }
   card.append(node('strong',product.title));
   cards.set(product.id,card);grid.append(card);
  }
  editor.append(node('p','Redaktə etmək üçün məhsul seçin.'));
  host.replaceChildren(editor,catalog);
  const product=products.find(item=>item.id===selectedProduct);
  if(product)select(product);
  else host.classList.remove('guideHasSelection');
 };
})();
