// Separate review queue; never treats employee delivery as final payment approval.
(()=>{'use strict';
 const host=document.createElement('section');host.id='employeeReviewSection';host.className='panel';host.style.cssText='min-width:0;overflow-wrap:anywhere;padding:12px;margin-bottom:16px';
 host.innerHTML='<details><summary>İşçinin tamamladığı — yoxlama gözləyənlər <strong id="employeeReviewCount">—</strong></summary><p>İşçi tamamlayıb — admin yoxlaması gözlənilir. Yalnız sizin yekun təsdiqiniz satış və bonus yaradır.</p><p id="employeeReviewStatus" role="status"></p><div id="employeeReviewList"></div><button type="button" class="btn" id="employeeReviewPrevious">Əvvəlki</button><button type="button" class="btn" id="employeeReviewNext">Növbəti</button></details>';
 document.querySelector('main')?.prepend(host);
 host.querySelector('summary').style.cssText='min-height:44px;padding:10px 0;cursor:pointer';
 const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','İşçinin təqdimatı və audit');dialog.style.cssText='width:min(640px,calc(100% - 24px));max-height:85dvh;overflow:auto;background:#17171c;color:#fff;border:1px solid #666;border-radius:16px;padding:16px';
 dialog.innerHTML='<pre style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><button type="button" class="btn">Bağla</button>';document.body.append(dialog);
 let page=0,loading=false,timer,clearTimer;const busy=new Set(),keys=new Map();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=v=>v?new Date(v).toLocaleString('az-AZ',{timeZone:'Asia/Baku'}):'—';
 const status=host.querySelector('#employeeReviewStatus'),list=host.querySelector('#employeeReviewList');
 function clear(){clearTimeout(clearTimer);dialog.querySelector('pre').textContent='';if(dialog.open)dialog.close();}
 dialog.querySelector('button').onclick=clear;dialog.addEventListener('cancel',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 async function load(){if(loading||document.hidden)return;loading=true;try{
  const summary=await api('/api/admin/workforce/review-summary');host.querySelector('#employeeReviewCount').textContent=String(summary.pendingReview);
  if(!host.querySelector('details').open)return;
  const d=await api('/api/admin/workforce/orders?tab=DELIVERED_PENDING_ADMIN&page='+page);
  list.innerHTML=d.orders.map(o=>`<article class="paymentOrderCard" style="min-width:0;overflow-wrap:anywhere;padding:12px;margin:12px 0;border:1px solid #45454f;border-radius:12px"><h3>Sifariş № ${esc(o.order_code)}</h3><p>${esc(o.customer_name||'Məlumat yoxdur')} · ${esc(o.customer_phone||'Məlumat yoxdur')}</p><p>${esc(o.product_title)} · ${esc(o.plan_name)} · Miqdar: ${Number(o.quantity)}</p><p>İşçinin ödəniş qərarı: ${o.payment_verified_at?'Yoxlanılıb — yekun təsdiq deyil':'Yoxlanmayıb'} · ${esc(o.payment_note||'')}</p><p>İşçi: ${esc(o.employee_name)}<br>Stok ID: ${esc((o.stock_ids||[]).join(', '))}<br>İşçinin qeydi: ${esc(o.employee_note||'—')}</p><p>Qəbul: ${date(o.employee_accepted_at||o.accepted_at)}<br>Ödəniş yoxlanılıb: ${date(o.payment_verified_at)}<br>Stok ayrılıb: ${date(o.stock_reserved_at)}<br>Təqdimat: ${date(o.employee_delivered_at)}<br>Yoxlamaya göndərilib: ${date(o.employee_submitted_for_review_at||o.submitted_at)}</p><div class="actions" style="display:flex;flex-wrap:wrap;gap:8px">${[['receipt','Çekə bax'],['review','Mesaj və auditə bax'],['complete','Təsdiqlə və tamamla'],['return','Düzəliş üçün işçiyə qaytar']].map(([a,l])=>`<button class="btn${a==='complete'?' primary':''}" type="button" style="min-height:44px;max-width:100%;white-space:normal" data-review-order="${esc(o.id)}" data-review-action="${a}">${l}</button>`).join('')}</div></article>`).join('')||'<p>Yoxlama gözləyən sifariş yoxdur.</p>';
  host.querySelector('#employeeReviewPrevious').disabled=page===0;host.querySelector('#employeeReviewNext').disabled=d.orders.length<50;status.textContent='';
 }catch(e){status.textContent=e.status===503?'İşçi yoxlama sistemi yeni migration və konfiqurasiyanı gözləyir.':e.message;}finally{loading=false;}}
 list.addEventListener('click',async e=>{const b=e.target.closest('[data-review-action]');if(!b)return;const id=b.dataset.reviewOrder,action=b.dataset.reviewAction;if(busy.has(id))return;busy.add(id);b.disabled=true;try{
  if(action==='receipt'){const d=await api(`/api/admin/workforce/orders/${id}/receipt`);window.open(d.url,'_blank','noopener');return;}
  if(action==='review'){const d=await api(`/api/admin/workforce/orders/${id}/review`);dialog.querySelector('pre').textContent=(d.message||'Saxlanılmış mesaj yoxdur.')+'\n\nAudit:\n'+d.events.map(v=>date(v.created_at)+' · '+v.actor_role+' · '+v.action+(v.review_reason?' · '+v.review_reason:'')).join('\n');dialog.showModal();clearTimer=setTimeout(clear,30000);return;}
  const body={};if(action==='return'){const reason=prompt('Geri qaytarma səbəbini yazın (məcburidir):');if(!reason||reason.trim().length<3){status.textContent='Geri qaytarma səbəbini yazın.';return;}body.reason=reason;}
  else if(!confirm('Çeki, təqdimatı və stok məlumatını yoxladınız? Sifariş yekun tamamlanacaq, satış və bonus bir dəfə hesablanacaq.'))return;
  const k=id+':'+action;if(!keys.has(k))keys.set(k,crypto.randomUUID());
  await api(`/api/admin/workforce/orders/${id}/${action}`,{method:'POST',headers:{'X-Idempotency-Key':keys.get(k)},body:JSON.stringify(body)});keys.delete(k);await load();document.getElementById('paymentOrdersRefresh')?.click();
 }catch(e){status.textContent=e.message;}finally{busy.delete(id);b.disabled=false;}});
 host.querySelector('details').addEventListener('toggle',load);host.querySelector('#employeeReviewPrevious').onclick=()=>{if(page>0){page--;load();}};host.querySelector('#employeeReviewNext').onclick=()=>{page++;load();};
 load();timer=setInterval(load,15000);window.addEventListener('pagehide',()=>{clearInterval(timer);clear();},{once:true});
})();
