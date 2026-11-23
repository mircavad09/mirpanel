import {walletDeviceSupports,appleMoney} from './epoint-wallet.js?v=selection-1';
const names={'apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10'};
export async function productPaymentChoices({host,el,select,signal}){
 const response=await fetch('/api/payments/epoint/status',{credentials:'same-origin',cache:'no-store',signal});
 if(!response.ok)return;
 const config=await response.json();
 const methods=await Promise.all(Object.keys(names).map(async method=>config.purchaseMethods?.[method]===true&&await walletDeviceSupports(method)?method:null));
 if(signal.aborted||!host.isConnected)return;
 for(const method of methods.filter(Boolean)){
  const tile=el('label',null,'checkout-tile'),radio=el('input');radio.type='radio';radio.name='paymentMode';radio.value=method;
  radio.addEventListener('change',()=>{if(radio.checked)select(method);});
  const logo={'apple-pay':'apple-pay-mark.svg',birbank:'birbank-symbol.svg',m10:'m10-logo.svg'}[method];
  if(logo){const image=el('img');image.src='/assets/wallet/methods/'+logo;image.alt='';image.width=48;image.height=32;image.style.objectFit='contain';tile.append(radio,image);}
  else tile.append(radio);
  tile.append(el('strong',names[method]),el('span','✓','checkout-check'));host.append(tile);
 }
}
export function confirmProductPayment({items,cents,method,el,onConfirm,signal}){
 const dialog=el('dialog',null,'apple-topup-confirm product-payment-confirm');dialog.setAttribute('aria-label','Sifariş ödənişini təsdiqləyin');
 dialog.append(el('h2','Sifariş ödənişini təsdiqləyin'));
 for(const item of items)dialog.append(el('p',item.title+' · '+item.planName+' · '+item.quantity+' ədəd'));
 dialog.append(el('p','Ödəniş üsulu: '+names[method]),el('strong',appleMoney(cents)));
 const back=el('button','Geri'),confirm=el('button','Təsdiq et','shop-primary');back.type=confirm.type='button';
 const close=()=>{dialog.close();dialog.remove();};back.onclick=close;
 confirm.onclick=()=>{confirm.disabled=true;back.disabled=true;close();onConfirm();};
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});signal.addEventListener('abort',()=>dialog.remove(),{once:true});
 dialog.append(back,confirm);document.body.append(dialog);dialog.showModal();back.focus();
}
