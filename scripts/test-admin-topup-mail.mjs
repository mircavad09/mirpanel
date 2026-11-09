import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {createCustomerOrderMailer} from '../mirpanel-admin/community/order-delivery.mjs';
import {createOrderMailTransport} from '../mirpanel-admin/community/order-mail-transport.mjs';
import {receiptThumbnail} from '../receipt-worker/receipt-thumbnail.mjs';
import {createRequire} from 'node:module';

const sharp=createRequire(import.meta.url)('../receipt-worker/node_modules/sharp');
const image=await sharp({create:{width:800,height:1000,channels:3,background:'#eee'}}).png().toBuffer();
const preview=await receiptThumbnail(image,'image/png');
const {width,height,format}=await sharp(preview).metadata();
assert.equal(format,'jpeg');
assert.ok(width<=360&&height<=380);

const f=await shopFixture({adminTopupNotifications:true});
try{
 await f.db.exec(f.db.read('mirpanel-admin/community/payment-history-number-migration.sql'));
 await f.db.exec(f.db.read('supabase/migrations/202611090904_topup_emails.sql'));
 await f.pool.query("update community_member_numbers set member_number=1042 where user_id='a'");
 const req={user:'a'}, {id}=await f.shop.topup(req,{amount:'20',methodId:f.method,requestId:f.id()});
 const receipt={path:'topup/'+id+'/test.png',size:image.length,mimeType:'image/png'};
 await f.shop.savedReceipt(req,null,'topup',id,receipt);
 await assert.rejects(f.shop.submitTopup(req,id),/STORAGE_NOT_CONFIRMED/);
 assert.equal((await f.pool.query('select 1 from customer_order_mail')).rowCount,0);
 f.files.set(receipt.path,image);
 await Promise.all(Array.from({length:6},()=>f.shop.submitTopup(req,id)));
 const {rows:[job],rowCount}=await f.pool.query('select * from customer_order_mail');
 assert.equal(rowCount,1);
 assert.equal(job.event_key,'topup-admin:'+id);
 assert.equal(job.topup_snapshot.member,'1042');
 assert.equal(job.topup_snapshot.last4,'1234');

 
 await f.pool.query('update "user" set "emailVerified"=false where id=\'a\'');
 const requests=[];
 const send=createOrderMailTransport({ORDER_MAIL_PROVIDER:'resend',ORDER_MAIL_FROM:'test@mirpanel.com',ORDER_MAIL_RESEND_API_KEY:'fake'},null,{
  fetcher:async(_,request)=>{requests.push(request);return Response.json({id:'synthetic-provider-id'});}
 });
 const options={adminOrigin:'https://admin.example.test',topupPreview:async(path,mime)=>{
  assert.equal(path,receipt.path);assert.equal(mime,receipt.mimeType);return preview;
 }};
 const workers=Array.from({length:3},()=>createCustomerOrderMailer(f.pool,send,'https://mirpanel.com',options));
 await Promise.all(workers.map(worker=>worker.wake()));
 await Promise.all(workers.map(worker=>worker.wake()));
 assert.equal(requests.length,1);
 assert.equal(requests[0].headers['Idempotency-Key'],job.event_key);
 const mail=JSON.parse(requests[0].body);
 assert.deepEqual(mail.to,['mircavad09@gmail.com']);
 assert.equal(mail.subject,'Balans artımı · 20,00 ₼ · #1042');
 assert.match(mail.html,/ABB •••• 1234/);
 assert.match(mail.html,/Müraciət vaxtı/);
 assert.match(mail.html,/cid:topup-receipt/);
 assert.equal(mail.attachments[0].content_id,'topup-receipt');
 assert.deepEqual(Buffer.from(mail.attachments[0].content,'base64'),preview);
 for(const action of ['receipt','approve','reject'])assert.ok(mail.text.includes('https://admin.example.test/admin.html?topup='+id+'&topupAction='+action));
 assert.ok(!mail.html.includes(receipt.path));
 assert.equal((await f.pool.query('select state from customer_order_mail')).rows[0].state,'accepted');
 assert.equal((await f.shop.admin(f.pool,{id:'owner'},{action:'topups',id})).topups[0].status,'reviewing');
 await assert.rejects(f.shop.admin(f.pool,{id:'a'},{action:'receipt',id}),{status:403});
 console.log('PASS admin topup receipt thumbnail, atomic queue, parallel retry and delivery deduplication, private links, admin access');
}finally{await f.close();}
