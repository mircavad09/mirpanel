import {inspectDocument} from './engine.mjs';
let data='';for await(const chunk of process.stdin){data+=chunk;if(data.length>7_100_000)process.exit(2);}
try{const input=JSON.parse(data),analysis=await inspectDocument(Buffer.from(input.base64,'base64'),input.mime);process.stdout.write(JSON.stringify({ok:true,analysis}));}catch(e){process.stdout.write(JSON.stringify({ok:false,code:/^RECEIPT_[A-Z_]+$/.test(e.code||'')?e.code:'RECEIPT_PROCESSING_FAILED'}));}
