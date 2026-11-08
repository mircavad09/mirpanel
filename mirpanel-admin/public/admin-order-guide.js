(() => {
 const labels={general:'Ümumi addımlar',phone:'Telefonda giriş',desktopQr:'Kompüterdə QR ilə giriş'};
 let lastProduct,activePlan;
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
 window.mountAdminOrderGuide=(host,product,dirty)=>{
  let shell=document.getElementById('orderGuideEditor');
  if(!shell){shell=node('details');shell.id='orderGuideEditor';host.after(shell);}
  if(lastProduct!==product.id){lastProduct=product.id;activePlan=null;shell.open=false;}
  const plans=product.plans||[],index=plans.indexOf(activePlan),selected=index<0?'product':String(index);
  const select=node('select');
  for(const [key,name] of [['product','Məhsul üzrə ümumi təlimat'],...plans.map((p,i)=>[String(i),p.label||p.name||('Paket '+(i+1))])]){
   const option=node('option',name);option.value=key;select.append(option);
  }
  select.value=selected;
  const draw=()=>window.mountAdminOrderGuide(host,product,dirty);
  select.onchange=()=>{activePlan=plans[Number(select.value)]||null;draw();};
  const target=index<0?product:activePlan,data=target.orderGuide||{information:'',tracks:{}};
  const changed=()=>{target.orderGuide=data;dirty();};
  const info=node('textarea');info.maxLength=12000;info.rows=6;info.value=data.information||'';info.oninput=()=>{data.information=info.value;changed();};
  shell.replaceChildren(node('summary','Sifarişdən sonra: Məlumat və təlimat'),
   node('p','Müştəriyə göstərilən ümumi qaydaları yazın. Hesab məlumatı, şifrə və təsdiq kodunu burada saxlamayın. Şəkil üçün kitabxanadakı və ya HTTPS şəkil ünvanını istifadə edin.'),
   field('Məhsul və ya paket',select),field('Məlumat mətni',info));
  const title=target.label||target.name||'';
  const inferred=/(?:^|[^\p{L}])telefon(?:da|la)?(?:$|[^\p{L}])/iu.test(title)&&!/kompüter|desktop|(?:^|\W)pc(?:$|\W)/iu.test(title);
  if(selected!=='product'){
   const only=node('input');only.type='checkbox';only.checked=inferred||data.phoneOnly===true;only.disabled=inferred;
   only.onchange=()=>{data.phoneOnly=only.checked;changed();draw();};
   const line=field('Yalnız telefon paketi',only);line.className='switchLine';shell.append(line);
  }
  for(const name of selected==='product'?['general']:Object.keys(labels).filter(key=>key!=='desktopQr'||!(inferred||data.phoneOnly))){
   const box=node('fieldset'),steps=data.tracks[name]||[];
   box.append(node('legend',labels[name]));
   steps.forEach((step,i)=>{
    const row=node('section');row.className='guide-editor-step';
    const url=node('input');url.type='text';url.maxLength=1500;url.value=step.image||'';url.placeholder='/uploads/… və ya https://…';
    const desc=node('textarea');desc.maxLength=1500;desc.rows=2;desc.value=step.description||'';
    url.oninput=()=>{step.image=url.value;changed();};desc.oninput=()=>{step.description=desc.value;changed();};
    const actions=node('div');
    for(const [text,offset] of [['Yuxarı',-1],['Aşağı',1]]){
     const b=btn(text,()=>{const j=i+offset;[steps[i],steps[j]]=[steps[j],steps[i]];changed();draw();});b.disabled=i+offset<0||i+offset>=steps.length;actions.append(b);
    }
    const preview=node('div');
    actions.append(btn('Şəklə bax',()=>{const value=url.value.trim();if(!validImage(value)){preview.textContent='Etibarlı şəkil ünvanı yazın.';return;}const img=node('img');img.alt='Addım '+(i+1);img.referrerPolicy='no-referrer';img.onerror=()=>{preview.textContent='Şəkil açıla bilmədi.';};img.src=value;preview.replaceChildren(img);}),
     btn('Sil',()=>{steps.splice(i,1);changed();draw();}));
    row.append(node('strong','Addım '+(i+1)),field('Şəklin ünvanı',url),field('Addımın izahı',desc),actions,preview);box.append(row);
   });
   const add=btn('+ Addım əlavə et',()=>{steps.push({image:'',description:''});data.tracks[name]=steps;changed();draw();});
   add.disabled=steps.length>=12;box.append(add);shell.append(box);
  }
 };
})();
