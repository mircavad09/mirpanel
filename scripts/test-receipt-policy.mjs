import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';
import {classifyReceipt,extractReceiptFields,receiptFingerprints,receiptFailure,RECEIPT_GUIDANCE} from '../mirpanel-admin/receipt-policy.mjs';
import {inspectDocument} from '../receipt-worker/engine.mjs';
import {receiptFromBuffer} from '../mirpanel-admin/payment-security.mjs';
import {imageReceipt,pdfReceipt,randomImage,context,receiptLines} from './receipt-synthetic-fixtures.mjs';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../receipt-worker/package.json',import.meta.url))('sharp');
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},ok=(a,m)=>{assert.ok(a,m);checks++;},rejects=async(fn,re)=>{await assert.rejects(fn,re);checks++;};
const artifacts='payment-test-artifacts/receipt-validation';fs.mkdirSync(artifacts,{recursive:true});
const observations=[];async function classify(name,buffer,mime,expected){const analysis=await inspectDocument(buffer,mime),report=classifyReceipt(analysis,context);observations.push({name,expected,status:report.status,confidence:report.ocrConfidence,reasons:report.reasons,risk:report.riskReasons});console.log(JSON.stringify(observations.at(-1)));eq(analysis.ocrStatus,'ok',name+' actual OCR available');return{analysis,report};}
const banks=['Birbank','Yelo Bank','Rabitebank','m10','eManat','ABB','LeoBank'];let first;
for(const bank of banks){const r=await classify(bank,await imageReceipt(bank), 'image/png','receipt');ok(r.report.status!=='rejected',bank);eq(r.report.fields.amountCents,1999,bank);eq(r.report.fields.recipientLast4,'4655',bank);ok(r.report.fields.reference,bank);if(bank==='Birbank')first=r;}
for(const [name,lines] of [
 ['Azerbaijani Rabitebank',['SYNTHETIC TEST ONLY','Rabitəbank','Ödəniş qəbzi','Uğurla tamamlandı','Məbləğ: 19.99 AZN','Tarix: 25.10.2026 14:00:00','Əməliyyat nömrəsi: SYNTHAZ20260001','Alan kart: **** 4655']],
 ['m10 wallet',['SYNTHETIC TEST ONLY','m10','Payment receipt','Payment successful','Amount: 19.99 AZN','Date: 25.10.2026 14:00:00','Reference: SYNTHM10260001','Recipient phone: +994 50 000 4655']],
 ['eManat terminal',['SYNTHETIC TEST ONLY','eManat','Payment receipt','Amount: 19.99 AZN','Date: 25.10.2026 14:00:00','Receipt No: SYNTHEMANAT0001','Recipient card: **** 4655']],
 ['split amount label',['SYNTHETIC TEST ONLY','Yelo Bank','Payment receipt','Successful','Amount:','19.99 AZN','Date: 25.10.2026 14:00:00','Transaction ID: SYNTHSPLIT0001','Recipient card: **** 4655']]
 ]){const r=await classify(name,await imageReceipt('',{lines}),'image/png','receipt');ok(r.report.status!=='rejected',name);eq(r.report.fields.amountCents,1999);}
const qr=await classify('QR receipt',await imageReceipt('Birbank',{qr:JSON.stringify({transactionId:'SYNTH202610250001'})}),'image/png','receipt');eq(qr.report.qrPresent,true);ok(qr.report.status!=='rejected');
const jpeg=await imageReceipt('Birbank',{},'image/jpeg');eq((await classify('JPEG',jpeg,'image/jpeg','receipt')).report.status!=='rejected',true);
const pdf=pdfReceipt();fs.writeFileSync(artifacts+'/synthetic-bank.pdf',pdf);const pdfr=await classify('bank PDF',pdf,'application/pdf','receipt');eq(pdfr.report.status!=='rejected',true);eq(pdfr.report.pdfTextLayerPresent,true);
for(const [name,changes,reason] of [
 ['wrong amount',{amount:'9.99'},'WRONG_AMOUNT'],['wrong card',{last4:'9999'},'WRONG_RECIPIENT'],['old',{date:'20.10.2026 14:00:00'},'OLD_DATE'],['future',{date:'30.10.2026 14:00:00'},'FUTURE_DATE'],['failed',{status:'Transaction failed'},'UNSUCCESSFUL'],['pending',{status:'Transaction pending'},'UNSUCCESSFUL'],['cancelled',{status:'Transaction cancelled'},'UNSUCCESSFUL'],['missing amount',{omit:[4]},'MISSING_AMOUNT'],['missing ref',{omit:[6]},'MISSING_REFERENCE'],['missing date',{omit:[5]},'MISSING_DATE'],['cropped',{crop:true},'MISSING_DATE']
 ]){const r=await classify(name,await imageReceipt('Birbank',changes),'image/png','reject');eq(r.report.status,'rejected',name);ok(r.report.reasons.includes(reason),name);}
for(const [name,buffer] of [['random photo',await randomImage()],['WhatsApp screen',await imageReceipt('',{lines:['WhatsApp','Messages','Family group','Hello!','Profile photo','Today 14:00']})],['card only',await imageReceipt('ABB',{lines:['ABB','Bank card','**** 4655','TEST CARD ONLY']})],['dark',await imageReceipt('Birbank',{dark:true})],['blurred',await imageReceipt('Birbank',{blur:25})]]){const r=await classify(name,buffer,'image/png','reject');eq(r.report.status,'rejected',name);}
const novel=await classify('new bank design',await imageReceipt('Example New Bank'),'image/png','receipt');eq(novel.report.status,'manual_review');
const localized=await classify('known bank new date layout',await imageReceipt('Yelo Bank',{date:'25 October 2026 14:00:00'}),'image/png','receipt');eq(localized.report.status,'manual_review');
const shopping=await classify('ordinary price screenshot',await imageReceipt('',{lines:['SYNTHETIC TEST ONLY','Autumn collection','Price: 19.99 AZN','25.10.2026 14:00:00','Shoes and accessories','Visit our store'] }),'image/png','reject');eq(shopping.report.status,'rejected');
const unavailable=await inspectDocument(await imageReceipt(), 'image/png',{modelPath:artifacts+'/missing-models'});eq(unavailable.ocrStatus,'unavailable');eq(classifyReceipt(unavailable,context).status,'manual_review');
const unfamiliarText={...first.analysis,text:'Unrecognized document characters',confidence:25};eq(unfamiliarText.pages[0].documentLike,true);eq(classifyReceipt(unfamiliarText,context).status,'manual_review');
const exact={sha256:crypto.createHash('sha256').update(jpeg).digest('hex')},hmac=v=>crypto.createHmac('sha256','synthetic-fingerprint-secret').update(v).digest('hex'),fp=receiptFingerprints(first.report,exact,first.analysis,hmac);
for(const [name,b] of [['recompressed',await sharp(jpeg).jpeg({quality:55}).toBuffer()],['border cropped',await sharp(jpeg).extract({left:25,top:25,width:1050,height:1125}).png().toBuffer()]]){const r=await classify(name,b,name==='recompressed'?'image/jpeg':'image/png','receipt'),other=receiptFingerprints(r.report,{sha256:crypto.createHash('sha256').update(b).digest('hex')},r.analysis,hmac);eq(other.keys.find(k=>k.kind==='reference')?.key,fp.keys.find(k=>k.kind==='reference')?.key,name+' same operation fingerprint');ok(other.keys[0].key!==fp.keys[0].key);}
const fake={...first.analysis,pdfText:receiptLines('Birbank',{amount:'99.99'}).join('\n')};const conflict=classifyReceipt(fake,context);eq(conflict.status,'manual_review');ok(conflict.riskReasons.includes('TEXT_LAYER_CONFLICT'));
const edited=classifyReceipt({...first.analysis,pages:first.analysis.pages.map(p=>({...p,compressionAnomaly:9})),words:[{left:1,top:1,width:1,height:10,confidence:99,text:'19'},{left:100,top:1,width:1,height:30,confidence:99,text:'99'}]},context);ok(edited.riskReasons.includes('COMPRESSION_PATCHES'));ok(edited.riskReasons.includes('MIXED_NUMERALS'));ok(edited.status!=='rejected');
await rejects(()=>inspectDocument(Buffer.concat([jpeg,Buffer.from('PK\x03\x04')]),'image/jpeg'),/POLYGLOT/);
await rejects(()=>inspectDocument(Buffer.concat([pdf,Buffer.from('\n/JavaScript (malicious fixture)\n%%EOF')]),'application/pdf'),/ACTIVE_CONTENT/);
assert.throws(()=>receiptFromBuffer(Buffer.concat([pdf,Buffer.alloc(1100000,32),Buffer.from('/#4a#53 (malicious fixture)\n%%EOF')]),'application/pdf'),/Aktiv məzmun/);checks++;
await rejects(()=>inspectDocument(Buffer.from('not a PDF file at all'),'application/pdf'),/PDF_INVALID/);
await rejects(()=>inspectDocument(Buffer.alloc(5*1024*1024+1),'image/png'),/TOO_LARGE/);
await rejects(()=>inspectDocument(jpeg,'image/png'),/IMAGE_INVALID/);
const bomb=Buffer.from(await imageReceipt());bomb.writeUInt32BE(100000,16);bomb.writeUInt32BE(100000,20);await rejects(()=>inspectDocument(bomb,'image/png'),/DECODE|DIMENSIONS/);
eq(extractReceiptFields(receiptLines().join('\n')).senderLast4,'0000');ok(RECEIPT_GUIDANCE.includes('tam ödəniş qəbzini'));eq(receiptFailure({reasons:['MISSING_AMOUNT']}).status,422);
eq(extractReceiptFields('Date: 2026-10-25T10:00:00Z').occurredAt,context.createdAt);eq(extractReceiptFields('Date: 2026-10-25T14:00:00+04:00').occurredAt,context.createdAt);
eq(extractReceiptFields('Recipient card:\nTransaction ID: 12345678901234').recipientLast4,null);eq(extractReceiptFields('Transaction ID:\nSender card: **** 0000').reference,null);
const positive=observations.filter(o=>o.expected==='receipt'),negative=observations.filter(o=>o.expected==='reject');const metrics={scope:'synthetic corpus only; NOT a measured real-bank fraud accuracy',receipts:positive.length,nonReceiptsOrInvalid:negative.length,falsePositiveRejects:positive.filter(o=>o.status==='rejected').length,falseNegativeAccepts:negative.filter(o=>o.status!=='rejected').length,manualReviews:observations.filter(o=>o.status==='manual_review').length};
fs.writeFileSync(artifacts+'/policy-results.json',JSON.stringify({checks,metrics,observations},null,2));console.log(JSON.stringify({ok:true,checks,metrics,productionWrites:0},null,2));
