import PDFDocument from 'pdfkit';
import {fileURLToPath} from 'node:url';
export const documentMoney=(c,currency='AZN')=>c===null?'Məlumat saxlanmayıb':(c/100).toFixed(2).replace('.',',')+' '+(currency==='AZN'?'₼':currency);
const date=x=>x&&!isNaN(Date.parse(x))?new Intl.DateTimeFormat('az-AZ',{timeZone:'Asia/Baku',dateStyle:'short',timeStyle:'short'}).format(new Date(x))+' · Bakı vaxtı':'Məlumat saxlanmayıb';
export async function orderDocumentPDF(data){
 const doc=new PDFDocument({size:'A4',margins:{top:48,bottom:52,left:48,right:48},bufferPages:true,info:{Title:data.title,Author:'MirPanel',CreationDate:new Date(data.createdAt)}}),chunks=[];
 const done=new Promise((resolve,reject)=>{doc.on('data',x=>chunks.push(x));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 doc.registerFont('regular',fileURLToPath(new URL('./document-fonts/NotoSans-Regular.ttf',import.meta.url)));doc.registerFont('bold',fileURLToPath(new URL('./document-fonts/NotoSans-Bold.ttf',import.meta.url)));
 const body=(s,{bold=false,color='#263238',size=10}={})=>{doc.font(bold?'bold':'regular').fontSize(size).fillColor(color).text(String(s),{lineGap:3,paragraphGap:6});};
 const heading=s=>{if(doc.y>doc.page.height-110)doc.addPage();doc.moveDown(.7);body(s,{bold:true,size:12,color:'#735500'});};
 body(data.title,{bold:true,size:19,color:'#171717'});doc.moveDown(.6);
 body('Sənəd № '+data.number+'\nSifariş № '+data.orderCode,{bold:true});body('Sifariş tarixi: '+date(data.createdAt));body('Müştəri: '+data.customer.name+' · '+data.customer.email);
 body(data.acceptedAt?'Şərtlərin qəbul vaxtı: '+date(data.acceptedAt):'Qəbul edilmiş şərtlərin tarixçəsi mövcud deyil');
 heading('1. Sifariş detalları');
 for(const [i,x]of data.lines.entries()){
  if(doc.y>doc.page.height-155)doc.addPage();body((i+1)+'. '+x.title,{bold:true,size:11});body('Paket: '+x.plan+'\nSay: '+x.quantity+' · Vahid qiymət: '+documentMoney(x.unitCents,data.currency)+'\nSətir cəmi: '+documentMoney(x.totalCents,data.currency));
  if(x.duration)body('Müddət: '+x.duration);if(x.warranty)body('Zəmanət: '+x.warranty);
 }
 body('Faktiki ödənilmiş məbləğ: '+documentMoney(data.totalCents,data.currency),{bold:true,size:12});body('Ödəniş üsulu: '+data.paymentMethod);if(data.feeNote)body(data.feeNote);
 for(const section of data.sections){heading(section.title);for(const p of section.paragraphs)body(p);for(const a of section.links){doc.font('regular').fontSize(10).fillColor('#1463b8').text(a.label,{link:a.url,underline:true,paragraphGap:7});}}
 doc.moveDown();body(data.disclaimer,{size:9,color:'#59656b'});
 const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.font('regular').fontSize(8).fillColor('#778087').text('MirPanel · '+data.number+'     '+(i+1)+' / '+pages.count,48,doc.page.height-34,{lineBreak:false});}
 doc.end();return done;
}
