import crypto from 'node:crypto';
import {receiptFromBuffer} from './payment-security.mjs';

// These authenticated operations have independent account budgets. Background
// catalog/balance reads and other customers on the same IP cannot spend them.
export function topupRatePolicy(path, method, kind) {
  if (path === '/receipt' && method === 'POST' && kind === 'topup')
    return {action: 'topup-receipt', limit: 10};
  if (path === '/topup/submit' && method === 'POST')
    return {action: 'topup-submit', limit: 12};
  if (path === '/topup/receipt/remove' && method === 'POST')
    return {action: 'topup-receipt-remove', limit: 10};
  if (path === '/topup' && method === 'POST')
    return {action: 'topup-create', limit: 12};
  if (method === 'GET' && ['/topup', '/topup/methods', '/topup/receipt'].includes(path))
    return {action: 'topup-read', limit: 120};
  if (path === '/method' && method === 'GET' && kind === 'topup')
    return {action: 'topup-read', limit: 120};
  return null;
}

const flights = new WeakMap();
const invalid = message => Object.assign(Error(message), {status: 400});
export async function topupReceiptUpload({req,url,shop,owner,store,config,readRawBody,validateFile}) {
  const id = url.searchParams.get('id');
  const attempt = url.searchParams.get('attempt');
  if (attempt && !/^[a-f0-9-]{36}$/i.test(attempt)) throw invalid('Yükləmə identifikatoru düzgün deyil.');
  // Authorization precedes reading or joining any other request.
  const target = await shop.receiptTarget(req,owner,'topup',id);
  const bytes = await readRawBody(req,config.maxReceiptBytes);
  const receipt = receiptFromBuffer(bytes,req.headers['content-type'],config.maxReceiptBytes);
  const sourceSha256 = receipt.sha256;
  const traceId = crypto.randomUUID();
  let stage = 'receipt';
  const started = performance.now();
  try {
    if (attempt && target.receipt?.requestId === attempt) {
      if (target.receipt.sourceSha256 !== sourceSha256)
        throw Object.assign(Error('Təkrar yükləmə faylı uyğun deyil.'), {status: 409});
      stage = 'saved_receipt';
      await store.verifyUploadedReceipt(target.receipt.path,target.receipt.size);
      return {receiptUploaded: true};
    }
    let pending = flights.get(shop);
    if (!pending) { pending = new Map(); flights.set(shop,pending); }
    const key = target.prefix;
    const current = pending.get(key);
    if (current) {
      if (current.attempt !== attempt || current.sourceSha256 !== sourceSha256)
        throw Object.assign(Error('Bu müraciətin çeki yüklənir. Tamamlanmasını gözləyin.'), {status: 409});
      stage = 'joined_upload';
      return await current.promise;
    }
    const flight = {attempt,sourceSha256};
    const save = async () => {
      stage = 'file_safety';
      await validateFile(receipt);
      const file = {
        path: target.prefix+'/'+receipt.sha256+'.'+receipt.extension,
        mimeType: receipt.mimeType, size: receipt.buffer.length, sha256: receipt.sha256,
        ...(attempt ? {requestId: attempt,sourceSha256} : {})
      };
      stage = 'storage_recovery';
      const exists = store.hasUploadedReceipt && await store.hasUploadedReceipt(file.path,file.size);
      if (!exists) {
        stage = 'storage_upload';
        await store.uploadReceipt(file.path,receipt);
      }
      stage = 'storage_verify';
      await store.verifyUploadedReceipt(file.path,file.size);
      stage = 'receipt_save';
      return await shop.savedReceipt(req,owner,'topup',id,file);
    };
    flight.promise = save();
    pending.set(key,flight);
    try { return await flight.promise; }
    finally { if (pending.get(key) === flight) pending.delete(key); }
  } catch (error) {
    console.info('Topup receipt',JSON.stringify({traceId,stage,status:Number(error.status)||503,
      code:/^[A-Z_]+$/.test(error.code||'')?error.code:'UPLOAD_FAILED',
      bytes:bytes.length,ms:Math.round(performance.now()-started)}));
    throw error;
  }
}
