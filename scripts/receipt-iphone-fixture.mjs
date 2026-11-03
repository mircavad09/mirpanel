import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../receipt-worker/package.json',import.meta.url))('sharp');
// CIPA MP Index (APP2, big-endian TIFF), primary plus JPEG gain-map image.
// Synthetic pixels only. EXIF rotation and ICC emulate an iPhone photo export.
export async function iphoneJpeg(){
 const primary=await sharp({create:{width:600,height:900,channels:3,background:'#95a8bd'}}).withMetadata({orientation:6}).jpeg({quality:90,progressive:true}).toBuffer();
 const gain=await sharp({create:{width:150,height:225,channels:3,background:'#777'}}).jpeg().toBuffer();
 const tiff=Buffer.alloc(8+2+3*12+4+32);tiff.write('MM');tiff.writeUInt16BE(42,2);tiff.writeUInt32BE(8,4);tiff.writeUInt16BE(3,8);
 const tag=(p,id,type,count,value)=>{tiff.writeUInt16BE(id,p);tiff.writeUInt16BE(type,p+2);tiff.writeUInt32BE(count,p+4);tiff.writeUInt32BE(value,p+8);};
 tag(10,0xb000,7,4,0x30313030);tag(22,0xb001,4,1,2);tag(34,0xb002,7,32,50);
 const app=Buffer.alloc(8+tiff.length);app[0]=255;app[1]=226;app.writeUInt16BE(app.length-2,2);app.write('MPF\0',4);
 const size=primary.length+app.length; tiff.writeUInt32BE(0x20030000,50);tiff.writeUInt32BE(size,54);tiff.writeUInt32BE(0,58);
 tiff.writeUInt32BE(0,66);tiff.writeUInt32BE(gain.length,70);tiff.writeUInt32BE(size-10,74);tiff.copy(app,8);
 return {bytes:Buffer.concat([primary.subarray(0,2),app,primary.subarray(2),gain]),primary,gain};
}
