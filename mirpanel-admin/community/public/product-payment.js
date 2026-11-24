import {walletDeviceSupports} from './epoint-wallet.js?v=payment-access-1';
const names={card:'Bank kartı — Visa / Mastercard','apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10'};
export async function productPaymentChoices({host,el,select,signal,preferDirect=()=>false}){
 const response=await fetch('/api/payments/epoint/status',{credentials:'same-origin',cache:'no-store',signal});
 if(!response.ok)return;
 const config=await response.json();
 const methods=await Promise.all(Object.keys(names).map(async method=>config.purchaseMethods?.[method]===true&&(method==='card'||await walletDeviceSupports(method))?method:null));
 if(signal.aborted||!host.isConnected)return;
 for(const method of methods.filter(Boolean)){
  const tile=el('label',null,'checkout-tile'),radio=el('input');radio.type='radio';radio.name='paymentMode';radio.value=method;
  radio.addEventListener('change',()=>{if(radio.checked)select(method);});
  const logo={card:'bank-card.svg','google-pay':'google-pay-mark.svg','apple-pay':'apple-pay-mark.svg',birbank:'birbank-symbol.svg',m10:'m10-logo.svg'}[method];
  if(logo){const image=el('img');image.src='/assets/wallet/methods/'+logo;image.alt='';image.width=48;image.height=32;image.style.objectFit='contain';tile.append(radio,image);}
  else tile.append(radio);
  tile.append(el('strong',names[method]),el('span','✓','checkout-check'));host.append(tile);
 }
 if(preferDirect()&&methods.some(Boolean)){
  const radio=host.querySelector('input[value="'+methods.find(Boolean)+'"]');radio.checked=true;select(radio.value);
 }
 if(!methods.includes('card'))host.append(el('small','Bank kartı ilə birbaşa ödəniş hazırda əlçatan deyil.','shop-muted'));
 const ua=navigator.userAgent||'';
 if(/iPhone/i.test(ua)&&!methods.includes('apple-pay'))host.append(el('small','Apple Pay üçün Safari-də açın'+(methods.includes('card')?' və ya bank kartı ilə ödəyin.':'.'),'shop-muted'));
 if(/Android/i.test(ua)&&!methods.includes('google-pay')&&methods.includes('card'))host.append(el('small','Google Pay açılmırsa, bank kartı ilə ödəyin.','shop-muted'));
}
