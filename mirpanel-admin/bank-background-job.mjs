// Isolated, bounded decoder. Strip metadata and never retain active/original bytes.
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('../receipt-worker/node_modules/sharp');
sharp.cache(false);sharp.concurrency(1);
try{
 let input='';for await(const c of process.stdin){input+=c;if(input.length>7100000)throw Error('SIZE');}
 const bytes=Buffer.from(input,'base64');if(!bytes.length||bytes.length>5242880)throw Error('SIZE');
 const image=sharp(bytes,{limitInputPixels:16000000,failOn:'warning',animated:false}),m=await image.metadata();
 if(!['jpeg','png','webp'].includes(m.format)||m.pages>1||!m.width||!m.height||Math.max(m.width,m.height)>10000)throw Error('FORMAT');
 const out=await image.rotate().resize(1600,1000,{fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer();
 if(out.length>2097152)throw Error('SIZE');process.stdout.write(out.toString('base64'));
}catch{process.exitCode=2;}
