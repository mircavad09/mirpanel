// Keyed DOM reconciliation, not page reloads. No network calls or session touches.
(()=>{'use strict';
 const attrs=['data-payment-order-id','data-review-order-id','data-canonical-order','data-user-id','data-live-key','data-product-id','data-unit','data-live-group'],selector=attrs.filter(a=>a!=='data-live-group').map(a=>'['+a+']').join(','),dirty=new WeakSet(),notices=new WeakMap();
 const key=e=>{if(e?.nodeType!==1)return'';for(const a of attrs)if(e.hasAttribute(a))return a+':'+e.getAttribute(a);if(e.id)return'id:'+e.id;if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)){const row=e.closest(selector),field=e.name||e.getAttribute('data-note')||e.getAttribute('data-quantity');if(row&&field)return'control:'+key(row)+':'+field;}return'';};
 document.addEventListener('input',e=>dirty.add(e.target),true);document.addEventListener('change',e=>dirty.add(e.target),true);
 function anchor(root){const rows=[...root.querySelectorAll(selector)].filter(e=>e.getClientRects().length),visible=rows.find(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.top<innerHeight;})||rows.find(e=>{const r=e.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;});return visible?{element:visible,id:attrs.map(a=>visible.getAttribute(a)).find(Boolean),index:rows.indexOf(visible),key:key(visible),top:visible.getBoundingClientRect().top,rows}:null;}
 function message(root,text){let p=root.parentElement.querySelector(':scope > [data-live-message]');if(!p){p=document.createElement('p');p.dataset.liveMessage='';p.setAttribute('role','status');root.before(p);}p.textContent=text;}
 function preserve(root,work){if(!root)return work();const a=anchor(root),x=scrollX,y=scrollY;const scrolls=[];for(let p=root;p&&p!==document.body;p=p.parentElement)if(p.scrollHeight>p.clientHeight&&/(auto|scroll)/.test(getComputedStyle(p).overflowY))scrolls.push([p,p.scrollTop]);
  const restore=()=>{if(!a){scrollTo(x,y);for(const[p,t]of scrolls)p.scrollTop=t;return;}let next=[...root.querySelectorAll(selector)].find(e=>key(e)===a.key);
   if(!next){for(let distance=1;distance<=a.rows.length&&!next;distance++)for(const index of[a.index+distance,a.index-distance]){const old=a.rows[index];if(old)next=[...root.querySelectorAll(selector)].find(e=>key(e)===key(old));if(next)break;}message(root,'Baxdığınız qeyd artıq bu siyahıda deyil. Yaxın mövqe qorundu.');}
   if(next){for(const[p]of scrolls){if(p.contains(next)){p.scrollTop+=next.getBoundingClientRect().top-a.top;break;}}const delta=next.getBoundingClientRect().top-a.top;if(Math.abs(delta)>0.5)scrollBy(0,delta);}else scrollTo(x,y);
  };const result=work();if(result?.then)return result.finally(restore);restore();return result;
 }
 function update(root,markup){if(!root)return;return preserve(root,()=>{
  const template=document.createElement('template');if(typeof markup==='string')template.innerHTML=markup;else for(const n of markup)template.content.append(n);
  const pool=new Map([...root.querySelectorAll('*')].map(e=>[key(e),e]).filter(([k])=>k));
  function patch(old,fresh){if(old.nodeType!==1){if(old.nodeValue!==fresh.nodeValue)old.nodeValue=fresh.nodeValue;return;}
   const edited=dirty.has(old)||old===document.activeElement,control=/^(INPUT|TEXTAREA|SELECT)$/.test(old.tagName),open=old.tagName==='DETAILS'?old.open:null;
   for(const a of[...old.attributes])if(!fresh.hasAttribute(a.name)&&!(edited&&['value','checked','selected'].includes(a.name))&&a.name!=='open')old.removeAttribute(a.name);
   for(const a of fresh.attributes)if(!(edited&&['value','checked','selected'].includes(a.name))&&a.name!=='open'&&old.getAttribute(a.name)!==a.value)old.setAttribute(a.name,a.value);
   for(const p of['onclick','onchange','oninput','onsubmit'])if(fresh[p])old[p]=fresh[p];
   if(!(control&&edited)&&old.type!=='file'){children(old,fresh);if(control){old.value=fresh.value;if(old.tagName==='INPUT')old.checked=fresh.checked;}}
   if(open!==null)old.open=open;
  }
  function children(parent,fresh){let cursor=parent.firstChild;const keep=new Set();for(const n of[...fresh.childNodes]){const k=key(n);let match=k?pool.get(k):cursor&&!key(cursor)&&cursor.nodeType===n.nodeType&&cursor.nodeName===n.nodeName?cursor:null;if(match&&match.nodeName!==n.nodeName)match=null;if(!match)match=n.cloneNode(false);if(match!==cursor)parent.insertBefore(match,cursor);keep.add(match);patch(match,n);cursor=match.nextSibling;}for(const n of[...parent.childNodes])if(!keep.has(n))n.remove();}
  children(root,template.content);
 });}
 function notice(root,count,onShow,label='Yeni qeydlər var'){let b=notices.get(root);if(!count){b?.remove();notices.delete(root);return;}if(!b){b=document.createElement('button');b.type='button';b.className='btn primary';b.style.cssText='min-height:44px;max-width:100%;white-space:normal;position:sticky;top:8px;z-index:5;display:block';b.dataset.liveNew='';notices.set(root,b);root.before(b);}b.textContent=label+' · '+count;b.onclick=async()=>{await onShow();b.remove();notices.delete(root);root.scrollIntoView({block:'start'});};}
 window.AdminLive={update,preserve,anchor,notice,isDirty:e=>dirty.has(e),clearDirty:e=>dirty.delete(e),message};
})();
