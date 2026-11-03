/* Shared presentation only: price/availability decisions stay with the caller. */
(function(root){'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(p,index,url,title,price,shownPrice,stock=''){
  const plan=(p.plans||[]).find(v=>Number(v.price)===price),cents=Math.round(price*100),old=Math.round(Number(plan?.regularPrice)*100),discount=Number.isSafeInteger(cents)&&cents>0&&Number.isSafeInteger(old)&&old>cents;
  const id=esc(p.id),labels=[p.bestSeller===true?'🔥 Ən çox satılan':'',p.deliveryType==='automatic'?'⚡ Anında':''].filter(Boolean);
  return `<article class="card homeProductCard" data-product-id="${id}" aria-labelledby="home-card-${id}" style="animation-delay:${Math.min(index*.03,.25)}s"><div class="imgWrap"><img class="img" src="${esc(p.image)}" alt="${esc(p.imageAlt||title)}" loading="lazy" decoding="async">${discount?`<span class="homeCardDiscount">-${Math.round((old-cents)/old*100)}%</span>`:''}${labels.length?`<div class="homeCardLabels">${labels.map(t=>`<span>${t}</span>`).join('')}</div>`:''}</div><div class="pad homeCardBody"><h3 class="title" id="home-card-${id}" title="${esc(title)}">${esc(title)}</h3><div class="homeCardPrices"><strong>${esc(shownPrice)}</strong>${discount?`<del>${(old/100).toFixed(2)} ${esc(p.currency||'₼')}</del>`:''}</div><p class="homeCardSales" data-home-sales-id="${id}" hidden></p><a class="homeCardOrder" href="${esc(url)}" aria-label="Sifariş et" aria-describedby="home-card-${id}" title="Sifariş et"><span aria-hidden="true">→</span></a>${stock}</div></article>`;
 }
 if(typeof module==='object'&&module.exports)module.exports={render};else{root.MirpanelCatalogCard={render};if(!document.querySelector('link[href*="catalog-card.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/catalog-card.css?v=compact-20261103';document.head.append(css);}}
})(globalThis);
