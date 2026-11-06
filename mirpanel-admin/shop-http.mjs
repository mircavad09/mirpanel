import {receiptFromBuffer,publicPaymentNumber} from './payment-security.mjs';
export async function handleShop({req,res,url,shop,browserOrders,security,readBody,readRawBody,validateFile,store,config,json,rate,withBackground}){
 await rate(req,'shop',60,100);
 const path=url.pathname.slice('/api/payments/shop'.length),owner=browserOrders.ensure(req,res),post=req.method==='POST';
 try{
 let value;
 if(path==='/receipt'&&post){const kind=url.searchParams.get('kind'),id=url.searchParams.get('id');if(!['cart','topup'].includes(kind))throw Object.assign(Error('Yükləmə növü düzgün deyil.'),{status:400});const target=await shop.receiptTarget(req,owner,kind,id),bytes=await readRawBody(req,config.maxReceiptBytes),r=receiptFromBuffer(bytes,req.headers['content-type'],config.maxReceiptBytes),attempt=kind==='topup'?url.searchParams.get('attempt'):null,sourceSha256=r.sha256;if(attempt&&!/^[a-f0-9-]{36}$/i.test(attempt))throw Object.assign(Error('Yükləmə identifikatoru düzgün deyil.'),{status:400});if(attempt&&target.receipt?.requestId===attempt){if(target.receipt.sourceSha256!==sourceSha256)throw Object.assign(Error('Təkrar yükləmə faylı uyğun deyil.'),{status:409});await store.verifyUploadedReceipt(target.receipt.path,target.receipt.size);value={receiptUploaded:true};}else{await validateFile(r);const file={path:target.prefix+'/'+r.sha256+'.'+r.extension,mimeType:r.mimeType,size:r.buffer.length,sha256:r.sha256,...(attempt?{requestId:attempt,sourceSha256}:{})};await store.uploadReceipt(file.path,r);await store.verifyUploadedReceipt(file.path,file.size);value=await shop.savedReceipt(req,owner,kind,id,file);}
 }else if(path==='/method'&&req.method==='GET'){const raw=await shop.method(url.searchParams.get('id'),{req,owner,checkoutId:url.searchParams.get('checkout')}),m=withBackground?await withBackground(raw):raw;value={id:m.id,name:m.display_name,provider:m.provider_name,holder:m.holder_name,number:publicPaymentNumber(security.decryptNumber(m.encrypted_number),m.method_type),last4:m.last4,backgroundUrl:m.backgroundUrl||''};
 }else if(path==='/quote'&&post)value=await shop.quote(req,(await readBody(req,40000)).items,owner);
 else if(path==='/draft'&&post)value=await shop.saveDraft(req,owner,await readBody(req,8000));
 else if(path==='/draft'&&req.method==='GET')value=await shop.getDraft(req,owner,url.searchParams.get('id'));
 else if(path==='/drafts'&&req.method==='GET')value=await shop.listDrafts(req,owner);
 else if(path==='/draft/remove'&&post)value=await shop.removeDrafts(req,owner,(await readBody(req,4000)).ids);
 else if(path==='/checkout'&&post)value=await shop.checkout(req,owner,await readBody(req,40000));
 else if(path==='/checkout'&&req.method==='GET')value=await shop.get(req,owner,url.searchParams.get('id'));
 else if(path==='/whatsapp'&&req.method==='GET'){const target=await shop.whatsapp(req,owner,url.searchParams.get('id'));res.writeHead(302,{'Location':target,'Cache-Control':'private,no-store','Referrer-Policy':'no-referrer'});res.end();return true;}
 else if(path==='/cancel'&&post)value=await shop.cancel(req,owner,(await readBody(req,2000)).id);
 else if(path==='/submit'&&post)value=await shop.submit(req,owner,(await readBody(req,2000)).id);
 else if(path==='/wallet'&&req.method==='GET')value=await shop.wallet(req,Object.fromEntries(url.searchParams));
 else if(path==='/topup'&&post)value=await shop.topup(req,await readBody(req,2000));
 else if(path==='/topup'&&req.method==='GET')value=await shop.topupState(req,url.searchParams.get('id'));
 else if(path==='/topup/receipt/remove'&&post)value=await shop.removeTopupReceipt(req,(await readBody(req,2000)).id);
 else if(path==='/topup/submit'&&post)value=await shop.submitTopup(req,(await readBody(req,2000)).id);
 else throw Object.assign(Error('Tapılmadı.'),{status:404});
 json(req,res,200,value);
 }catch(e){console.error('Shop API',JSON.stringify({stage:path,status:Number(e.status)||503,code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'SHOP_ERROR'}));if(!e.status)throw Object.assign(Error(/INVENTORY_EMPTY/.test(e.message)?'Stokda yoxdur.':/PAYMENT_METHOD/.test(e.message)?'Ödəniş kartı hazırda əlçatan deyil.':'Əməliyyatın tamamlanması təsdiqlənmədi. Eyni sorğu ilə yenidən cəhd edin.'),{status:503});throw e;}
 return true;
}
