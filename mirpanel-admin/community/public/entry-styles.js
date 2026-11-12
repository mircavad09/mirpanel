let pending;
const href='/community-assets/cart-entry.css?v=player-gold-seal-1';
export function ensureEntryStyles(){
 let css=document.querySelector('link[data-cart-entry-css]');
 if(css?.getAttribute('href')===href&&css.sheet){css.disabled=false;css.media='all';return Promise.resolve();}
 if(pending)return pending;
 css?.remove();css=document.createElement('link');css.rel='stylesheet';css.href=href;css.dataset.cartEntryCss='';css.dataset.shellPersistent='';
 pending=new Promise((resolve,reject)=>{const finish=error=>{clearTimeout(timer);css.onload=css.onerror=null;pending=null;if(error){css.remove();reject(Error('Sifariş pəncərəsinin görünüşü yüklənmədi. Yenidən cəhd edin.'));}else{css.disabled=false;css.media='all';resolve();}};const timer=setTimeout(()=>finish(true),15000);css.onload=()=>finish(false);css.onerror=()=>finish(true);document.head.append(css);});
 return pending;
}
