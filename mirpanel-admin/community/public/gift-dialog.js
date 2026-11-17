import {chatElement as el,chatButton as button,chatModal} from './chat-components.js?v=tokens-1';
const money=c=>(c/100).toFixed(2).replace('.',',')+' ₼';
// The caller supplies every read and write. Preview never receives a live transport.
export function openGiftDialog({products,recipient,getBalance,submit,addBalance,test=false,parent,onClose}){
 const modal=chatModal({title:'Hədiyyə et',test,parent,onClose}),{body,box}=modal;
 const screen=el('div');body.append(screen);let product,plan,busy=false,disposed=false,requestId=crypto.randomUUID();
 box.addEventListener('close',()=>{disposed=true;});
 const nav=(back,next)=>{const n=el('nav');if(back)n.append(button('Geri',back));if(next)n.append(next);n.append(button('Ləğv et',()=>box.close()));return n;};
 const choose=()=>{
  screen.replaceChildren(el('h3','Məhsul və paket seçin'),el('p','Hədiyyə alan: '+recipient.name+' · #'+recipient.memberNumber));
  const search=el('input');search.type='search';search.placeholder='Məhsul axtar…';search.setAttribute('aria-label','Məhsul axtar');
  const select=el('select');select.setAttribute('aria-label','Hədiyyə məhsulu');
  const packages=el('select');packages.setAttribute('aria-label','Hədiyyə paketi');
  const price=el('p'),label=el('label','Paket');label.append(packages);
  function fillPlans(){
   product=products.find(p=>p.id===select.value);packages.replaceChildren();
   for(const p of product?.plans||[]){const option=new Option(p.label+' — '+money(Math.round(p.price*100)),String(p.index));packages.add(option);}
   if(plan&&product?.plans.some(p=>p.index===plan.index))packages.value=String(plan.index);
   update();
  }
  function update(){plan=product?.plans.find(p=>String(p.index)===packages.value);price.textContent=plan?'Qiymət: '+money(Math.round(plan.price*100)):'Uyğun paket yoxdur.';next.disabled=!plan;}
  function filter(){select.replaceChildren();for(const p of products.filter(p=>p.title.toLocaleLowerCase('az').includes(search.value.toLocaleLowerCase('az'))))select.add(new Option(p.title,p.id));if(product&&[...select.options].some(o=>o.value===product.id))select.value=product.id;fillPlans();}
  const next=button('Növbəti',confirm,'primary');packages.onchange=update;select.onchange=()=>{plan=null;fillPlans();};search.oninput=filter;
  const pLabel=el('label','Məhsul');pLabel.append(select);screen.append(search,pLabel,label,price,nav(null,next));filter();
 };
 function summary(){
  const n=el('div',null,'chat-gift-summary');n.append(el('p',product.title+' · '+plan.label),el('p','Qiymət: '+money(Math.round(plan.price*100))),
   el('p','Hədiyyə alan: '+recipient.name+' · #'+recipient.memberNumber),el('p','Balans: '+money(getBalance())));return n;
 }
 function topup(){
  screen.replaceChildren(el('h3','Balansı artır'),el('p',test?'Yalnız sınaq balansı dəyişəcək. Kart və qəbz göndərilmir.':'Balans artırma'),summary());
  const input=el('input');input.type='number';input.min='0.01';input.max='100000';input.step='0.01';input.value='20';input.setAttribute('aria-label','Əlavə ediləcək sınaq məbləği');
  const error=el('p');error.setAttribute('role','alert');
  const add=button(test?'Sınaq balansına əlavə et':'Davam et',()=>{
   const value=Number(input.value);if(!Number.isFinite(value)||value<=0||value>100000){error.textContent='Məbləğ 0,01–100000 ₼ olmalıdır.';return;}
   addBalance(Math.round(value*100));confirm();
  },'primary');
  screen.append(input,error,nav(confirm,add));
 }
 function insufficient(){
  screen.replaceChildren(el('h3','Balans çatışmır'),summary(),el('p','Çatışmayan məbləğ: '+money(Math.max(0,Math.round(plan.price*100)-getBalance()))),nav(confirm,button('Balansı artır',topup,'primary')));
 }
 function confirm(){
  screen.replaceChildren(el('h3','Hədiyyəni təsdiqləyin'),summary());
  const error=el('p');error.setAttribute('role','alert');
  const send=button(test?'Sınaq hədiyyəsini təsdiqlə':'Hədiyyəni təsdiqlə',async()=>{
   if(busy)return;if(getBalance()<Math.round(plan.price*100)){insufficient();return;}
   busy=true;send.disabled=true;send.textContent='Göndərilir…';
   try{
    const result=await submit({requestId,productId:product.id,planIndex:plan.index,recipient:recipient.memberNumber,unitCents:Math.round(plan.price*100)});
    if(disposed)return;
    screen.replaceChildren(el('h3',test?'Sınaq hədiyyəsi uğurludur':'Hədiyyə göndərildi'),el('p',product.title+' · '+plan.label),
     el('p','Alan: '+recipient.name+' · #'+recipient.memberNumber),el('p','Nəticə: '+result.id),
     el('p',test?'Real pul, sifariş, stok və bildiriş dəyişməyib.':'Əməliyyat təsdiqləndi.'),button('Tamam',()=>box.close(),'primary'));
   }catch(e){if(!disposed){if(e.code==='BALANCE')insufficient();else error.textContent=e.message;}}
   finally{busy=false;if(!disposed){send.disabled=false;send.textContent=test?'Sınaq hədiyyəsini təsdiqlə':'Hədiyyəni təsdiqlə';}}
  },'primary');
  screen.append(error,nav(choose,send));
 }
 choose();return modal;
}
