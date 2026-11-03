// Dedicated file-safety boundary. No OCR, bank profiles or content classifier.
import sharp from 'sharp';
import {DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
sharp.concurrency(1);sharp.cache(false);
const MAX_PIXELS=20_000_000,MAX_SIDE=10000;
const unsafe=code=>{throw Object.assign(Error(code),{code});};
const whitespace=b=>b.every(x=>[0,9,10,13,32].includes(x));
// Samsung SEF is indexed metadata AFTER JPEG EOI / PNG IEND. Validate every
// offset and block boundary, then discard it. A SEFT string alone is not safe.
function safeImageTail(buffer,end,mpf){
 const tail=buffer.subarray(end);if(whitespace(tail))return{clean:buffer.subarray(0,end),canonicalSize:buffer.length};
 if(mpf)return validateMpfTail(buffer,end,mpf);
 if(tail.length>262144||tail.length<32||buffer.subarray(-4).toString('ascii')!=='SEFT')unsafe('RECEIPT_POLYGLOT');
 const length=buffer.readUInt32LE(buffer.length-8),dir=buffer.length-8-length;
 if(length<12||length>65536||dir<end||buffer.subarray(dir,dir+4).toString('ascii')!=='SEFH')unsafe('RECEIPT_POLYGLOT');
 const version=buffer.readUInt32LE(dir+4),count=buffer.readUInt32LE(dir+8);
 if(version<100||version>110||count<1||count>128||12+count*12!==length)unsafe('RECEIPT_POLYGLOT');
 const ranges=[];
 for(let n=0;n<count;n++){
  const p=dir+12+n*12,back=buffer.readUInt32LE(p+4),size=buffer.readUInt32LE(p+8),start=dir-back;
  if(size<9||back<size||start<end||start+size>dir||buffer.readUInt32LE(start)!==buffer.readUInt32LE(p))unsafe('RECEIPT_POLYGLOT');
  const names=buffer.readUInt32LE(start+4);if(names<1||names>128||8+names>size||!/^[-A-Za-z0-9_. ]+$/.test(buffer.subarray(start+8,start+8+names).toString('latin1')))unsafe('RECEIPT_POLYGLOT');
  ranges.push([start,start+size]);
 }
 ranges.sort((a,b)=>a[0]-b[0]);let cursor=end;
 for(const[start,stop]of ranges){if(start<cursor||!whitespace(buffer.subarray(cursor,start)))unsafe('RECEIPT_POLYGLOT');cursor=stop;}
 if(!whitespace(buffer.subarray(cursor,dir)))unsafe('RECEIPT_POLYGLOT');
 return{clean:buffer.subarray(0,end),canonicalSize:end};
}
// MPF offsets are relative to the APP2 TIFF header, not the JPEG SOI. Only
// indexed, contiguous, fully decodable JPEG auxiliaries are discarded. An
// arbitrary appended JPEG/payload or a forged MPF string is never sufficient.
function validateMpfTail(buffer,end,{base,stop}){
 const bad=()=>unsafe('RECEIPT_POLYGLOT');
 const endian=buffer.subarray(base,base+2).toString('ascii');if(!['II','MM'].includes(endian)||base+8>stop)bad();
 const u16=p=>{if(p<base||p+2>stop)bad();return endian==='II'?buffer.readUInt16LE(p):buffer.readUInt16BE(p);};
 const u32=p=>{if(p<base||p+4>stop)bad();return endian==='II'?buffer.readUInt32LE(p):buffer.readUInt32BE(p);};
 if(u16(base+2)!==42)bad();const ifd=base+u32(base+4),tags=u16(ifd);if(tags<2||tags>64||ifd+2+tags*12+4>stop)bad();
 let count,entry,entryBytes;
 for(let n=0;n<tags;n++){const p=ifd+2+n*12,id=u16(p);if(id===0xb001){if(count!==undefined||u16(p+2)!==4||u32(p+4)!==1)bad();count=u32(p+8);}if(id===0xb002){if(entry!==undefined||u16(p+2)!==7)bad();entryBytes=u32(p+4);entry=base+u32(p+8);}}
 if(!count||count<2||count>3||entryBytes!==count*16||entry<ifd+2+tags*12+4||entry+entryBytes>stop||u32(ifd+2+tags*12)!==0)bad();
 if(u32(entry+8)!==0||u32(entry+4)!==end)bad();
 const auxiliaries=[];let cursor=end;
 for(let n=1;n<count;n++){const p=entry+n*16,attributes=u32(p),size=u32(p+4),start=base+u32(p+8);if((attributes>>>24&7)!==0||size<12||start<cursor||start+size>buffer.length||!whitespace(buffer.subarray(cursor,start)))bad();
  const image=buffer.subarray(start,start+size);let parsed;try{parsed=imageEnd(image,'image/jpeg');}catch{bad();}
  if(parsed.canonicalSize!==size||parsed.mpf||parsed.clean.length!==size)bad();auxiliaries.push(image);cursor=start+size;
 }
 if(!whitespace(buffer.subarray(cursor)))bad();return{clean:buffer.subarray(0,end),canonicalSize:end,mpf:true,auxiliaries};
}
const resourceFailure=error=>/ENOMEM|allocation|out of memory|memory limit|thread.*(?:create|start)|resource temporarily unavailable/i.test(String(error?.code||'')+' '+String(error?.message||''));
function decodeFailure(error){
 if(resourceFailure(error))unsafe('RECEIPT_PROCESSING_UNAVAILABLE');
 unsafe('RECEIPT_DECODE_FAILED');
}
function imageEnd(buffer,mime){
 // Parse container boundaries; a second forged EOI/IEND after an appended
 // payload must not hide that payload from the suffix check.
 if(mime==='image/jpeg'){
  if(buffer[0]!==255||buffer[1]!==216)unsafe('RECEIPT_IMAGE_INVALID');let i=2,mpf=null;
  while(i<buffer.length){if(buffer[i++]!==255)unsafe('RECEIPT_IMAGE_INVALID');while(buffer[i]===255)i++;const marker=buffer[i++];
   if(marker===217)return safeImageTail(buffer,i,mpf);
   if(marker===0||marker===216)unsafe('RECEIPT_IMAGE_INVALID');if(marker===1||marker>=208&&marker<=215)continue;
   if(i+2>buffer.length)unsafe('RECEIPT_IMAGE_INVALID');const length=buffer.readUInt16BE(i);if(length<2||i+length>buffer.length)unsafe('RECEIPT_IMAGE_INVALID');
   if(marker===226&&buffer.subarray(i+2,i+6).equals(Buffer.from('MPF\0'))){if(mpf)unsafe('RECEIPT_POLYGLOT');mpf={base:i+6,stop:i+length};}i+=length;
   if(marker===218){while(i<buffer.length){if(buffer[i]!==255){i++;continue;}const next=buffer[i+1];if(next===0||next>=208&&next<=215){i+=2;continue;}break;}}
  }unsafe('RECEIPT_IMAGE_INVALID');
 }
 if(!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))unsafe('RECEIPT_IMAGE_INVALID');let i=8;
 while(i+12<=buffer.length){const length=buffer.readUInt32BE(i),type=buffer.subarray(i+4,i+8).toString('ascii');if(length>buffer.length-i-12)unsafe('RECEIPT_IMAGE_INVALID');i+=length+12;if(type==='IEND'){if(length!==0)unsafe('RECEIPT_IMAGE_INVALID');return safeImageTail(buffer,i);}}
 unsafe('RECEIPT_IMAGE_INVALID');
}
async function imageSafety(buffer,mime){
 const {clean,canonicalSize,mpf,auxiliaries=[]}=imageEnd(buffer,mime),options={limitInputPixels:MAX_PIXELS,failOn:'error',animated:false};let meta;
 try{meta=await sharp(clean,options).metadata();}catch(e){decodeFailure(e);}
 if(!['jpeg','png'].includes(meta.format)||!meta.width||!meta.height||meta.width*meta.height>MAX_PIXELS||Math.max(meta.width,meta.height)>MAX_SIDE||meta.pages>1)unsafe('RECEIPT_DIMENSIONS_INVALID');
 // Decode pixels, not merely metadata. Benign decoder warnings are not proof
 // of corruption; fatal decode errors and resource limits still fail closed.
 try{await sharp(clean,options).resize({width:64,height:64,fit:'inside',withoutEnlargement:true}).raw().toBuffer();}catch(e){decodeFailure(e);}
 if(mpf){
  let pixels=meta.width*meta.height;
  for(const extra of auxiliaries){try{const m=await sharp(extra,options).metadata();pixels+=m.width*m.height;if(m.format!=='jpeg'||!m.width||!m.height||pixels>MAX_PIXELS||Math.max(m.width,m.height)>MAX_SIDE||m.pages>1)unsafe('RECEIPT_DIMENSIONS_INVALID');await sharp(extra,options).resize({width:64,height:64,fit:'inside'}).raw().toBuffer();}catch(e){if(e.code?.startsWith('RECEIPT_'))throw e;decodeFailure(e);}}
  let normalized;try{normalized=await sharp(clean,options).rotate().toColourspace('srgb').jpeg({quality:94}).toBuffer();}catch(e){decodeFailure(e);}
  if(normalized.length>5242880)unsafe('RECEIPT_TOO_LARGE');return{canonicalSize,normalized};
 }
 return{canonicalSize};
}
async function pdfSafety(buffer){
 const raw=buffer.toString('latin1').replace(/#([a-f0-9]{2})/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));
 if(!raw.slice(-4096).includes('%%EOF'))unsafe('RECEIPT_PDF_INVALID');
 const eof=buffer.lastIndexOf(Buffer.from('%%EOF'));if(eof<0||!buffer.subarray(eof+5).every(b=>[0,9,10,13,32].includes(b)))unsafe('RECEIPT_POLYGLOT');
 if(/\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA|SubmitForm|GoToR)\b/i.test(raw))unsafe('RECEIPT_PDF_ACTIVE_CONTENT');
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');let task,doc;
 try{task=getDocument({data:new Uint8Array(buffer),verbosity:0,isEvalSupported:false,useSystemFonts:true,disableFontFace:true,stopAtErrors:true});doc=await task.promise;}catch(e){await task?.destroy().catch(()=>{});if(resourceFailure(e))unsafe('RECEIPT_PROCESSING_UNAVAILABLE');unsafe('RECEIPT_PDF_INVALID');}
 try{
  if(doc.numPages<1||doc.numPages>2)unsafe('RECEIPT_PDF_PAGES');
  const actions=await doc.getJSActions(),attachments=await doc.getAttachments();
  if(actions&&Object.keys(actions).length||attachments&&Object.keys(attachments).length)unsafe('RECEIPT_PDF_ACTIVE_CONTENT');
  for(let n=1;n<=doc.numPages;n++){
   const page=await doc.getPage(n),js=await page.getJSActions();if(js&&Object.keys(js).length)unsafe('RECEIPT_PDF_ACTIVE_CONTENT');
   const annotations=await page.getAnnotations();if(annotations.some(a=>/^(?:javascript|data|file|vbscript):/i.test(a.unsafeUrl||'')||a.jsAction))unsafe('RECEIPT_PDF_ACTIVE_CONTENT');
   const ops=await page.getOperatorList();if(ops.fnArray.length>60000)unsafe('RECEIPT_PDF_COMPLEX');
   for(let i=0;i<ops.fnArray.length;i++)if([OPS.paintImageXObject,OPS.paintInlineImageXObject].includes(ops.fnArray[i])){const a=ops.argsArray[i],pixels=typeof a?.[1]==='number'?a[1]*a[2]:Number(a?.[0]?.width)*Number(a?.[0]?.height);if(pixels>MAX_PIXELS)unsafe('RECEIPT_DIMENSIONS_INVALID');}
  }
 }finally{await task.destroy();}
}
export async function inspectFileSafety(buffer,mime){
 if(!Buffer.isBuffer(buffer)||!buffer.length)unsafe('RECEIPT_IMAGE_INVALID');if(buffer.length>5*1024*1024)unsafe('RECEIPT_TOO_LARGE');
 let result={canonicalSize:buffer.length};if(mime==='application/pdf')await pdfSafety(buffer);else if(['image/jpeg','image/png'].includes(mime))result=await imageSafety(buffer,mime);else unsafe('RECEIPT_TYPE');
 return result.normalized?{safetyVersion:3,canonicalSize:result.normalized.length,normalizedBase64:result.normalized.toString('base64')}:{safetyVersion:2,canonicalSize:result.canonicalSize};
}
