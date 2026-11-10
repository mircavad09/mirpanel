import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';
import {bakuDate,shiftCalendarDays} from '../mirpanel-admin/payment-order-lifecycle.mjs';
import {saveNetflixRooms,restockNetflixRoom,netflixRooms} from '../mirpanel-admin/community/netflix-room-stock.mjs';
import {updateRoomPassword} from '../mirpanel-admin/community/netflix-room-password.mjs';
import {roomStates} from '../mirpanel-admin/community/netflix-room-state.mjs';
import {ownerCodes,createCustomerOrderMailer} from '../mirpanel-admin/community/order-delivery.mjs';
import {syncRoomSheetBatch} from '../mirpanel-admin/community/netflix-room-sheet-sync.mjs';
import {groupRoomRows} from '../mirpanel-admin/community/netflix-room-sheet-client.mjs';
import {saveProductMessage} from '../mirpanel-admin/community/ready-stock-product-messages.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')};
const f=await shopFixture({paymentConfig:config}),{pool,shop,id}=f,security=createPaymentSecurity(config),today=bakuDate(),day=n=>shiftCalendarDays(today,n),hash='a'.repeat(64);
const credentials=createAccountOrders({security,store:f.store,resolve:async r=>({userId:r.user,codes:d=>ownerCodes(pool,r.user,d)})});
const sheet=new Map();let failSheets=false;
const client={async open(){if(failSheets)throw Error('SYNTHETIC_OFFLINE');return {async upsert(row){sheet.set(row[6],row);},async group(){assert.ok(groupRoomRows([...sheet.values()]));}};}};
const sync=()=>syncRoomSheetBatch(pool,security,'synthetic',client);
const batch=(rooms,email,password)=>({requestId:id(),email,password,endsOn:day(90),rooms:rooms.map(name=>({name:String(name),pin:'0408'}))});
try{
 for(const file of ['ready-stock-migration.sql','ready-stock-product-messages-migration.sql','netflix-room-stock.sql','netflix-room-restock.sql','netflix-room-sheets.sql','subscriptions-migration.sql'])await pool.query(f.db.read('mirpanel-admin/community/'+file));
 await pool.query(f.db.read('supabase/migrations/202611090904_topup_emails.sql'));
 // A pre-migration unassigned room is never assumed to be available.
 const legacy=batch([1],'legacy@example.test','Example-legacy');await saveNetflixRooms(pool,security,config.tokenSecret,'owner',legacy);
 await pool.query(f.db.read('mirpanel-admin/community/netflix-room-renewal.sql'));await pool.query(f.db.read('mirpanel-admin/community/netflix-room-renewal.sql'));
 assert.equal((await netflixRooms(pool)).rooms[0].status,'review');
 f.catalog.products.push({id:'netflix',title:'Netflix synthetic',plans:[1,3,6].map(months=>({months,label:months+' ay',price:months*5}))});
 await saveProductMessage(pool,security,f.catalog,{productId:'netflix',message:'Qaydalar\nŞifrə: Example-old\nDəyişməyin.'});
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',100000),('b',100000)");
 const group=batch([1,2,3,4,5],'account-one@example.test','Example-old');await saveNetflixRooms(pool,security,config.tokenSecret,'owner',group);
 const item=async(who,index=0)=>{const x={productId:'netflix',planIndex:index,quantity:1,details:{name:'1',code_4:'0408'}};return {...x,termsVersion:(await shop.quote({user:who},[x],hash)).items[0].termsVersion};};
 const buy=async(who,index=0)=>shop.checkout({user:who},hash,{mode:'wallet',items:[await item(who,index)],requestId:id(),consentAccepted:true});
 const orders=[];for(const who of ['a','a','b','a','b'])orders.push(await buy(who));
 const initial=await roomStates(pool,{groupId:group.requestId});assert.equal(initial.length,5);assert.ok(initial.every(r=>r.active));
 await pool.query("update customer_order_deliveries set delivered_at=clock_timestamp()-interval '20 days' where id=any($1::uuid[])",[initial.map(r=>r.delivery_id)]);
 for(const n of [1,2]){
  const who=n===1?'a':'b',source=(await shop.subscriptions({user:who})).subscriptions.find(s=>s.id===initial[n].delivery_id),x=await item(who);
  const draft=await shop.saveDraft({user:who},hash,{id:id(),productId:'netflix',planIndex:0,values:x.details,termsVersion:x.termsVersion,renewalId:source.id,renewalExpiresOn:source.expiresOn});
  await shop.checkout({user:who},hash,{mode:'wallet',items:[{...x,draftId:draft.draftId,lineId:draft.lineId}],requestId:id(),consentAccepted:true});
 }
 const other=batch([1,2],'account-two@example.test','Example-other');await saveNetflixRooms(pool,security,config.tokenSecret,'owner',other);
 await buy('a',1);await buy('b',2);
 await pool.query(`create or replace function public.payment_baku_date(at_time timestamptz default now()) returns date language sql stable as $$select '${day(15)}'::date$$`);
 const before=await roomStates(pool,{groupId:group.requestId});assert.deepEqual(before.filter(r=>r.active).map(r=>r.room_name),['2','3']);
 const previews=await updateRoomPassword(pool,security,'owner',{action:'preview',groupId:group.requestId});assert.equal(previews.activeRooms,2);
 const change={action:'rotate',groupId:group.requestId,password:'Example-new',expectedRevision:previews.revision};
 const results=await Promise.all([updateRoomPassword(pool,security,'owner',change),updateRoomPassword(pool,security,'owner',change)]);
 assert.equal(results.filter(r=>r.changed).length,1);
 assert.equal((await pool.query("select count(*)::int n from customer_order_mail where event_key like 'netflix-password:%'")).rows[0].n,2);
 for(const [n,r]of before.entries()){
  const who=[0,1,3].includes(n)?'a':'b',value=await credentials.codes({user:who},r.delivery_id);
  assert.equal(value.password,r.active?'Example-new':undefined);assert.equal(value.netflixRoom.code,'0408');
  if(r.active){assert.ok(!value.text.includes('Example-old'));await assert.rejects(restockNetflixRoom(pool,{id:r.id,deliveryId:r.delivery_id,endsOn:day(90),confirmedEmpty:true}),{status:409});}
 }
 const after=await roomStates(pool,{groupId:group.requestId});assert.deepEqual(after.map(r=>r.period),before.map(r=>r.period));
 for(const r of await roomStates(pool,{groupId:other.requestId})){assert.ok(r.active);assert.equal((await credentials.codes({user:r.user_id},r.delivery_id)).password,'Example-other');assert.ok([3,6].includes(r.period.months));}
 const otherBefore=await roomStates(pool,{groupId:other.requestId});
 const otherPreview=await updateRoomPassword(pool,security,'owner',{groupId:other.requestId,action:'preview'});
 await updateRoomPassword(pool,security,'owner',{groupId:other.requestId,action:'rotate',password:'Example-other-new',expectedRevision:otherPreview.revision});
 assert.deepEqual((await roomStates(pool,{groupId:other.requestId})).map(r=>r.period),otherBefore.map(r=>r.period));
 const expired=before[0];await restockNetflixRoom(pool,{id:expired.id,deliveryId:expired.delivery_id,endsOn:day(90),confirmedEmpty:true,actor:'owner'});
 const old=await credentials.codes({user:'a'},expired.delivery_id);assert.equal(old.password,undefined);
 const replacement=await buy('b'),newRoom=(await roomStates(pool,{roomId:expired.id}))[0];assert.notEqual(newRoom.delivery_id,expired.delivery_id);
 assert.equal((await credentials.codes({user:'b'},newRoom.delivery_id)).password,'Example-new');
 assert.equal((await credentials.codes({user:'a'},expired.delivery_id)).password,undefined);
 await assert.rejects(credentials.codes({user:'a'},newRoom.delivery_id),{status:404});
 failSheets=true;await sync();failSheets=false;await pool.query("update netflix_room_sheet_sync set retry_at='-infinity'");await sync();await sync();
 assert.equal(sheet.size,8);for(const r of after)assert.equal(sheet.get(r.id)[3],'Example-new');
 assert.ok([...sheet.values()].filter(r=>r[7]===other.requestId).every(r=>r[3]==='Example-other-new'));
 const grouped=groupRoomRows([...sheet.values()].reverse());assert.equal(grouped.ends.length,3);assert.equal(grouped.rows.filter(r=>!r[6]).length,3);
 // Only the password notices enter the test mail provider; no real email leaves.
 await pool.query("update customer_order_mail set state='accepted',provider_id='synthetic' where event_key not like 'netflix-password:%'");
 const sent=[];let offline=true;
 const mailer=createCustomerOrderMailer(pool,async(_kind,msg)=>{if(offline)throw Object.assign(Error('Synthetic offline'),{deliveryDisposition:'retry',deliveryCode:'TOKEN_TEMPORARY'});sent.push(msg);return {id:id()};},'https://mirpanel.com');
 await mailer.wake();assert.equal(sent.length,0);offline=false;await pool.query("update customer_order_mail set next_at=now() where event_key like 'netflix-password:%'");await mailer.wake();await mailer.wake();assert.equal(sent.length,4);
 for(const msg of sent){assert.ok(msg.idempotencyKey.startsWith('netflix-password:'));assert.match(msg.textBody,/profil\?tab=orders&order=/);assert.doesNotMatch(JSON.stringify(msg),/Example-old|Example-new|Example-other-new|0408/);}
 const audit=JSON.stringify((await pool.query("select metadata from public.payment_audit_log where action like 'netflix.%'")).rows);assert.doesNotMatch(audit,/Example-old|Example-new|Example-other-new|0408/);
 assert.equal((await pool.query('select count(*)::int n from netflix_room_assignment_history')).rows[0].n,1);
 console.log('PASS: five rooms only 2/3 renewed, active release blocked, old-owner isolation, 3/6 month preservation, parallel rotation and one notice per customer, mail/Sheets retry, account-ID groups and legacy review');
}finally{await f.close();}

