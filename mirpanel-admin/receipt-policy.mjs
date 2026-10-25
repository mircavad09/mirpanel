export const RECEIPT_GUIDANCE='Bank tətbiqində əməliyyatı açın və tam ödəniş qəbzini yükləyin. Qəbzdə məbləğ, tarix-saat, əməliyyat nömrəsi və ödəniş edilən kart görünməlidir. Adi screenshot və kəsilmiş şəkil qəbul edilmir.';
export const RECEIPT_REJECT_MESSAGE='Bu şəkil ödəniş qəbzi kimi tanınmadı. Zəhmət olmasa bank tətbiqində tamamlanmış əməliyyatı açın və məbləğ, tarix-saat, əməliyyat nömrəsi və kartın son rəqəmləri görünən tam qəbzi yenidən yükləyin.';
export const RECEIPT_REASONS={NOT_RECEIPT:'Şəkil ödəniş qəbzi deyil',SOCIAL_SCREEN:'Sosial şəbəkə ekranı qəbul edilmir',MISSING_AMOUNT:'Məbləğ görünmür',MISSING_CURRENCY:'AZN valyutası görünmür',MISSING_REFERENCE:'Əməliyyat nömrəsi tapılmadı',MISSING_DATE:'Tarix və saat tapılmadı',MISSING_RECIPIENT:'Alan kartın son rəqəmləri görünmür',UNREADABLE:'Qəbz oxunmur',WRONG_AMOUNT:'Məbləğ sifarişlə uyğun gəlmir',WRONG_RECIPIENT:'Seçilmiş kart uyğun gəlmir',FUTURE_DATE:'Qəbzin tarixi gələcəkdədir',OLD_DATE:'Qəbzin tarixi sifarişə uyğun deyil',UNSUCCESSFUL:'Əməliyyat uğurlu deyil',MISSING_SUCCESS:'Tamamlanmış əməliyyat statusu tapılmadı',DUPLICATE:'Bu çek əvvəl istifadə olunub',OCR_UNAVAILABLE:'OCR əlçatan deyil — əl ilə yoxlanmalıdır',UNKNOWN_FORMAT:'Yeni və ya tanınmayan qəbz formatı',LOW_CONFIDENCE:'Mətnin bəzi hissələri dəqiq oxunmur',TEXT_LAYER_CONFLICT:'PDF mətn qatı ilə görünən mətn uyğun gəlmir',MIXED_NUMERALS:'Məbləğ/tarix sətrində rəqəm ölçüləri fərqlidir',COMPRESSION_PATCHES:'Şəkildə lokal kompressiya fərqləri var',EDGE_CONTENT:'Vacib mətn görüntünün kənarına çox yaxındır',QR_REFERENCE_ONLY:'Əməliyyat nömrəsi yalnız QR-dən oxunub — əl ilə yoxlayın',SIMILAR_RECEIPT:'Oxşar qəbz tapılıb — əl ilə müqayisə edilməlidir'};
export const RECEIPT_PROFILES=[
 {id:'birbank',name:'Kapital Bank / Birbank',pattern:/\b(birbank|kapital\s*bank)\b/u,kind:'card'},
 {id:'yelo',name:'Yelo Bank',pattern:/\byelo(?:\s*bank)?\b/u,kind:'card'},
 {id:'rabita',name:'Rabitəbank',pattern:/\b(rabite\s*bank|rabitabank|rabit[eə]bank)\b/u,kind:'card'},
 {id:'m10',name:'m10',pattern:/\bm\s?10\b/u,kind:'wallet'},
 {id:'emanat',name:'eManat',pattern:/\be\s?manat\b/u,kind:'terminal'},
 {id:'abb',name:'ABB',pattern:/\babb\b/u,kind:'card'},
 {id:'leo',name:'LeoBank',pattern:/\bleo\s?bank\b/u,kind:'card'}
];
const fold=s=>String(s||'').normalize('NFKC').toLocaleLowerCase('az').replace(/[əƏ]/g,'e').replace(/[ıİ]/g,'i').replace(/[öÖ]/g,'o').replace(/[üÜ]/g,'u').replace(/[şŞ]/g,'s').replace(/[çÇ]/g,'c').replace(/[ğĞ]/g,'g');
function money(value){const v=value.replace(/\s/g,'');const last=Math.max(v.lastIndexOf(','),v.lastIndexOf('.'));const decimal=last>=0&&v.length-last<=3?last:-1;const normalized=decimal>=0?v.slice(0,decimal).replace(/[.,]/g,'')+'.'+v.slice(decimal+1):v.replace(/[.,]/g,'');const n=Number(normalized);return Number.isFinite(n)&&n>=0?Math.round(n*100):null;}
export function extractReceiptFields(raw){
 const t=fold(raw),lines=t.split(/[\r\n]+/);let amount=null;
 for(const line of lines){if(/komiss|commission|fee/.test(line))continue;const m=line.match(/(?:mebleg|amount|odenis|total|cem|summa|сумма)[^\d\n]{0,28}(\d[\d .,]{0,18})\s*(?:azn|₼|manat)/u)||line.match(/(\d[\d .,]{0,18})\s*(?:azn|₼|manat)/u);if(m){amount=money(m[1]);break;}}
 if(amount===null){for(let i=0;i<lines.length;i++){if(!/mebleg|amount|total|cem|summa/u.test(lines[i])||/komiss|commission|fee/u.test(lines[i]))continue;const block=lines.slice(i,i+3).join(' '),m=block.match(/(?:mebleg|amount|total|cem|summa)[^\d]{0,35}(\d[\d .,]{0,18})\s*(?:azn|₼|manat)/u);if(m){amount=money(m[1]);break;}}}
 const ref=t.match(/(?:emeliyyat\s*(?:nomresi|no|id|№)|transaction\s*(?:id|number|no)|istinad(?:\s*nomresi)?|reference(?:\s*(?:no|number|id))?|receipt\s*(?:no|number|id)|qebz\s*(?:nomresi|no|№)|sened\s*(?:nomresi|no|№)|document\s*(?:number|no|id)|rrn|avtorizasiya(?:\s*(?:kodu|nomresi))?|authorization(?:\s*(?:code|no))?|операци[яи]\s*№?|чек\s*№?)[\s:#№-]*([a-z0-9][a-z0-9 /_-]{5,70})/u)?.[1]?.replace(/ /g,'')||null;
 const dateMatch=t.match(/\b(\d{4})[-/.](\d{2})[-/.](\d{2})[t\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?=$|[^a-z0-9]|z\b)/u)||t.match(/\b(\d{2})[-/.](\d{2})[-/.](\d{4})[t\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?=$|[^a-z0-9]|z\b)/u);let occurredAt=null;
 if(dateMatch){const zone=t.slice(dateMatch.index+dateMatch[0].length).match(/^(z|[+-]\d{2}:?\d{2})\b/u)?.[1],offset=!zone?240:zone==='z'?0:(zone[0]==='+'?1:-1)*(Number(zone.slice(1,3))*60+Number(zone.slice(-2)));const a=dateMatch.slice(1).map(Number),[year,month,day]=dateMatch[1].length===4?a.slice(0,3):[a[2],a[1],a[0]],hour=a[3],minute=a[4],second=a[5]||0;const date=new Date(Date.UTC(year,month-1,day,hour,minute,second));if(year>=2020&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day&&hour<24&&minute<60&&second<60&&Math.abs(offset)<=840&&(!zone||zone==='z'||Number(zone.slice(-2))<60))occurredAt=new Date(date.getTime()-offset*60000).toISOString();}
 const tail=pattern=>{for(let i=0;i<lines.length;i++)if(pattern.test(lines[i])){const next=lines[i+1]||'',valueOnly=/^\s*[+*•x\d][\d*•x +()-]{3,}\s*$/u.test(next)||/^(?:kart|card|hesab|account|telefon|phone)\s*[:*•\d+]/u.test(next);const line=lines[i]+(valueOnly?' '+next:'');const masked=line.match(/(?:\d{4}[\s*•x-]+(?:[\d*•x -]{0,25}))?(?:[*•x]{2,}[\s*•x-]*)(\d{4})\b/u);if(masked)return masked[1];const card=line.match(/\b(?:\d[ -]?){11,18}\d\b/u);if(card)return card[0].replace(/\D/g,'').slice(-4);const ending=line.match(/(?:son\s*(?:4|dord)|ending|last\s*4|hesab|account|kart|card|telefon|phone)[^\d\n]{0,20}(\d{4})\b/u);if(ending)return ending[1];}return null;};
 const bank=RECEIPT_PROFILES.find(p=>p.pattern.test(t));const unsuccessful=/ugursuz|legv\s*(?:edil|olun)|gozlemede|pending|failed|declined|cancelled|canceled|неуспеш|отмен|ожидан/u.test(t);const successful=!unsuccessful&&/ugurl[aou]|tamamlan|odenildi|successful|success\b|completed|paid\b|успеш|оплачен/u.test(t);
 return {bank:bank?.id||null,bankName:bank?.name||null,profile:bank?.kind||'unknown',amountCents:amount,currency:/\bazn\b|₼|\bmanat\b/u.test(t)?'AZN':null,occurredAt,reference:ref&&!/^(notfound|unknown|undefined|null|none|yoxdur|tapilmadi|sendercard|recipientcard|amount|mebleg|date|tarix|gonderen|alankart|hesab)$/u.test(ref)?ref:null,recipientLast4:tail(/alan|recipient|receiver|qebul\s*eden|destin|получател/u),senderLast4:tail(/gonderen|sender|отправител/u),successful,unsuccessful};
}
export function classifyReceipt(analysis,context){
 const text=String(analysis?.text||''),fields=extractReceiptFields(text),reasons=[],riskReasons=[],checks={},quality=analysis?.pages?.[0]?.quality||{};let risk=0;
 const add=code=>{if(!reasons.includes(code))reasons.push(code);},riskAdd=(code,n)=>{if(!riskReasons.includes(code)){riskReasons.push(code);risk+=n;}};
 // QR contents are parsed locally; URLs are NEVER opened or fetched.
 for(const page of analysis?.pages||[]){if(!page.qr)continue;let data;try{data=JSON.parse(page.qr);}catch{try{const u=new URL(page.qr);data=Object.fromEntries(u.searchParams);}catch{continue;}}
  if(!data||typeof data!=='object')continue;const ref=String(data.transactionId||data.reference||data.receiptId||data.documentNumber||'').toLowerCase().replace(/ /g,'');
  if(/^[a-z0-9/_-]{6,64}$/.test(ref)){if(fields.reference&&fields.reference!==ref)riskAdd('TEXT_LAYER_CONFLICT',65);else if(!fields.reference){fields.reference=ref;riskAdd('QR_REFERENCE_ONLY',35);}}
 }
 if(quality.tooSmall||quality.brightness<22&&quality.contrast<20||quality.contrast<4||quality.edgeEnergy<2&&analysis.confidence<45)add('UNREADABLE');
 if(analysis.ocrStatus!=='ok'){riskAdd('OCR_UNAVAILABLE',50);return {version:1,status:reasons.length?'rejected':'manual_review',fields,checks,riskScore:50,riskReasons,reasons,ocrConfidence:0};}
 const t=fold(text),known=!!fields.bank,confidence=Number(analysis.confidence)||0;
 const evidence=[fields.amountCents!==null,!!fields.occurredAt,!!fields.reference,fields.successful,!!fields.recipientLast4].filter(Boolean).length;
 const documentTerms=(t.match(/qebz|emeliyyat|odenis|transaction|receipt|payment|reference|\brrn\b|transfer|kocurme|istinad|авторизац|платеж/gu)||[]).length;
 const social=/^\s*(whatsapp|instagram|tiktok)\s*$/mu.test(t)||(/\b(instagram|tiktok|whatsapp)\b/u.test(t)&&/likes|followers|messages|izleyici|beyenme|mesajlar|story|reels/u.test(t));
 const uncertainDocument=confidence<65&&analysis.pages?.some(p=>p.documentLike===true);
 const candidate=documentTerms>=1&&evidence>=2||known&&evidence>=3||documentTerms>=3||uncertainDocument;
 if(social)add('SOCIAL_SCREEN');else if(!candidate)add('NOT_RECEIPT');
 if(candidate){
  if(fields.amountCents===null)add('MISSING_AMOUNT');if(!fields.currency)add('MISSING_CURRENCY');if(!fields.occurredAt)add('MISSING_DATE');if(!fields.reference)add('MISSING_REFERENCE');
  if(fields.unsuccessful)add('UNSUCCESSFUL');else if(!fields.successful&&fields.profile!=='terminal')add('MISSING_SUCCESS');
  if(!fields.recipientLast4&&fields.profile==='card')add('MISSING_RECIPIENT');
  checks.amount=fields.amountCents===context.amountCents;checks.recipient=fields.recipientLast4?fields.recipientLast4===context.last4:null;
  if(fields.amountCents!==null&&!checks.amount)add('WRONG_AMOUNT');if(checks.recipient===false)add('WRONG_RECIPIENT');
  if(fields.occurredAt){const time=Date.parse(fields.occurredAt),now=context.now||Date.now(),created=Date.parse(context.createdAt);checks.date=time<=now+300000&&time>=created-24*3600000;if(time>now+300000)add('FUTURE_DATE');else if(time<created-24*3600000)add('OLD_DATE');}
 }
 if(!known&&candidate)riskAdd('UNKNOWN_FORMAT',35);if(confidence<65)riskAdd('LOW_CONFIDENCE',35);
 if(fields.profile==='terminal'&&!fields.recipientLast4)riskAdd('UNKNOWN_FORMAT',25);
 if(fields.profile==='wallet'&&!fields.recipientLast4)riskAdd('UNKNOWN_FORMAT',25);
 if(analysis.pdfText){const pdf=extractReceiptFields(analysis.pdfText);checks.pdfTextLayer=true;if(pdf.amountCents!==null&&fields.amountCents!==null&&pdf.amountCents!==fields.amountCents||pdf.reference&&fields.reference&&pdf.reference!==fields.reference||pdf.recipientLast4&&fields.recipientLast4&&pdf.recipientLast4!==fields.recipientLast4)riskAdd('TEXT_LAYER_CONFLICT',65);}
 const numeric=(analysis.words||[]).filter(w=>/\d/.test(w.text)&&w.confidence>75);for(const w of numeric){if(w.left<=2||w.top<=2)riskAdd('EDGE_CONTENT',15);const peers=numeric.filter(v=>Math.abs(v.top-w.top)<Math.max(v.height,w.height)/3&&v!==w);if(peers.some(v=>Math.max(v.height,w.height)>Math.min(v.height,w.height)*2.5))riskAdd('MIXED_NUMERALS',20);}
 if(analysis.pages?.some(p=>p.compressionAnomaly>4))riskAdd('COMPRESSION_PATCHES',20);
 // A spelled-out/localized date in a convincing new layout is a parser limitation,
 // not evidence of fraud. Keep it for human review rather than destroying it.
 const newDateFormat=known&&evidence>=3&&!fields.occurredAt&&/(?:date|tarix)[\s:]*\d{1,2}\s+[a-z]{3,}\s+\d{4}/u.test(t);
 if(newDateFormat)riskAdd('UNKNOWN_FORMAT',35);
 // Unknown designs / low-confidence OCR do not justify an automatic fraud verdict.
 const hard=reasons.filter(c=>!(newDateFormat&&c==='MISSING_DATE')&&(['SOCIAL_SCREEN','NOT_RECEIPT','UNREADABLE'].includes(c)||confidence>=65&&(known||['WRONG_AMOUNT','WRONG_RECIPIENT','FUTURE_DATE','OLD_DATE','UNSUCCESSFUL'].includes(c))));
 const status=hard.length?'rejected':reasons.length||risk>=30?'manual_review':'technical_pass';
 return {version:1,status,fields,checks,riskScore:Math.min(100,risk),riskReasons,reasons,ocrConfidence:Math.round(confidence),qrPresent:analysis.pages?.some(p=>!!p.qr)||false,pdfTextLayerPresent:!!analysis.pdfText};
}
export function receiptFingerprints(report,receipt,analysis,hmac){
 const f=report.fields,keys=[{kind:'sha256',key:receipt.sha256}];
 if(f.bank&&f.reference&&report.ocrConfidence>=65){const ref=[f.bank,f.reference];if(f.reference.length<8)ref.push(f.occurredAt?.slice(0,10),f.recipientLast4,f.amountCents);keys.push({kind:'reference',key:hmac('receipt-reference-v1:'+ref.join('|'))});}
 const combination=f.bank&&f.amountCents!==null&&f.occurredAt&&f.recipientLast4?hmac('receipt-combination-v1:'+JSON.stringify([f.bank,f.amountCents,f.occurredAt,f.recipientLast4])):null;
 const similarity=f.bank&&f.amountCents!==null&&f.occurredAt&&f.recipientLast4?hmac('receipt-similarity-v1:'+JSON.stringify([f.bank,f.amountCents,f.occurredAt.slice(0,10),f.recipientLast4])):null;
 return {keys,combination,similarity,phash:/^[a-f0-9]{16}$/.test(analysis?.pages?.[0]?.phash||'')?analysis.pages[0].phash:null};
}
export function receiptFailure(report){return Object.assign(Error(RECEIPT_REJECT_MESSAGE+' '+report.reasons.map(c=>RECEIPT_REASONS[c]||'Qəbz yoxlanılmadı').join('. ')),{status:422,code:'RECEIPT_NOT_RECOGNIZED',reasonCodes:report.reasons});}
