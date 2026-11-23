import assert from 'node:assert/strict';
import {walletDeviceSupports} from '../mirpanel-admin/community/public/epoint-wallet.js';
assert.equal(await walletDeviceSupports('m10',{}),true);
assert.equal(await walletDeviceSupports('birbank',{}),true);
assert.equal(await walletDeviceSupports('apple-pay',{}),false);
assert.equal(await walletDeviceSupports('apple-pay',{navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},ApplePaySession:{canMakePayments:()=>true}}),true);
for(const userAgent of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1']){
 assert.equal(await walletDeviceSupports('apple-pay',{navigator:{userAgent},ApplePaySession:{canMakePayments:()=>true}}),true,'supported iPhone browsers are not hidden by browser-name filtering');
}
for(const userAgent of ['Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605.1.15','Mozilla/5.0 (iPad) Safari/605.1.15']){
 assert.equal(await walletDeviceSupports('apple-pay',{navigator:{userAgent},ApplePaySession:{canMakePayments:()=>true}}),false,'owner policy excludes iPad and Mac even with Apple capability');
}
assert.equal(await walletDeviceSupports('apple-pay',{navigator:{userAgent:'Mozilla/5.0 (Linux; Android 14)'},ApplePaySession:{canMakePayments:()=>true}}),false);
assert.equal(await walletDeviceSupports('apple-pay',{navigator:{userAgent:'iPhone'},ApplePaySession:{canMakePayments:()=>false}}),false,'iPhone name alone is insufficient');
assert.equal(await walletDeviceSupports('apple-pay',{ApplePaySession:{canMakePayments:()=>false}}),false);
assert.equal(await walletDeviceSupports('apple-pay',{ApplePaySession:{canMakePayments:()=>{throw Error('unsupported context');}}}),false);
let parameters;
const android={userAgent:'Mozilla/5.0 (Linux; Android 14) Chrome/140.0'};
const device={navigator:android,PaymentRequest:class{constructor(methods){parameters=methods[0].data.allowedPaymentMethods[0].parameters;}canMakePayment(){return Promise.resolve(true);}}};
assert.equal(await walletDeviceSupports('google-pay',device),true);
assert.equal(await walletDeviceSupports('google-pay',{...device,navigator:{userAgent:'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0'}}),false,'desktop positive capability must not advertise Android device tokens');
assert.deepEqual(parameters.allowedAuthMethods,['CRYPTOGRAM_3DS']);
assert.equal(await walletDeviceSupports('google-pay',{navigator:android,PaymentRequest:class{canMakePayment(){return Promise.reject(Error('not supported'));}}}),false);
const before=Date.now();
assert.equal(await walletDeviceSupports('google-pay',{navigator:android,PaymentRequest:class{canMakePayment(){return new Promise(()=>{});}}}),false);
assert(Date.now()-before<4000);
console.log('PASS capability probes: token-only parameters, unsupported device, rejected probe and bounded stalled probe; no provider requests');
