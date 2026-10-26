import assert from 'node:assert/strict';
import {receiptFromBuffer} from '../mirpanel-admin/payment-security.mjs';
import {validateReceiptFile} from '../mirpanel-admin/receipt-file-safety.mjs';
import {imageReceipt,randomImage,pdfReceipt} from './receipt-synthetic-fixtures.mjs';
let checks=0;
const jpg=await imageReceipt('SYNTHETIC',{},'image/jpeg'),png=await randomImage();
// Legal trailing whitespace is accepted by normal image decoders. The old
// safety worker incorrectly demanded EOI/IEND at the absolute end of the file.
for(const [name,bytes,mime] of [
 ['mobile JPEG trailing newline',Buffer.concat([jpg,Buffer.from('\r\n')]),'image/jpeg'],
 ['PNG trailing whitespace',Buffer.concat([png,Buffer.from('\n')]),'image/png'],
 ['legacy JPEG MIME',jpg,'image/pjpeg'],['legacy PNG MIME',png,'image/x-png'],
 ['empty MIME',jpg,''],['generic MIME',png,'application/octet-stream'],
 ['browser MIME differs from detected image',png,'image/jpeg'],
 ['safe PDF',pdfReceipt(),'application/pdf']
]){const receipt=receiptFromBuffer(bytes,mime);await assert.doesNotReject(()=>validateReceiptFile(receipt),name);checks++;}
const atLimit=Buffer.concat([jpg,Buffer.alloc(5*1024*1024-jpg.length,32)]);
await assert.doesNotReject(()=>validateReceiptFile(receiptFromBuffer(atLimit,'image/jpeg')));checks++;
assert.throws(()=>receiptFromBuffer(Buffer.concat([atLimit,Buffer.from(' ')]),'image/jpeg'),e=>e.status===413);checks++;
for(const [bytes,mime]of[
 [Buffer.concat([jpg,Buffer.from('<script>bad</script>')]),'image/jpeg'],
 [Buffer.concat([jpg,Buffer.from('PK\x03\x04'),Buffer.from([255,217])]),'image/jpeg'],
 [Buffer.concat([png,Buffer.from('PK\x03\x04'),png.subarray(-12)]),'image/png'],
 [Buffer.concat([pdfReceipt(),Buffer.from('\n/JavaScript evil\n%%EOF')]),'application/pdf'],
 [Buffer.concat([pdfReceipt(),Buffer.from('PK\x03\x04')]),'application/pdf'],
 [Buffer.from('%PDF-1.7\nnot a PDF\n%%EOF'),'application/pdf']
]){await assert.rejects(async()=>validateReceiptFile(receiptFromBuffer(bytes,mime)));checks++;}
assert.throws(()=>receiptFromBuffer(png,'text/html'));checks++;
assert.throws(()=>receiptFromBuffer(Buffer.from('<html>not a JPEG</html>'),'image/jpeg'));checks++;
const source=await import('node:fs');assert.equal(source.readFileSync('receipt-worker/safety-job.mjs','utf8').includes("from './engine.mjs'"),false);checks++;
console.log(JSON.stringify({ok:true,checks,ocrCalls:0,productionWrites:0}));
