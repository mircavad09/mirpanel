import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {supportCustomer,supportStaff} from '../mirpanel-admin/community/private-support.mjs';
const f=await shopFixture(),pool=f.pool;let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=async(p,status)=>{await assert.rejects(p,e=>e.status===status);checks++;};
try{
 await pool.query('create table customer_read_staff(user_id text primary key references "user"(id),active boolean,support boolean)');
 await pool.query("insert into customer_read_staff values('a',true,true),('b',true,true)");
 const one={userId:'a',guestHash:null},two={userId:'b',guestHash:null},t=(await supportCustomer(pool,one,'start')).thread.id,t2=(await supportCustomer(pool,two,'start')).thread.id;
 const pdf=Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF'),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1kAAAAASUVORK5CYII=','base64');
 for(const [name,mime,bytes]of [['sınaq.pdf','application/pdf',pdf],['sınaq.png','image/png',png]]){
  const input={threadId:t,clientId:randomUUID(),name,mime,base64:bytes.toString('base64')};
  const [a,b]=await Promise.all([supportCustomer(pool,one,'upload',input),supportCustomer(pool,one,'upload',input)]);eq(a.id,b.id);
  const file=await supportCustomer(pool,one,'file',{}, {id:t,fileId:a.id});eq(file.base64,input.base64);
  await reject(supportCustomer(pool,two,'file',{}, {id:t,fileId:a.id}),404);
  await reject(supportCustomer(pool,two,'file',{}, {id:t2,fileId:a.id}),404);
  const reply=(await supportCustomer(pool,one,'thread',{}, {id:t})).messages[0].id;
  const send={threadId:t,clientId:randomUUID(),body:'Azərbaycan hərfləri: əğıöüçş',attachmentId:a.id,replyTo:reply};
  const [c,d]=await Promise.all([supportCustomer(pool,one,'send',send),supportCustomer(pool,one,'send',send)]);
  eq(c.messages.filter(x=>x.client_id===send.clientId).length,1);eq(c.messages.find(x=>x.client_id===send.clientId).reply.id,reply);eq(d.messages.find(x=>x.client_id===send.clientId).attachment.name,name);
  await reject(supportCustomer(pool,two,'send',{...send,threadId:t2,clientId:randomUUID()}),404);
  await supportStaff(pool,'a','claim',{threadId:t,requestId:randomUUID()});
  await reject(supportStaff(pool,'b','file',{}, {id:t,fileId:a.id}),404);
  eq((await supportStaff(pool,'a','file',{}, {id:t,fileId:a.id})).name,name);
  await supportStaff(pool,'a','read',{threadId:t,seq:c.messages.at(-1).seq});eq((await supportCustomer(pool,one,'thread',{}, {id:t})).messages.find(x=>x.client_id===send.clientId).read,true);
  const staffFile=await supportStaff(pool,'a','upload',{...input,clientId:randomUUID()});const staff=await supportStaff(pool,'a','send',{threadId:t,body:'Əməkdaşın faylı',clientId:randomUUID(),replyTo:reply,attachmentId:staffFile.id});eq(staff.messages.at(-1).attachment.id,staffFile.id);
 }
 const bad=async(bytes,mime='application/pdf')=>supportCustomer(pool,one,'upload',{threadId:t,clientId:randomUUID(),name:'test',mime,base64:bytes.toString('base64')});
 await reject(bad(Buffer.from('<html>bad</html>')),400);await reject(bad(Buffer.from('%PDF-1.4\n/JavaScript /JS (alert(1))\n%%EOF')),400);await reject(bad(Buffer.alloc(5242881)),413);await reject(bad(png.subarray(0,-12),'image/png'),400);
 await pool.query("update customer_read_staff set active=false where user_id='a'");await reject(supportStaff(pool,'a','thread',{}, {id:t}),403);
 console.log(JSON.stringify({checks,realMessages:0,financialWrites:0,scope:'file/reply ACL, immutable replay, PDF safety, image truncation, revoked staff, real read acknowledgements'}));
}finally{await f.close();}
