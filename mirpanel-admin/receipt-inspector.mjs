import {classifyReceipt,receiptFingerprints,receiptFailure} from './receipt-policy.mjs';
export function readReceiptInspection(value,security){
 if(!value?.report_cipher)return {status:'expired'};
 const report=JSON.parse(security.decryptSecret(value.report_cipher));
 if(value.similar){report.riskReasons=[...new Set([...(report.riskReasons||[]),'SIMILAR_RECEIPT'])];report.riskScore=Math.max(50,report.riskScore||0);}
 return {...report,status:value.status,createdAt:value.created_at};
}
export function createReceiptInspector({config,store,security,analyze}){
 async function worker(receipt){
  if(analyze)return analyze(receipt);
  if(!config.receiptOcrUrl||!config.receiptOcrToken)throw Object.assign(Error('Qəbz yoxlama xidməti hazır deyil. Yenidən cəhd edin.'),{status:503,code:'RECEIPT_VALIDATOR_UNAVAILABLE'});
  const u=new URL(config.receiptOcrUrl);const privateHost=/^(?:localhost|127\.0\.0\.1|receipt-ocr)$/.test(u.hostname)||/^(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(u.hostname)||u.hostname.endsWith('.internal');if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.protocol==='http:'&&!privateHost)throw Object.assign(Error('Qəbz xidməti üçün təhlükəsiz özəl bağlantı tələb olunur.'),{status:503,code:'RECEIPT_VALIDATOR_UNAVAILABLE'});
  let r;try{r=await fetch(new URL('/inspect',u),{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${config.receiptOcrToken}`,'Content-Type':receipt.mimeType},body:receipt.buffer,signal:AbortSignal.timeout(45000)});}catch{throw Object.assign(Error('Qəbz yoxlaması cavab vermədi. Yenidən cəhd edin.'),{status:503,code:'RECEIPT_VALIDATOR_TIMEOUT'});}
  const raw=await r.text();if(raw.length>600000)throw Object.assign(Error('Qəbz yoxlanılmadı.'),{status:503,code:'RECEIPT_VALIDATOR_UNAVAILABLE'});let value;try{value=JSON.parse(raw);}catch{throw Object.assign(Error('Qəbz yoxlanılmadı.'),{status:503,code:'RECEIPT_VALIDATOR_UNAVAILABLE'});}
  if(!r.ok||!value.ok){const rejected=r.status===422;throw Object.assign(Error(rejected?'Fayl təhlükəsiz deyil və ya qəbz oxunmur.':'Qəbz yoxlanılmadı. Yenidən cəhd edin.'),{status:rejected?422:503,code:rejected?'RECEIPT_UNSAFE':'RECEIPT_VALIDATOR_UNAVAILABLE'});}return value.analysis;
 }
 return {async inspect(receipt,reservation,method){
  const cached=await store.receiptInspectionForHash(reservation.id,receipt.sha256);if(cached?.report_cipher){const report=readReceiptInspection(cached,security);if(report.status==='rejected')throw receiptFailure(report);return {id:cached.id,report};}
  const analysis=await worker(receipt);if(!analysis||!Array.isArray(analysis.pages)||analysis.pages.length<1||analysis.pages.length>2||analysis.pages.some(p=>!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width*p.height>20_000_000||Math.max(p.width,p.height)>10000||!['contrast','brightness','edgeEnergy'].every(k=>Number.isFinite(p.quality?.[k])))||!['ok','unavailable'].includes(analysis.ocrStatus))throw Object.assign(Error('Qəbz yoxlanılmadı.'),{status:503,code:'RECEIPT_VALIDATOR_UNAVAILABLE'});
  const report=classifyReceipt(analysis,{amountCents:Math.round(Number(reservation.amount)*100),last4:method.last4,createdAt:reservation.created_at,now:Date.now()});
  const fingerprints=receiptFingerprints(report,receipt,analysis,v=>security.hashToken(v));let saved;
  try{saved=await store.registerReceiptInspection({reservationId:reservation.id,sha256:receipt.sha256,status:report.status,reportCipher:security.encryptSecret(JSON.stringify(report)),...fingerprints});}
  catch(error){if(error.code==='RECEIPT_DUPLICATE'){const failure=receiptFailure({reasons:['DUPLICATE']});failure.status=409;failure.code='RECEIPT_DUPLICATE';throw failure;}throw error;}
  if(!['technical_pass','manual_review','rejected'].includes(saved.status))throw Object.assign(Error('Qəbzin yoxlama nəticəsi təsdiqlənmədi.'),{status:503,code:'RECEIPT_VALIDATOR_UNAVAILABLE'});
  report.status=saved.status;
  if(saved.similar){report.riskReasons.push('SIMILAR_RECEIPT');report.riskScore=Math.max(50,report.riskScore);}
  if(report.status==='rejected')throw receiptFailure(report);return {id:saved.id,report};
 },async read(order){if(!order.receipt_inspection_id)return {status:'legacy',paymentVerified:false};const value=await store.receiptInspection(order.receipt_inspection_id),rows=store.receiptInspectionHistory?await store.receiptInspectionHistory(order.reservation_id):[];return {...readReceiptInspection(value,security),attempts:rows.map(v=>readReceiptInspection(v,security)),paymentVerified:!!order.bank_credit_verified_at};}};
}
