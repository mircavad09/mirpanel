// One capability-checked entry point shared by classic-script and module callers.
const compatible=c=>c&&['read','checkout','set','clear','commitDraft','open'].every(k=>typeof c[k]==='function');
let pending;
export async function ensureCart(){
 if(compatible(window.MirpanelCart))return window.MirpanelCart;
 if(!pending)pending=import('/cart-store.js?v=checkout-warning-20261106').then(()=>{
  if(!compatible(window.MirpanelCart))throw Error('Səbət modulu tam açıla bilmədi. Yenidən cəhd edin.');
  return window.MirpanelCart;
 }).catch(e=>{pending=null;throw e;});
 return pending;
}
