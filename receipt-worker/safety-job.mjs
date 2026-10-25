// File safety only: never starts an OCR engine or classifies receipt contents.
import {inspectDocument} from './engine.mjs';
let data='';for await(const chunk of process.stdin){data+=chunk;if(data.length>7_100_000)process.exit(2);}
try{const input=JSON.parse(data);await inspectDocument(Buffer.from(input.base64,'base64'),input.mime,{safetyOnly:true,presenceOnly:true});process.stdout.write(JSON.stringify({ok:true,safetyVersion:1}));}
catch(e){const code=/^RECEIPT_[A-Z_]+$/.test(e.code||'')?e.code:'RECEIPT_PROCESSING_FAILED';process.stdout.write(JSON.stringify({ok:false,code}));}
