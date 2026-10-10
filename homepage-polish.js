(() => {
  if(!document.body.classList.contains('home-page') || window.mirpanelHomePolish) return;
  window.mirpanelHomePolish=true;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header=document.getElementById('mainHeader');
  const nav=header?.querySelector('.site-header-nav');
  if(nav) {
    const category=document.createElement('button');category.type='button';category.className='home-category-button';category.textContent='▦ Kateqoriyalar';
    category.onclick=()=>document.getElementById('products-section')?.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});nav.prepend(category);
    const support=document.createElement('a');support.className='home-header-support';support.href='/elaqe';support.textContent='Canlı dəstək / Əlaqə';header.querySelector('.site-header-inner').appendChild(support);
  }
  let tickerKey='';
  function updateTicker() {
    const tabs=document.getElementById('tabs');if(!tabs)return;
    let ticker=tabs.querySelector('.home-product-ticker');
    if(!ticker){ticker=document.createElement('nav');ticker.className='home-product-ticker';ticker.setAttribute('aria-label','Görünən məhsullara keçid');tabs.querySelector('.glass-sort-container')?.before(ticker);tickerKey='';}
    const cards=[...document.querySelectorAll('#grid .card')];const key=cards.map(c=>`${c.dataset.productId}:${c.querySelector('.title').textContent}`).join('|');if(key===tickerKey&&ticker.children.length)return;tickerKey=key;
    ticker.replaceChildren();ticker.hidden=!cards.length;if(!cards.length)return;
    const track=document.createElement('div');track.className='home-product-ticker-track';
    const group=document.createElement('div');group.className='home-product-ticker-group';
    for(const card of cards){const button=document.createElement('button');button.type='button';button.dataset.productJump=card.dataset.productId;button.textContent=card.querySelector('.title').textContent;group.appendChild(button);}
    track.appendChild(group);ticker.appendChild(track);
    const originals=[...group.children];let count=0;while(group.scrollWidth<ticker.clientWidth && count++<5){for(const node of originals){const copy=node.cloneNode(true);copy.tabIndex=-1;copy.setAttribute('aria-hidden','true');group.appendChild(copy);}}
    const duplicate=group.cloneNode(true);duplicate.setAttribute('aria-hidden','true');duplicate.querySelectorAll('button').forEach(button=>button.tabIndex=-1);track.appendChild(duplicate);
    ticker.onclick=event=>{const id=event.target.closest('[data-product-jump]')?.dataset.productJump;if(!id)return;const card=document.querySelector(`#grid [data-product-id="${CSS.escape(id)}"]`);if(!card)return;card.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'});card.focus({preventScroll:true});card.classList.add('home-card-highlight');clearTimeout(card._highlightTimer);card._highlightTimer=setTimeout(()=>card.classList.remove('home-card-highlight'),1600);};
  }
  window.addEventListener('mirpanel:grid-rendered',updateTicker);updateTicker();
  let resizeFrame;
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{tickerKey='';updateTicker();});});
  const sideHost=document.getElementById('homeSideBanners');
  function updateSideDots() {
    let dots=document.getElementById('homeSideDots');const panels=[...sideHost.children];
    if(!dots){dots=document.createElement('div');dots.id='homeSideDots';dots.className='home-side-dots';dots.setAttribute('aria-label','Kampaniya bannerini seç');sideHost.after(dots);}
    dots.hidden=panels.length<2;dots.replaceChildren();
    panels.forEach((panel,index)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`${index+1}-ci kampaniya`);button.onclick=()=>sideHost.scrollTo({left:panel.offsetLeft-panels[0].offsetLeft,behavior:reduced()?'instant':'smooth'});dots.appendChild(button);});
    const mark=()=>{const closest=panels.reduce((best,panel,index)=>Math.abs(panel.offsetLeft-panels[0].offsetLeft-sideHost.scrollLeft)<best.distance?{index,distance:Math.abs(panel.offsetLeft-panels[0].offsetLeft-sideHost.scrollLeft)}:best,{index:0,distance:Infinity});[...dots.children].forEach((button,index)=>{button.classList.toggle('active',index===closest.index);button.setAttribute('aria-current',String(index===closest.index));});};sideHost.onscroll=mark;mark();
  }
  if(sideHost){const observer=new MutationObserver(updateSideDots);observer.observe(sideHost,{childList:true});updateSideDots();}
  const footer=document.querySelector('.footer .footIn');
  if(footer){const brand=document.createElement('a');brand.href='/';brand.className='home-footer-brand';brand.textContent='MIRPANEL';footer.prepend(brand);const dock=document.createElement('div');dock.className='home-support-dock';dock.setAttribute('aria-label','Dəstək və əyləncə');for(const selector of ['#gameBtnOpen','#waFab']){const button=document.querySelector(selector);if(button)dock.appendChild(button);}footer.appendChild(dock);}
})();
