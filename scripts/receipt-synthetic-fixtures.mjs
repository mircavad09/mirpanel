// Deliberately synthetic: no customers, live cards, real payments or bank assets.
import {createCanvas} from '../receipt-worker/node_modules/@napi-rs/canvas/index.js';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../receipt-worker/package.json',import.meta.url))('sharp');
const QRCode=createRequire(new URL('../receipt-worker/package.json',import.meta.url))('qrcode');
export const receiptTime='2026-10-25T10:00:00.000Z';
export const context={amountCents:1999,last4:'4655',createdAt:receiptTime,now:Date.parse(receiptTime)+60000};
export function receiptLines(bank='Birbank',changes={}){
 return ['SYNTHETIC - NOT A REAL PAYMENT',bank,'Payment receipt',changes.status||'Transaction successful',
  `Amount: ${changes.amount||'19.99'} AZN`,`Date: ${changes.date||'25.10.2026 14:00:00'}`,
  `Transaction ID: ${changes.reference||'SYNTH202610250001'}`,'Sender card: **** 0000',`Recipient card: **** ${changes.last4||'4655'}`,'Test fixture only'].filter((_,i)=>!(changes.omit||[]).includes(i));
}
export async function imageReceipt(bank='Birbank',changes={},mime='image/png'){
 const lines=changes.lines||receiptLines(bank,changes),canvas=createCanvas(1100,1200),c=canvas.getContext('2d');
 c.fillStyle=changes.dark?'#030303':'#fff';c.fillRect(0,0,1100,1200);c.fillStyle=changes.dark?'#050505':'#111';c.font='34px Arial';
 for(let i=0;i<lines.length;i++)c.fillText(lines[i],55,85+i*85);
 let b=await canvas.encode('png');if(changes.qr)b=await sharp(b).composite([{input:await QRCode.toBuffer(changes.qr,{width:240,margin:1}),top:930,left:800}]).png().toBuffer();if(changes.blur)b=await sharp(b).blur(changes.blur).png().toBuffer();
 if(changes.crop)b=await sharp(b).extract({left:0,top:0,width:1100,height:500}).png().toBuffer();
 return mime==='image/jpeg'?sharp(b).jpeg({quality:changes.quality||90}).toBuffer():b;
}
export function pdfReceipt(bank='Yelo Bank',changes={}){
 const lines=receiptLines(bank,changes);const stream='BT /F1 17 Tf 36 750 Td '+lines.map((s,i)=>(i?'0 -45 Td ':'')+'('+s.replace(/[()\\]/g,'\\$&')+') Tj').join('\n')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let out='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;});const start=Buffer.byteLength(out);out+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${start}\n%%EOF\n`;return Buffer.from(out);
}
export async function randomImage(){const canvas=createCanvas(900,900),c=canvas.getContext('2d');c.fillStyle='#28649b';c.fillRect(0,0,900,900);c.fillStyle='#e3bd8c';c.beginPath();c.arc(450,330,160,0,7);c.fill();c.fillStyle='#223344';c.fillRect(200,530,500,370);return canvas.encode('png');}
