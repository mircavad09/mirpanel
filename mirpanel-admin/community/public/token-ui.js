import {TOKEN_NOTICE,TOKEN_TERMS_VERSION} from './token-terms.js?v=1';
const path='/mehsul/mirpanel-token';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;},money=n=>(n/100).toFixed(2).replace('.',',')+' ₼';
const button=(text,fn)=>{const n=el('button',text);n.type='button';n.onclick=fn;return n;};
const link=(text,href)=>{const n=el('a',text,'token-button');n.href=href;return n;};
export const tokenDate=value=>new Intl.DateTimeFormat('az-AZ',{timeZone:'Asia/Baku',dateStyle:'long',timeStyle:'short'}).format(new Date(value));
export async function tokenApi(url,data){const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);try{const r=await fetch(url,{credentials:'same-origin',cache:'no-store',method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:c.signal});const v=await r.json();if(!r.ok)throw Object.assign(Error(v.error?.message||v.error||'Sorğu alınmadı. Yenidən cəhd edin.'),{status:r.status});return v;}catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('Bağlantı təsdiqlənmədi. Eyni sorğu ilə yenidən cəhd edin.');throw e;}finally{clearTimeout(timer);}}
export function tokenStyle(){if(!document.querySelector('[data-token-style]')){const n=el('link');n.rel='stylesheet';n.href='/community-assets/token.css?v=token-cart-1';n.dataset.tokenStyle='';document.head.append(n);}}
let confirmation;
export async function confirmTokenPurchase(count,openCart=false){
 if(!Number.isInteger(count)||count<50||count>5000||confirmation?.open)return;
 tokenStyle();
 const dialog=el('dialog',null,'token-confirm');
 const title=el('h2','Diqqət! Almamışdan əvvəl oxuyun.');
 title.id='token-confirm-title';dialog.setAttribute('aria-labelledby',title.id);
 const check=el('input'),label=el('label','Oxudum və təsdiqləyirəm');
 check.type='checkbox';label.prepend(check);
 const error=el('p',null,'token-error');error.setAttribute('role','alert');
 const next=button('Davam et',async()=>{
  if(!check.checked||next.disabled)return;
  next.disabled=true;
  try{
   const {ensureCart}=await import('/cart-ready.js?v=token-cart-1');
   const cart=await ensureCart();if(!dialog.open)return;
   cart.addToken(count,TOKEN_TERMS_VERSION);
   dialog.close();if(openCart)cart.open({inline:true});
  }catch(e){error.textContent=e.message;next.disabled=false;}
 });
 next.disabled=true;check.onchange=()=>{next.disabled=!check.checked;};
 const actions=el('div',null,'token-confirm-actions');actions.append(button('Ləğv et',()=>dialog.close()),next);
 dialog.append(title,el('p',TOKEN_NOTICE),label,error,actions);document.body.append(dialog);
 dialog.addEventListener('close',()=>{dialog.remove();if(confirmation===dialog)confirmation=null;},{once:true});
 confirmation=dialog;dialog.showModal();
}
export function mountTokenPurchase(root){
 tokenStyle();
 const summary=el('div',null,'token-summary'),selection=el('span'),total=el('strong',null,'token-total');
 summary.setAttribute('aria-live','polite');summary.append(selection,total);
 const input=el('input'),label=el('label','Miqdar seçin'),unit=el('small','0,02 ₼ / token'),field=el('div',null,'token-quantity');
 input.type='number';input.min='50';input.max='5000';input.step='1';input.inputMode='numeric';input.placeholder='50–5000';
 input.id='token-count';input.value='50';label.htmlFor=input.id;
 const error=el('small',null,'token-error');error.id='token-count-error';error.setAttribute('role','alert');
 input.setAttribute('aria-describedby',error.id);field.append(input,unit,error);
 const actions=el('div',null,'token-actions');
 const buy=button('İndi al',()=>confirmTokenPurchase(Number(input.value),true));
 const add=button('Səbətə at',()=>confirmTokenPurchase(Number(input.value)));
 actions.append(buy,add);root.replaceChildren(summary,label,field,actions);
 function update(){
  const value=input.value,n=Number(value),valid=/^\d+$/.test(value)&&Number.isInteger(n)&&n>=50&&n<=5000;
  selection.textContent=valid?'Seçilmiş miqdar: '+n+' token':'Seçilmiş miqdar: —';
  total.textContent=valid?money(n*2):'—';
  error.textContent=!valid&&(value||input.validity.badInput)?'50–5000 arası tam ədəd yazın.':'';
  input.setAttribute('aria-invalid',String(!!error.textContent));buy.disabled=add.disabled=!valid;
 }
 input.addEventListener('input',update);update();
}
export function mountTokenWallet({root,api=tokenApi,validate=d=>d}){
 tokenStyle();let stopped=false,busy=false;const life=new AbortController(),head=el('section',null,'token-wallet-head'),rows=el('div'),error=el('p',null,'token-error');error.setAttribute('role','alert');root.replaceChildren(el('h1','Tokenlərim'),head,error,rows);let before=null;
 async function load(more=false){if(busy||stopped)return;busy=true;try{const d=validate(await api('/api/community/tokens'+(more&&before?'?before='+before:'')));if(stopped)return;head.replaceChildren(el('span','M','token-coin'),el('strong',d.balance+' token'),link('Token al',path));if(!more)rows.replaceChildren();rows.querySelector('[data-more]')?.remove();for(const item of d.items){const row=el('article',null,'token-history-row'),label=item.kind==='purchase'?'Token alışı':item.kind==='refund'?'Geri qaytarıldı':(item.gift_kind==='rose'?'Gül':'Ürək')+' · '+item.recipient_name;row.append(el('strong',(Number(item.delta)>0?'+':'')+item.delta+' token'),el('p',label),el('small',tokenDate(item.created_at)),el('small',item.order_code?'Sifariş №'+item.order_code:'Hədiyyə · '+item.source_id.slice(0,8)),el('small',item.kind==='refund'?'Geri qaytarıldı':'Tamamlandı'));rows.append(row);before=item.id;}for(const p of d.pending||[])if(!more)rows.append(el('p',p.quantity+' token · Sifariş №'+p.order_code+' · Ödəniş gözlənilir'));if(!d.items.length&&!more)rows.append(el('p','Hələ token əməliyyatı yoxdur.'));if(d.more){const next=button('Daha çox',()=>load(true));next.dataset.more='';rows.append(next);}error.textContent='';}catch(e){if(!stopped)error.replaceChildren(document.createTextNode(e.message+' '),button('Yenidən cəhd et',()=>load()));}finally{busy=false;}}
 window.addEventListener('focus',()=>load(),{signal:life.signal});window.addEventListener('mirpanel:token-balance-changed',()=>load(),{signal:life.signal});document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();},{signal:life.signal});void load();return()=>{stopped=true;life.abort();};
}
if(document.getElementById('tokenPurchase'))mountTokenPurchase(document.getElementById('tokenPurchase'));
