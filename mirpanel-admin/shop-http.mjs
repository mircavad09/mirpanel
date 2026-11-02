import {receiptFromBuffer,publicPaymentNumber} from './payment-security.mjs';
export async function handleShop({req,res,url,shop,browserOrders,security,readBody,readRawBody,validateFile,store,config,json,rate}){
 await rate(req,'shop',60,100);
 const path=url.pathname.slice('/api/payments/shop'.length),owner=browserOrders.ensure(req,res),post=req.method==='POST';
 try{
 let value;
 if(path==='/receipt'&&post){const kind=url.searchParams.get('kind'),id=url.searchParams.get('id');if(!['cart','topup'].includes(kind))throw Object.assign(Error('Yükləmə növü düzgün deyil.'),{status:400});const target=await shop.receiptTarget(req,owner,kind,id),bytes=await readRawBody(req,config.maxReceiptBytes),r=receiptFromBuffer(bytes,req.headers['content-type'],config.maxReceiptBytes);await validateFile(r);const file={path:target.prefix+'/'+r.sha256+'.'+r.extension,mimeType:r.mimeType,size:r.buffer.length,sha256:r.sha256};await store.uploadReceipt(file.path,r);await store.verifyUploadedReceipt(file.path,file.size);value=await shop.savedReceipt(req,owner,kind,id,file);
 }else if(path==='/method'&&req.method==='GET'){const m=await shop.method(url.searchParams.get('id'));value={id:m.id,name:m.display_name,provider:m.provider_name,holder:m.holder_name,number:publicPaymentNumber(security.decryptNumber(m.encrypted_number),m.method_type),last4:m.last4};
 }else if(path==='/quote'&&post)value=await shop.quote(req,(await readBody(req,40000)).items);
 else if(path==='/checkout'&&post)value=await shop.checkout(req,owner,await readBody(req,40000));
 else if(path==='/checkout'&&req.method==='GET')value=await shop.get(req,owner,url.searchParams.get('id'));
 else if(path==='/cancel'&&post)value=await shop.cancel(req,owner,(await readBody(req,2000)).id);
 else if(path==='/submit'&&post)value=await shop.submit(req,owner,(await readBody(req,2000)).id);
 else if(path==='/wallet'&&req.method==='GET')value=await shop.wallet(req,Object.fromEntries(url.searchParams));
 else if(path==='/topup'&&post)value=await shop.topup(req,await readBody(req,2000));
 else if(path==='/topup/submit'&&post)value=await shop.submitTopup(req,(await readBody(req,2000)).id);
 else throw Object.assign(Error('Tapılmadı.'),{status:404});
 json(req,res,200,value);
 }catch(e){console.error('Shop API',JSON.stringify({stage:path,status:Number(e.status)||503,code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'SHOP_ERROR'}));if(!e.status)throw Object.assign(Error(/INVENTORY_EMPTY/.test(e.message)?'Stokda yoxdur.':/PAYMENT_METHOD/.test(e.message)?'Ödəniş kartı hazırda əlçatan deyil.':'Əməliyyatın tamamlanması təsdiqlənmədi. Eyni sorğu ilə yenidən cəhd edin.'),{status:503});throw e;}
 return true;
}
