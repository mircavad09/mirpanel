// Receipt presence only. Never compares payment data or marks a payment verified.
import {extractReceiptFields} from './receipt-policy.mjs';
export const SHAPE_ERROR='Çek yüklənmədi. Zəhmət olmasa, düzgün çek yükləyin.';
export const SHAPE_SUCCESS='Çek uğurla yükləndi. Məlumatlar serverə ötürüldü.';
const fold=s=>String(s||'').normalize('NFKC').toLocaleLowerCase('az').replace(/[əıöüşçğ]/g,c=>({'ə':'e','ı':'i','ö':'o','ü':'u','ş':'s','ç':'c','ğ':'g'}[c]));
export function receiptShape(analysis){
 const t=fold([analysis?.text,analysis?.pdfText].filter(Boolean).join('\n')),f=extractReceiptFields(t);
 const terms=new Set(t.match(/qebz|receipt|odenis|payment|emeliyyat|transaction|kocurme|transfer|istinad|reference|\brrn\b|чек|платеж/gu)||[]).size;
 const evidence=[f.amountCents!==null,!!f.occurredAt,!!f.reference,!!f.recipientLast4,f.successful||f.unsuccessful].filter(Boolean).length;
 const documentLike=analysis?.pages?.some(p=>p.documentLike===true),bank=!!f.bank;
 const chat=/\bwhatsapp\b|\bmessages\b|\bmesajlar\b|\btyping\b/u.test(t);
 const strong=terms>=2&&evidence>=1||terms>=1&&evidence>=3||bank&&terms>=1&&evidence>=1;
 const partial=documentLike&&(bank&&terms>=1||terms>=2)&&!chat;
 // A WhatsApp frame around a real receipt is allowed; chat-only screenshots are not.
 const accepted=strong||partial;
 if(!accepted&&analysis?.ocrStatus!=='ok'&&!analysis?.pdfText)throw Object.assign(Error('Çek yoxlama xidməti cavab vermədi. Yenidən cəhd edin.'),{status:503,code:'RECEIPT_VALIDATOR_UNAVAILABLE'});
 return {accepted,version:1};
}
