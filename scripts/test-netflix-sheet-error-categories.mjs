import assert from 'node:assert/strict';import crypto from 'node:crypto';import {roomSheetClient} from '../mirpanel-admin/community/netflix-room-sheet-client.mjs';import {sheetReason,sheetIssue} from '../mirpanel-admin/community/netflix-sheet-errors.mjs';
const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),account={client_email:'synthetic@test.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
for(const [status,reason] of [[401,'auth'],[403,'permission'],[404,'destination'],[429,'quota'],[503,'connection']]){
 const client=roomSheetClient('synthetic-spreadsheet-id',account,'owner@example.test',async url=>url.endsWith('/token')?Response.json({access_token:'synthetic',expires_in:3600}):Response.json({error:{errors:[]}},{status}));
 await assert.rejects(client.writeCustomerId({email:'synthetic@example.test',roomName:'1',roomCode:'0408'},'1001'),error=>sheetReason(error)===reason);
 assert(sheetIssue(reason).message&&sheetIssue(reason).fix);
}
console.log('PASS: Google HTTP authentication, permission, destination, quota and connection failures remain distinct; no write attempted');
