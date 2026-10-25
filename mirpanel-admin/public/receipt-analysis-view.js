/* Presentation only. Reports contain masked recipient digits, never raw OCR text. */
let closeReceiptAnalysis=()=>{};
window.ReceiptAnalysisView = Object.freeze({
 text(report={}) {
  const labels={technical_pass:'Texniki yoxlamadan keçdi',manual_review:'Əl ilə yoxlanmalıdır',rejected:'Rədd edildi',legacy:'Köhnə qəbz — texniki yoxlama yoxdur',expired:'Saxlanma müddəti bitib'};
  const reasons={QR_REFERENCE_ONLY:'İstinad yalnız QR-dən oxunub — əl ilə yoxlayın',OCR_UNAVAILABLE:'OCR əlçatan deyil',UNKNOWN_FORMAT:'Yeni və ya tanınmayan format',LOW_CONFIDENCE:'Mətn tam dəqiqliklə oxunmur',TEXT_LAYER_CONFLICT:'PDF mətn qatı ilə görünən mətn fərqlidir',MIXED_NUMERALS:'Rəqəm ölçülərində fərq',COMPRESSION_PATCHES:'Lokal kompressiya fərqi',EDGE_CONTENT:'Mətn görüntünün kənarındadır',SIMILAR_RECEIPT:'Oxşar qəbz tapılıb',WRONG_AMOUNT:'Məbləğ uyğun deyil',WRONG_RECIPIENT:'Seçilmiş kart uyğun gəlmir',MISSING_AMOUNT:'Məbləğ görünmür',MISSING_REFERENCE:'Əməliyyat nömrəsi tapılmadı',MISSING_DATE:'Tarix-saat tapılmadı',MISSING_RECIPIENT:'Alan kart görünmür',MISSING_SUCCESS:'Uğurlu status tapılmadı',MISSING_CURRENCY:'AZN görünmür',UNSUCCESSFUL:'Əməliyyat uğurlu deyil',OLD_DATE:'Köhnə tarix',FUTURE_DATE:'Gələcək tarix',UNREADABLE:'Qəbz oxunmur',SOCIAL_SCREEN:'Sosial şəbəkə ekranı',NOT_RECEIPT:'Ödəniş qəbzi deyil'};
  const f=report.fields||{},match=v=>v===true?'Uyğundur':v===false?'Uyğun deyil':'Yoxlanmalıdır';
  return [labels[report.status]||'Yoxlanmalıdır','Bu nəticə bank hesabındakı real mədaxili təsdiqləmir.',
   `Bank: ${f.bankName||'Müəyyən edilmədi'}`,`Məbləğ: ${f.amountCents==null?'—':(f.amountCents/100).toFixed(2)+' AZN'}`,
   `Tarix-saat: ${f.occurredAt?new Date(f.occurredAt).toLocaleString('az-AZ',{timeZone:'Asia/Baku'}):'—'}`,
   `Əməliyyat / istinad: ${f.reference||'—'}`,`Alan kart: ${f.recipientLast4?'•••• '+f.recipientLast4:'—'}`,
   `Məbləğ uyğunluğu: ${match(report.checks?.amount)}`,`Kart uyğunluğu: ${match(report.checks?.recipient)}`,`Tarix uyğunluğu: ${match(report.checks?.date)}`,
   `PDF mətn qatı: ${report.pdfTextLayerPresent?'Var':'Yoxdur'} · QR: ${report.qrPresent?'Var':'Yoxdur'}`,
   `Risk balı: ${report.riskScore??'—'} / 100 (saxtakarlıq hökmü deyil)`,
   ...[...new Set([...(report.reasons||[]),...(report.riskReasons||[])])].map(r=>'• '+(reasons[r]||r))].join('\n')+(report.attempts?.length?'\n\nBu rezerv üzrə son yoxlamalar:\n'+report.attempts.map(a=>(a.createdAt?new Date(a.createdAt).toLocaleString('az-AZ',{timeZone:'Asia/Baku'}):'')+'\n'+this.text({...a,attempts:undefined})).join('\n\n'):'');
 },
 show(report) {
  closeReceiptAnalysis();
  const dialog=document.createElement('dialog');dialog.id='receiptAnalysisDialog';
  dialog.style.cssText='box-sizing:border-box;width:min(620px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;background:#171719;color:#fff;border:1px solid #555;border-radius:16px;padding:16px';
  const title=document.createElement('h3');title.textContent='Qəbzin texniki yoxlaması';
  const text=document.createElement('pre');text.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.6';text.textContent=this.text(report);
  const close=document.createElement('button');close.type='button';close.textContent='Bağla';close.style.cssText='min-height:44px;min-width:88px;font-size:16px';
  const hide=()=>{if(document.hidden)clear();};
  const clear=()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',hide);dialog.close();dialog.remove();if(closeReceiptAnalysis===clear)closeReceiptAnalysis=()=>{};};close.onclick=clear;dialog.addEventListener('cancel',e=>{e.preventDefault();clear();});
  dialog.append(title,text,close);document.body.append(dialog);dialog.showModal();close.focus();const timer=setTimeout(clear,60000);closeReceiptAnalysis=clear;document.addEventListener('visibilitychange',hide);
 }
});
