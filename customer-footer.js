(()=>{
 if(!document.querySelector('.site-header')||document.querySelector('#customerFooter'))return;
 if(!document.querySelector('[data-customer-footer-style]')){
  const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/customer-footer.css?v=chat-space-20261108';sheet.dataset.shellPersistent='';sheet.dataset.customerFooterStyle='';document.head.append(sheet);
 }
 const footer=document.createElement('footer');footer.id='customerFooter';footer.dataset.shellPersistent='';
 const wa='https://wa.me/994515243545';
 // Sales completed before MirPanel opened; not part of the site's order records.
 const preLaunchSales=10000;
 footer.innerHTML=`
 <div class="customer-footer-inner">
  <section class="customer-footer-support" aria-labelledby="footerSupportTitle">
   <div><h2 id="footerSupportTitle">Sualınız var? Operatora yazın.</h2><p>Hər gün 11:00–01:00 arası aktivik. Bizə yazın, dərhal cavab alacaqsınız.</p></div>
   <a class="customer-footer-cta" href="${wa}" target="_blank" rel="noopener noreferrer">Operatora yaz</a>
   <a href="/elaqe">Əlaqə səhifəsi</a>
  </section>
  <ul class="customer-footer-facts">
   <li><strong>2024-dən fəaliyyətdə</strong></li>
   <li id="footerCompleted" hidden></li>
   <li><strong>Anında avtomatik təhvil</strong><small>Yalnız bu imkanın göstərildiyi məhsullarda</small></li>
   <li><strong>Komissiyasız ödəniş</strong><small>MirPanel əlavə komissiya tutmur; bankın köçürmə tarifi tətbiq oluna bilər.</small></li>
  </ul>
  <div class="customer-footer-columns">
   <section><h2><a href="/">MirPanel.com</a></h2><p>Rəqəmsal hesablar, abunəliklər, proqram lisenziyaları və rəqəmsal məhsullar bir yerdə.</p></section>
   <section><h2>Kəşf et</h2><ul>
    <li><a href="/mehsul">Hesablar və abunəliklər</a></li>
    <li><a href="/mehsul?search=Adobe">Proqram lisenziyaları</a></li>
    <li><a href="/mehsul?search=TikTok">Marketinq həlləri</a></li>
    <li><a href="/mehsul">Rəqəmsal məhsullar və alətlər</a></li>
    <li><a href="/elaqe#elaqe-destek">AI promptları</a><small>Operatora soruş</small></li>
    <li><a href="/elaqe#elaqe-destek">Hansını almalı? Müqayisələr</a></li>
   </ul></section>
   <section><h2>Üstünlüklərimiz</h2><ul><li>Sürətli təhvil</li><li>Etibarlı xidmət</li><li>Canlı dəstək</li><li>Sərfəli qiymətlər</li><li>Avtomatlaşdırılmış sistem</li><li><a href="/qrup">Qrup/Söhbət</a></li></ul></section>
   <section><h2>Əlaqə</h2><p><a href="tel:+994515243545">+994 51 524 35 45</a></p><p>Hər gün 11:00–01:00 · Bakı vaxtı</p><p class="customer-footer-methods-label">Ödəniş imkanları</p>
    <ul class="customer-footer-methods" aria-label="Ödəniş imkanları"><li>Balans</li><li data-network hidden>Visa</li><li data-network hidden>Mastercard</li><li data-bank="m10" hidden>m10</li><li data-bank="kapital" hidden>Birbank</li></ul>
    <small>Kart nişanları bank köçürməsinə aiddir; birbaşa kart ödənişi deyil.</small>
   </section>
  </div>
  <div class="customer-footer-end"><span>© ${new Date().getFullYear()} MirPanel · Bütün hüquqlar qorunur</span><a href="/sertler">Şərtlər</a><a href="/sertler#sertler-10">Məxfilik</a></div>
 </div>`;
 const balance=document.querySelector('#shopApp.shop-wallet-page');
 if(balance)(balance.closest('#sitePageContent')||balance).after(footer);
 else document.body.append(footer);
 document.body.classList.add('has-customer-footer');
 fetch('/api/payments/storefront',{credentials:'omit',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():null).then(data=>{
  if(!data)return;
  const onlineOrders=data.completedOrders;
  if(Number.isSafeInteger(onlineOrders)&&onlineOrders>=0&&onlineOrders<=Number.MAX_SAFE_INTEGER-preLaunchSales){
   const total=preLaunchSales+onlineOrders;
   const item=footer.querySelector('#footerCompleted'),label=document.createElement('strong');
   label.textContent=String(total).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+'+ tamamlanmış satış';
   item.append(label);item.hidden=false;
  }
  if(Array.isArray(data.banks)){
   for(const bank of footer.querySelectorAll('[data-bank]'))bank.hidden=!data.banks.includes(bank.dataset.bank);
   if(data.banks.some(x=>['kapital','abb','leo'].includes(x)))for(const badge of footer.querySelectorAll('[data-network]'))badge.hidden=false;
  }
 }).catch(()=>{});
})();
