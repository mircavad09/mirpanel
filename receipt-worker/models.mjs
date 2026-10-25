import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
const dir=process.env.RECEIPT_MODEL_PATH||fileURLToPath(new URL('./models/',import.meta.url));
fs.mkdirSync(dir,{recursive:true});
const revision='87416418657359cb625c412a48b6e1d6d41c29bd';
const manifest={revision};
for(const lang of ['eng','aze']){
 const r=await fetch(`https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${revision}/${lang}.traineddata`);
 if(!r.ok)throw Error('Model download failed');const b=Buffer.from(await r.arrayBuffer());
 if(b.length<100000)throw Error('Invalid model');fs.writeFileSync(path.join(dir,lang+'.traineddata'),b);
 manifest[lang]=crypto.createHash('sha256').update(b).digest('hex');console.log(lang+' model ready');
}
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
