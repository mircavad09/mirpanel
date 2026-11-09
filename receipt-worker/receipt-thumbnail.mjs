import sharp from 'sharp';
import {createCanvas} from '@napi-rs/canvas';

export async function receiptThumbnail(bytes,mime){
 if(mime==='application/pdf'){
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,disableFontFace:true,stopAtErrors:true});
  try{
   const doc=await task.promise;
   const page=await doc.getPage(1);
   const size=page.getViewport({scale:1});
   const view=page.getViewport({scale:Math.min(360/size.width,380/size.height)});
   const canvas=createCanvas(Math.max(1,Math.ceil(view.width)),Math.max(1,Math.ceil(view.height)));
   await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
   bytes=await canvas.encode('png');
  }finally{await task.destroy();}
 }
 return sharp(bytes,{limitInputPixels:40000000,failOn:'warning'})
  .rotate().resize(360,380,{fit:'inside',withoutEnlargement:true})
  .flatten({background:'#fff'}).jpeg({quality:78}).toBuffer();
}
