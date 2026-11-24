import {walletDeviceSupports} from './epoint-wallet.js?v=payment-access-1';
const methods={
 card:{title:'Kart',detail:'Bank kartı',logo:'bank-card.svg'},
 'apple-pay':{title:'Apple Pay',detail:'Tez ödəniş',logo:'apple-pay-mark.svg'},
 'google-pay':{title:'Google Pay',logo:'google-pay-mark.svg'},
 birbank:{title:'Birbank',logo:'birbank-symbol.svg'},
 m10:{title:'m10',logo:'m10-logo.svg'}
};
export async function productPaymentChoices({host,el,select,signal,getSelected=()=>'wallet',expansion={open:false}}){
 const response=await fetch('/api/payments/epoint/status',{credentials:'same-origin',cache:'no-store',signal});
 if(!response.ok)throw Error('Ödəniş üsulları alınmadı.');
 const config=await response.json();
 const available=new Set((await Promise.all(Object.keys(methods).map(async method=>config.purchaseMethods?.[method]===true&&(method==='card'||await walletDeviceSupports(method))?method:null))).filter(Boolean));
 if(signal.aborted||!host.isConnected)return;
 const primary=host.querySelector('.checkout-primary-methods')||host;
 function tile(method,{title,detail,logo},disabled=false){
  const card=el('label',null,'checkout-tile'+(disabled?' checkout-tile-disabled':'')),radio=el('input');
  radio.type='radio';radio.name='paymentMode';radio.value=method;radio.disabled=disabled;
  radio.addEventListener('change',()=>{if(radio.checked&&!radio.disabled)select(method);});
  const image=el('img');image.src='/assets/wallet/methods/'+logo;image.alt='';image.width=48;image.height=32;
  card.append(radio,image,el('strong',title));if(detail)card.append(el('small',detail));
  card.append(el('span','✓','checkout-check'));return card;
 }
 const card=tile('card',{...methods.card,...(!available.has('card')?{detail:'Hazırda mövcud deyil'}:{})},!available.has('card'));
 primary.append(card);
 if(available.has('apple-pay'))primary.append(tile('apple-pay',methods['apple-pay']));
 const other=el('div',null,'checkout-other-methods'),summary=el('button','Digər ödəniş üsulları','checkout-other-toggle'),grid=el('div',null,'checkout-secondary-methods');
 summary.type='button';grid.id='checkout-extra-'+crypto.randomUUID();grid.tabIndex=-1;
 summary.setAttribute('aria-controls',grid.id);summary.setAttribute('aria-expanded',String(expansion.open));
 const chevron=el('span',null,'checkout-other-chevron');chevron.setAttribute('aria-hidden','true');summary.append(chevron);
 summary.hidden=expansion.open;grid.hidden=!expansion.open;
 summary.addEventListener('click',()=>{
  const position={left:window.scrollX,top:window.scrollY,behavior:'instant'};
  expansion.open=true;summary.setAttribute('aria-expanded','true');summary.hidden=true;grid.hidden=false;
  // Move focus off the disappearing control without scrolling the viewport.
  (grid.querySelector('input:not(:disabled)')||grid).focus({preventScroll:true});
  window.scrollTo(position);
  requestAnimationFrame(()=>{if(!signal.aborted&&grid.isConnected)window.scrollTo(position);});
 },{signal});other.append(summary,grid);
 if(available.has('google-pay'))grid.append(tile('google-pay',methods['google-pay']));
 grid.append(tile('birbank',{...methods.birbank,...(!available.has('birbank')?{detail:'Hazırda mövcud deyil'}:{})},!available.has('birbank')));
 grid.append(tile('m10',{...methods.m10,...(!available.has('m10')?{detail:'Hazırda mövcud deyil'}:{})},!available.has('m10')));
 grid.append(tile('transfer',{title:'Kartdan karta',detail:'Hazırda mövcud deyil',logo:'bank-card.svg'},true));
 grid.append(tile('bank-account',{title:'Hesaba köçürmə',detail:'Tezliklə',logo:'bank-card.svg'},true));
 host.append(other);
 const selected=host.querySelector('input[value="'+getSelected()+'"]');if(selected&&!selected.disabled){selected.checked=true;if(grid.contains(selected)){expansion.open=true;summary.hidden=true;grid.hidden=false;summary.setAttribute('aria-expanded','true');}}else if(getSelected()!=='wallet'){select(null);host.append(el('small','Seçilmiş ödəniş üsulu bu brauzerdə açılmır. Safari-də açın və ya bank kartını özünüz seçin.','shop-muted checkout-method-hint'));}
 const ua=navigator.userAgent||'';
 if(/iPhone/i.test(ua)&&!available.has('apple-pay'))host.append(el('small','Apple Pay üçün Safari-də açın və ya bank kartını seçin.','shop-muted checkout-method-hint'));
 if(/Android/i.test(ua)&&!available.has('google-pay'))host.append(el('small','Google Pay açılmırsa, bank kartını seçin.','shop-muted checkout-method-hint'));
}
