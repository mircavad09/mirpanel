import sharp from 'sharp';
import {createWorker} from 'tesseract.js';
import jsQR from 'jsqr';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createCanvas,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
const MAX_PIXELS=20_000_000,MAX_SIDE=10000;
sharp.concurrency(1);sharp.cache(false);
function unsafe(code){throw Object.assign(Error(code),{code});}
const phash=data=>{let bits='';for(let y=0;y<8;y++)for(let x=0;x<8;x++)bits+=data[y*9+x]>data[y*9+x+1]?'1':'0';return BigInt('0b'+bits).toString(16).padStart(16,'0');};
async function imageFeatures(buffer){
 const options={limitInputPixels:MAX_PIXELS,failOn:'warning',animated:false};let meta;try{meta=await sharp(buffer,options).metadata();}catch{unsafe('RECEIPT_DECODE_FAILED');}
 if(!['jpeg','png'].includes(meta.format)||meta.width*meta.height>MAX_PIXELS||Math.max(meta.width,meta.height)>MAX_SIDE||meta.pages>1)unsafe('RECEIPT_DIMENSIONS_INVALID');
 const clean=await sharp(buffer,options).rotate().flatten({background:'#fff'}).toColourspace('srgb').resize({width:2200,height:3500,fit:'inside',withoutEnlargement:true}).png().toBuffer();
 const m=await sharp(clean).metadata(),gray=await sharp(clean).resize(9,8,{fit:'fill'}).greyscale().raw().toBuffer(),stats=await sharp(clean).stats();
 const edges=await sharp(clean).greyscale().convolve({width:3,height:3,kernel:[0,1,0,1,-4,1,0,1,0]}).stats();
 const rgba=await sharp(clean).ensureAlpha().raw().toBuffer();let qr=null;try{qr=jsQR(new Uint8ClampedArray(rgba),m.width,m.height,{inversionAttempts:'attemptBoth'});}catch{}
 // These are only signals, never a fraud verdict.
 const channels=stats.channels,contrast=channels.reduce((n,c)=>n+c.stdev,0)/channels.length;
 const layoutImage=await sharp(clean).resize({width:600,withoutEnlargement:true}).greyscale().raw().toBuffer({resolveWithObject:true});
 const pixels=layoutImage.data,w=layoutImage.info.width,h=layoutImage.info.height,mean=channels.reduce((n,c)=>n+c.mean,0)/channels.length;
 let background=0,ink=0,textRuns=0,inside=false;for(let y=0;y<h;y++){let count=0;for(let x=0;x<w;x++){const v=pixels[y*w+x],isInk=mean<100?v>160:v<160;if(isInk){ink++;count++;}if(mean<100?v<70:v>200)background++;}const row=count/w>0.008&&count/w<0.7;if(row&&!inside)textRuns++;inside=row;}
 const documentLike=background/pixels.length>0.55&&ink/pixels.length>0.008&&ink/pixels.length<0.32&&textRuns>=5;
 // Error-level residuals are a weak local-edit signal, not a forgery detector.
 const reference=await sharp(clean).resize(512,512,{fit:'fill'}).removeAlpha().raw().toBuffer();
 const recompressed=await sharp(clean).resize(512,512,{fit:'fill'}).jpeg({quality:90}).toBuffer();
 const compared=await sharp(recompressed).removeAlpha().raw().toBuffer();const cells=[];
 for(let cy=0;cy<8;cy++)for(let cx=0;cx<8;cx++){let sum=0;for(let y=cy*64;y<(cy+1)*64;y++)for(let x=cx*64;x<(cx+1)*64;x++)for(let c=0;c<3;c++){const i=(y*512+x)*3+c;sum+=Math.abs(reference[i]-compared[i]);}cells.push(sum/(64*64*3));}
 const sorted=cells.filter(n=>n>0.5).sort((a,b)=>a-b);const compressionAnomaly=sorted.length>16?Math.max(...sorted)/sorted[Math.floor(sorted.length/2)]:0;
 return {clean,width:m.width,height:m.height,phash:phash(gray),compressionAnomaly,documentLike,textRuns,quality:{contrast,brightness:mean,edgeEnergy:edges.channels[0].stdev,tooSmall:m.width<300||m.height<240},qr:qr?String(qr.data).slice(0,1500):null};
}
async function pdfPages(buffer){
 if(buffer.length<32||!buffer.subarray(-4096).toString('latin1').includes('%%EOF'))unsafe('RECEIPT_PDF_INVALID');
 const raw=buffer.toString('latin1');if(/\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA|SubmitForm|GoToR)\b/i.test(raw))unsafe('RECEIPT_PDF_ACTIVE_CONTENT');
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 let doc,task;try{task=getDocument({data:new Uint8Array(buffer),verbosity:0,isEvalSupported:false,useSystemFonts:true,disableFontFace:true,stopAtErrors:true});doc=await task.promise;}catch{await task?.destroy().catch(()=>{});unsafe('RECEIPT_PDF_INVALID');}
 try{
  if(doc.numPages<1||doc.numPages>2)unsafe('RECEIPT_PDF_PAGES');
  const js=await doc.getJSActions(),attachments=await doc.getAttachments();if(js&&(js.size||Object.keys(js).length)||attachments&&(attachments.size||Object.keys(attachments).length))unsafe('RECEIPT_PDF_ACTIVE_CONTENT');
  const pages=[];let text='';for(let n=1;n<=doc.numPages;n++){
   const page=await doc.getPage(n);if(await page.getJSActions())unsafe('RECEIPT_PDF_ACTIVE_CONTENT');
   const annotations=await page.getAnnotations();if(annotations.some(a=>/^(?:javascript|data|file|vbscript):/i.test(a.unsafeUrl||'')||a.jsAction))unsafe('RECEIPT_PDF_ACTIVE_CONTENT');
   const content=await page.getTextContent();text+=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('').slice(0,30000)+'\n';
   const ops=await page.getOperatorList();if(ops.fnArray.length>60000)unsafe('RECEIPT_PDF_COMPLEX');
   for(let i=0;i<ops.fnArray.length;i++)if([OPS.paintImageXObject,OPS.paintInlineImageXObject].includes(ops.fnArray[i])){const a=ops.argsArray[i],pixels=typeof a?.[1]==='number'?a[1]*a[2]:Number(a?.[0]?.width)*Number(a?.[0]?.height);if(pixels>MAX_PIXELS)unsafe('RECEIPT_DIMENSIONS_INVALID');}
   const initial=page.getViewport({scale:1}),scale=Math.min(2.5,2400/initial.width,3500/initial.height);if(!(scale>0))unsafe('RECEIPT_PDF_INVALID');const view=page.getViewport({scale});
   const canvas=createCanvas(Math.ceil(view.width),Math.ceil(view.height));await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;pages.push(await imageFeatures(await canvas.encode('png')));
  }return {pages,text:text.slice(0,40000)};
 }finally{await task.destroy();}
}
export async function inspectDocument(buffer,mime,{recognize,modelPath=process.env.RECEIPT_MODEL_PATH||fileURLToPath(new URL('./models/',import.meta.url))}={}){
 if(buffer.length>5*1024*1024)unsafe('RECEIPT_TOO_LARGE');
 if(buffer.includes(Buffer.from('PK\x03\x04','binary'))||buffer.includes(Buffer.from('<script','ascii')))unsafe('RECEIPT_POLYGLOT');
 let pages,pdfText='';if(mime==='application/pdf'){const p=await pdfPages(buffer);pages=p.pages;pdfText=p.text;}else{
  // Reject appended payloads: JPEG must end at EOI; PNG must end at IEND.
  if(mime==='image/jpeg'&&(buffer[0]!==255||buffer[1]!==216||buffer.at(-2)!==255||buffer.at(-1)!==217))unsafe('RECEIPT_IMAGE_INVALID');
  if(mime==='image/png'&&(!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||!buffer.subarray(-8,-4).equals(Buffer.from('IEND'))))unsafe('RECEIPT_IMAGE_INVALID');
  if(!['image/jpeg','image/png'].includes(mime))unsafe('RECEIPT_TYPE');pages=[await imageFeatures(buffer)];
 }
 let worker;const texts=[],words=[];let ocrStatus='ok',confidence=0;
 try{
  if(!recognize){if(!fs.existsSync(path.join(modelPath,'eng.traineddata')))throw Error('MODEL_UNAVAILABLE');worker=await createWorker(['eng','aze'],1,{langPath:modelPath,gzip:false,cacheMethod:'none',logger:()=>{}});await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'6'});}
  for(const page of pages){const data=recognize?await recognize(page.clean):(await worker.recognize(page.clean,{}, {text:true,blocks:true,tsv:true})).data;texts.push(String(data.text||'').slice(0,30000));confidence+=Number(data.confidence)||0;
   const lines=String(data.tsv||'').split('\n').slice(1);for(const line of lines){const cells=line.split('\t');if(cells.length>=12&&Number(cells[10])>=0)words.push({left:+cells[6],top:+cells[7],width:+cells[8],height:+cells[9],confidence:+cells[10],text:cells.slice(11).join(' ').slice(0,80)});}
  }confidence/=pages.length;
 }catch{ocrStatus='unavailable';}finally{if(worker)await worker.terminate();}
 return {version:1,ocrStatus,text:texts.join('\n').slice(0,40000),pdfText,confidence,words:words.slice(0,2000),pages:pages.map(({clean,...p})=>p)};
}
