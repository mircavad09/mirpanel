import {createHash} from 'node:crypto';
import {receiptFromBuffer} from '../payment-security.mjs';
const fail=message=>Object.assign(Error(message),{status:400});
export function supportFile(input){
 if(!input||typeof input.base64!=='string'||input.base64.length>6990512||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64))throw fail('JPG, PNG və ya PDF seçin; maksimum 5 MB.');
 const bytes=Buffer.from(input.base64,'base64');if(bytes.toString('base64')!==input.base64)throw fail('Fayl məlumatı düzgün deyil.');
 const file=receiptFromBuffer(bytes,input.mime,5*1024*1024),name=String(input.name||'fayl').replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,160);
 if(file.mimeType==='application/pdf'){
  const data=bytes.toString('latin1').replace(/#([a-f0-9]{2})/ig,(_,hex)=>String.fromCharCode(parseInt(hex,16)));if(!data.trimEnd().endsWith('%%EOF')||/\/(JavaScript|JS|Launch|OpenAction|AA|EmbeddedFile|RichMedia|XFA)\b/i.test(data))throw fail('Aktiv məzmunlu və ya natamam PDF qəbul edilmir.');
 }else if(file.mimeType==='image/png'&&!bytes.subarray(-12).equals(Buffer.from('0000000049454e44ae426082','hex')))throw fail('PNG faylı natamamdır.');
 else if(file.mimeType==='image/jpeg'&&(bytes.at(-2)!==255||bytes.at(-1)!==217))throw fail('JPG faylı natamamdır.');
 return {bytes,mime:file.mimeType,name,sha:createHash('sha256').update(bytes).digest('hex')};
}
