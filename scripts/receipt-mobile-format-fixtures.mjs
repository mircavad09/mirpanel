// Synthetic pixels encoded as real JPEG/PNG. Samsung SEF layout follows the
// published ExifTool Samsung trailer parser; no customer or bank receipt data.
import {createRequire} from 'node:module';
import {randomImage} from './receipt-synthetic-fixtures.mjs';
const sharp=createRequire(new URL('../receipt-worker/package.json',import.meta.url))('sharp');
export function samsungSef(image,records=[{name:'Image_UTC_Data',type:0x0a01,data:Buffer.from('1793100000000')}]){
 const blocks=records.map(r=>{const name=Buffer.from(r.name),b=Buffer.alloc(8+name.length+r.data.length);b.writeUInt16LE(r.type,2);b.writeUInt32LE(name.length,4);name.copy(b,8);r.data.copy(b,8+name.length);return b;});
 const dir=Buffer.alloc(12+records.length*12);dir.write('SEFH');dir.writeUInt32LE(101,4);dir.writeUInt32LE(records.length,8);let offset=blocks.reduce((n,b)=>n+b.length,0);
 records.forEach((r,i)=>{const p=12+i*12;dir.writeUInt16LE(r.type,p+2);dir.writeUInt32LE(offset,p+4);dir.writeUInt32LE(blocks[i].length,p+8);offset-=blocks[i].length;});
 const footer=Buffer.alloc(8);footer.writeUInt32LE(dir.length);footer.write('SEFT',4);return Buffer.concat([image,...blocks,dir,footer]);
}
export async function mobileFormatFixtures(){const png=await randomImage(),jpeg=await sharp(png).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toBuffer();return[
 {name:'Samsung screenshot SEF JPEG',filename:'Screenshot_20261027_181020_ABB Mobile.jpg',mime:'image/jpeg',bytes:samsungSef(jpeg),canonical:jpeg},
 {name:'Samsung SEF PNG with JPG filename',filename:'Samsung screenshot.jpg',mime:'image/jpeg',bytes:samsungSef(png),canonical:png},
 {name:'Android progressive JPEG',filename:'Screenshot.jpg',mime:'image/jpeg',bytes:await sharp(png).jpeg({progressive:true}).toBuffer()},
 {name:'Android palette PNG',filename:'Screenshot.png',mime:'image/png',bytes:await sharp(png).png({palette:true}).toBuffer()},
 {name:'WhatsApp recompressed JPEG',filename:'WhatsApp Image.jpeg',mime:'image/pjpeg',bytes:await sharp(png).jpeg({quality:62}).toBuffer()},
 {name:'JPEG with EXIF orientation',filename:'ABB saved image.jpg',mime:'application/octet-stream',bytes:await sharp(png).withMetadata({orientation:6}).jpeg().toBuffer()}
];}
