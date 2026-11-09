import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
import {createEpinbyConnection} from '../mirpanel-admin/epinby-connection.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';

const control=new pg.Pool({host:'127.0.0.1',port:55493,user:'postgres',database:'postgres'});
const database='epinby_test_'+Date.now();
await control.query('create database '+database);
const pool=new pg.Pool({host:'127.0.0.1',port:55493,user:'postgres',database});
const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
let outcome='confirmed',calls=0;
const transport=async input=>{
 calls++;
 assert.equal(input.base,'https://epinby.com');
 assert.equal(input.path,'/api/v1/getMe');
 assert.equal(input.authHeader,'X-API-Key');
 assert.equal(input.key,'synthetic-api-key');
 assert.equal(input.body,undefined);
 if(outcome==='invalid_key')throw {supplierStatus:401};
 if(outcome==='network_error')throw {code:'ECONNRESET'};
 if(outcome==='timeout')throw {code:'ABORT_ERR'};
 return {success:true,data:{balance:'123.4500',currency:'AZN',webhook_secret:'must-never-return'}};
};
const create=()=>createEpinbyConnection({pool:()=>pool,security,transport});
try{
 await pool.query('create schema mirpanel_community');
 await pool.query(await readFile('supabase/migrations/202611090903_epinby_connection.sql','utf8'));
 let api=create();
 assert.equal((await api({action:'epinby-test'})).result,'unconfigured');
 assert.equal(calls,0);
 await api({action:'epinby-save',apiKey:'synthetic-api-key',webhookSecret:'synthetic-webhook'});
 const original=(await pool.query('select * from mirpanel_community.epinby_connection')).rows[0];
 assert.notEqual(original.api_key_cipher,'synthetic-api-key');
 assert.notEqual(original.webhook_secret_cipher,'synthetic-webhook');
 assert.equal(security.decryptSecret(original.webhook_secret_cipher),'synthetic-webhook');
 api=create();
 let state=await api();
 assert.equal(state.apiKeySaved,true);
 await api({action:'epinby-save',apiKey:'',webhookSecret:''});
 const preserved=(await pool.query('select * from mirpanel_community.epinby_connection')).rows[0];
 assert.equal(preserved.api_key_cipher,original.api_key_cipher);
 assert.equal(preserved.webhook_secret_cipher,original.webhook_secret_cipher);
 state=await api({action:'epinby-test'});
 assert.equal(state.result,'confirmed');
 assert.equal(state.balance,'123.4500');
 assert.equal(state.currency,'AZN');
 assert.ok(!JSON.stringify(state).includes('synthetic'));
 assert.ok(!JSON.stringify(state).includes('must-never-return'));
 const checked=state.lastCheckedAt;
 for(const failure of ['network_error','timeout']){
  outcome=failure;
  state=await api({action:'epinby-test'});
  assert.equal(state.result,failure);
  assert.equal(+new Date(state.lastCheckedAt),+new Date(checked));
  assert.equal(state.lastStatus,'confirmed');
 }
 outcome='invalid_key';
 state=await api({action:'epinby-test'});
 assert.equal(state.lastStatus,'invalid_key');
 await api({action:'epinby-save',apiKey:'replacement'});
 state=await api();
 assert.equal(state.lastStatus,null);
 assert.equal(state.balance,null);
 assert.equal(state.webhookSecretSaved,true);
 await assert.rejects(api({action:'epinby-save',apiKey:'bad\r\nkey'}),{status:400});
 console.log('PASS Epinby encrypted persistence, blank preservation, getMe, currency, network/timeout history, invalid key.');
}finally{
 await pool.end();
 await control.query('drop database '+database);
 await control.end();
}
