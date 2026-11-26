import {receiptFromBuffer,publicPaymentNumber} from './payment-security.mjs';
import {checkoutConsentVersion} from './community/public/checkout-consent.js';
import {currentDocumentPolicy} from './order-document.mjs';
import {topupReceiptUpload,topupRatePolicy} from './topup-receipt-upload.mjs';
export async function handleShop({req,res,url,shop,browserOrders,security,readBody,readRawBody,validateFile,store,config,json,rate,withBackground}){
 const path=url.pathname.slice('/api/payments/shop'.length),owner=browserOrders.ensure(req,res),post=req.method==='POST';
 try{
 const policy=topupRatePolicy(path,req.method,url.searchParams.has('topup')?'topup':url.searchParams.get('kind'));
 if(policy){
  let user;
  try{user=await shop.topupRateIdentity(req);}
  catch(error){
   if([401,403].includes(error.status))await rate(req,'topup-access',60,30);
   throw error;
  }
  await rate(req,policy.action,60,policy.limit,user);
 }else await rate(req,'shop',60,100);
 let value;
 if(path==='/receipt'&&post&&url.searchParams.get('kind')==='topup'){
  value=await topupReceiptUpload({req,url,shop,owner,store,config,readRawBody,validateFile});
 }else if(path==='/receipt'&&post){const kind=url.searchParams.get('kind'),id=url.searchParams.get('id');if(!['cart','topup'].includes(kind))throw Object.assign(Error('Yükləmə növü düzgün deyil.'),{status:400});const target=await shop.receiptTarget(req,owner,kind,id),bytes=await readRawBody(req,config.maxReceiptBytes),r=receiptFromBuffer(bytes,req.headers['content-type'],config.maxReceiptBytes),attempt=kind==='topup'?url.searchParams.get('attempt'):null,sourceSha256=r.sha256;if(attempt&&!/^[a-f0-9-]{36}$/i.test(attempt))throw Object.assign(Error('Yükləmə identifikatoru düzgün deyil.'),{status:400});if(attempt&&target.receipt?.requestId===attempt){if(target.receipt.sourceSha256!==sourceSha256)throw Object.assign(Error('Təkrar yükləmə faylı uyğun deyil.'),{status:409});await store.verifyUploadedReceipt(target.receipt.path,target.receipt.size);value={receiptUploaded:true};}else{await validateFile(r);const file={path:target.prefix+'/'+r.sha256+'.'+r.extension,mimeType:r.mimeType,size:r.buffer.length,sha256:r.sha256,...(attempt?{requestId:attempt,sourceSha256}:{})};await store.uploadReceipt(file.path,r);await store.verifyUploadedReceipt(file.path,file.size);value=await shop.savedReceipt(req,owner,kind,id,file);}
 }else if(path==='/method'&&req.method==='GET'){const id=url.searchParams.get('id'),topupId=url.searchParams.get('topup'),raw=topupId?await shop.topupMethod(req,id,topupId):await shop.method(id,{req,owner,checkoutId:url.searchParams.get('checkout')}),m=withBackground?await withBackground(raw):raw;value={id:m.id,name:m.display_name,provider:m.provider_name,holder:m.holder_name,number:publicPaymentNumber(security.decryptNumber(m.encrypted_number),m.method_type),last4:m.last4,backgroundUrl:m.backgroundUrl||''};
 }else if(path==='/quote'&&post){const b=await readBody(req,40000);value={...await shop.quote(req,b.items,owner,b.giftRecipient??null,b.tokenCount??null),documentPolicyVersion:currentDocumentPolicy().version,checkoutConsentVersion};}
 else if(path==='/player-name'&&post){
  await rate(req,'shop-player-name',60,12);
  const input=await readBody(req,8000);
  if(!input||typeof input!=='object')throw Object.assign(Error('Sorğu düzgün deyil.'),{status:400});
  value=await shop.playerName(req,input);
 }
 else if(path==='/epinby-account'&&post){
  await rate(req,'shop-player-name',60,12);
  value=await shop.checkEpinbyAccount(req,await readBody(req,8000));
 }
 else if(path==='/draft'&&post)value=await shop.saveDraft(req,owner,await readBody(req,8000));
 else if(path==='/prices'&&req.method==='GET')value=await shop.prices(req);
 else if(path==='/subscriptions'&&req.method==='GET')value=await shop.subscriptions(req);
 else if(path==='/renewal'&&post)value=await shop.renewal(req,await readBody(req,4000));
 else if(path==='/draft'&&req.method==='GET')value=await shop.getDraft(req,owner,url.searchParams.get('id'));
 else if(path==='/drafts'&&req.method==='GET')value=await shop.listDrafts(req,owner);
 else if(path==='/draft/remove'&&post)value=await shop.removeDrafts(req,owner,(await readBody(req,4000)).ids);
 else if(path==='/token-status'&&req.method==='GET')value=await shop.tokenStatus(req,url.searchParams.get('requestId'));
 else if(path==='/gift-status'&&req.method==='GET')value=await shop.giftStatus(req,url.searchParams.get('requestId'));
 else if(path==='/checkout'&&post)value=await shop.checkout(req,owner,await readBody(req,40000));
 else if(path==='/epoint'&&post)value=await shop.startProductPayment(req,owner,await readBody(req,40000));
 else if(path==='/checkout'&&req.method==='GET')value=await shop.get(req,owner,url.searchParams.get('id'));
 else if(path==='/payment-abandon'&&post)value=await shop.abandonPayment(req,owner,(await readBody(req,2000)).id);
 else if(path==='/payment-selection'&&req.method==='GET')value=await shop.paymentSelection(req,owner,url.searchParams.get('id'));
 else if(path==='/whatsapp'&&req.method==='GET'){const target=await shop.whatsapp(req,owner,url.searchParams.get('id'));res.writeHead(302,{'Location':target,'Cache-Control':'private,no-store','Referrer-Policy':'no-referrer'});res.end();return true;}
 else if(path==='/cancel'&&post)value=await shop.cancel(req,owner,(await readBody(req,2000)).id);
 else if(path==='/submit'&&post)value=await shop.submit(req,owner,(await readBody(req,2000)).id);
 else if(path==='/wallet'&&req.method==='GET')value=await shop.wallet(req,Object.fromEntries(url.searchParams));
 else if(path==='/topup/methods'&&req.method==='GET'){
  const {methods}=await shop.topupMethods(req);
  value={methods:withBackground?await Promise.all(methods.map(withBackground)):methods};
 }
 else if(path==='/topup'&&post)value=await shop.topup(req,await readBody(req,2000));
 else if(path==='/topup'&&req.method==='GET')value=await shop.topupState(req,url.searchParams.get('id'));
 else if(path==='/topup/receipt'&&req.method==='GET')value=await shop.topupReceipt(req,url.searchParams.get('id'));
 else if(path==='/topup/receipt/remove'&&post)value=await shop.removeTopupReceipt(req,(await readBody(req,2000)).id);
 else if(path==='/topup/submit'&&post)value=await shop.submitTopup(req,(await readBody(req,2000)).id);
 else throw Object.assign(Error('Tapılmadı.'),{status:404});
 json(req,res,200,value);
 }catch(e){console.error('Shop API',JSON.stringify({stage:path,status:Number(e.status)||503,code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'SHOP_ERROR'}));if(!e.status)throw Object.assign(Error(/INVENTORY_EMPTY/.test(e.message)?'Stokda yoxdur.':/PAYMENT_METHOD/.test(e.message)?'Ödəniş kartı hazırda əlçatan deyil.':'Əməliyyatın tamamlanması təsdiqlənmədi. Eyni sorğu ilə yenidən cəhd edin.'),{status:503});throw e;}
 return true;
}
