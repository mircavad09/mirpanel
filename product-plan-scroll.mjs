// Presentation only. Selection continues through the existing row click handler.
export function mountPlanScroll(container,{signal}={}){
 if(!container||container.dataset.planScroll)return;
 container.dataset.planScroll='true';
 const shell=document.createElement('div');shell.className='product-plan-scroll';
 container.before(shell);shell.append(container);
 const rail=document.createElement('div');rail.className='product-plan-scroll-controls';
 const button=(label,text)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.textContent=text;return b;};
 const up=button('Əvvəlki paketləri göstər','▴'),down=button('Növbəti paketləri göstər','▾'),more=button('Aşağıdakı paketləri göstər','');more.className='product-plan-more';
 const track=document.createElement('span'),thumb=document.createElement('span');track.className='product-plan-track';thumb.className='product-plan-thumb';track.setAttribute('aria-hidden','true');track.append(thumb);
 rail.append(up,track,down);shell.append(rail,more);container.setAttribute('aria-label','Müddət və paket seçimi');
 const visible=()=>[...container.querySelectorAll('.pp-plan-label')].filter(n=>!n.hidden);
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 let frame=0,width=0,height=0,oldPositions=null,selectionFrame=0;
 function indicators(){
  const rows=visible(),box=container.getBoundingClientRect(),overflow=rows.length>4;
  shell.classList.toggle('has-overflow',overflow);rail.hidden=more.hidden=!overflow;
  if(!overflow)return;
  const below=rows.filter(n=>n.getBoundingClientRect().bottom>box.bottom+2).length;
  more.textContent=`Daha ${below} paket ↓`;more.style.visibility=below?'visible':'hidden';
  up.disabled=container.scrollTop<2;down.disabled=container.scrollTop+container.clientHeight>=container.scrollHeight-2;
  const size=Math.max(20,track.clientHeight*container.clientHeight/container.scrollHeight);thumb.style.height=size+'px';thumb.style.transform=`translateY(${Math.max(0,(track.clientHeight-size)*container.scrollTop/Math.max(1,container.scrollHeight-container.clientHeight))}px)`;
 }
 function measure(){
  const rows=visible(),nextWidth=container.clientWidth;
  if(rows.length>4){
   // Four compact rows plus one expanded facts line. Keep this viewport stable
   // across selections; remeasure only when width or visible row count changes.
   const signature=nextWidth+':'+rows.length;
   if(width!==signature){width=signature;const gap=parseFloat(getComputedStyle(container).rowGap)||6;
    const compact=rows.slice(0,4).map(n=>Math.min(64,Math.max(44,n.getBoundingClientRect().height)));
    height=Math.min(320,Math.max(220,compact.reduce((a,b)=>a+b,0)+gap*3+24));
    container.style.setProperty('--package-viewport',height+'px');
   }
  }else{width=0;container.style.removeProperty('--package-viewport');}
  indicators();
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);}
 function move(direction){container.scrollBy({top:direction*Math.max(48,container.clientHeight*.78),behavior:reduced()?'instant':'smooth'});}
 up.onclick=()=>move(-1);down.onclick=more.onclick=()=>move(1);
 container.addEventListener('scroll',indicators,{passive:true,signal});
 // Never intercept wheel/touch: native scroll chaining at the end remains intact.
 container.addEventListener('click',()=>{
  oldPositions=new Map(visible().map(n=>[n,n.getBoundingClientRect().top]));
 },{capture:true,signal});
 container.addEventListener('click',()=>{
  cancelAnimationFrame(selectionFrame);selectionFrame=requestAnimationFrame(()=>{
   const rows=visible();if(!reduced()&&oldPositions)for(const row of rows){const delta=oldPositions.get(row)-row.getBoundingClientRect().top;if(Number.isFinite(delta)&&Math.abs(delta)>1)row.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:160,easing:'ease-out'}).finished.then(indicators).catch(()=>{});}
   const selected=rows.find(n=>n.classList.contains('active'));if(selected&&rows.length>4){const b=container.getBoundingClientRect(),r=selected.getBoundingClientRect();if(r.bottom>b.bottom)container.scrollTop+=r.bottom-b.bottom+2;else if(r.top<b.top)container.scrollTop-=b.top-r.top+2;}
   oldPositions=null;indicators();
  });
 },{signal});
 container.addEventListener('focusin',e=>{
  const row=e.target.closest('.pp-plan-label');if(!row||visible().length<=4)return;
  const b=container.getBoundingClientRect(),r=row.getBoundingClientRect();
  if(r.top<b.top)container.scrollTop-=b.top-r.top+4;else if(r.bottom>b.bottom)container.scrollTop+=r.bottom-b.bottom+4;
 },{signal});
 container.addEventListener('keydown',e=>{if(!['Home','End'].includes(e.key)||!e.target.closest('.pp-plan-label'))return;const rows=visible().filter(n=>n.getAttribute('aria-disabled')!=='true'),next=e.key==='Home'?rows[0]:rows.at(-1);if(next){e.preventDefault();next.click();next.focus({preventScroll:true});}},{signal});
 const resize=new ResizeObserver(schedule);resize.observe(container);
 const changes=new MutationObserver(schedule);changes.observe(container,{subtree:true,attributes:true,attributeFilter:['hidden','class','aria-disabled'],childList:true});
 signal?.addEventListener('abort',()=>{resize.disconnect();changes.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(selectionFrame);},{once:true});
 measure();
}
