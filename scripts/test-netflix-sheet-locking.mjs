import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';import {createPaymentSecurity}from '../mirpanel-admin/payment-security.mjs';
import {saveNetflixRooms}from '../mirpanel-admin/community/netflix-room-stock.mjs';import {syncRoomSheetBatch}from '../mirpanel-admin/community/netflix-room-sheet-sync.mjs';import {bakuDate,shiftCalendarDays}from '../mirpanel-admin/payment-order-lifecycle.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';const f=await shopFixture();
try{for(const name of ['netflix-room-stock.sql','netflix-room-sheets.sql','netflix-room-restock.sql','subscriptions-migration.sql','netflix-room-renewal.sql'])await f.db.exec(f.db.read('mirpanel-admin/community/'+name));
const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')}),group=f.id();
await saveNetflixRooms(f.pool,security,'synthetic-secret','synthetic-owner',{requestId:group,email:'synthetic@example.test',password:'Synthetic1',endsOn:shiftCalendarDays(bakuDate(),40),rooms:[{name:'1',pin:'0012'}]});
let entered,release;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r),rows=[];
const client={async open(){return{async upsert(row){rows.push(row);entered();await gate;}};}};
const first=syncRoomSheetBatch(f.pool,security,'synthetic',client);await started;
await syncRoomSheetBatch(f.pool,security,'synthetic',client);assert.equal(rows.length,1,'parallel workers cannot both write');
let changed=false;const update=f.pool.query('update netflix_room_groups set account_cipher=$2 where id=$1',[group,security.encryptSecret(JSON.stringify({id:group,email:'synthetic@example.test',password:'Synthetic2'}))]).then(()=>changed=true);
await new Promise(r=>setTimeout(r,100));assert.equal(changed,false,'password update waits for stale writer to finish');release();await first;await update;
await f.pool.query("update netflix_room_sheet_sync set retry_at='-infinity'");await syncRoomSheetBatch(f.pool,security,'synthetic',client);assert.equal(rows.at(-1)[3],'Synthetic2');
console.log('PASS: simultaneous workers serialized; account/room row lock fences password/stock mutations; new credential revision follows old response; fresh worker restarts from persisted checkpoint');
}finally{await f.close();}
