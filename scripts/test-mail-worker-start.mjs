import assert from 'node:assert/strict';
import {startMailWorkers} from '../mirpanel-admin/community/mail-worker-start.mjs';
let calls=0;const delays=[],signals=[];
await startMailWorkers(async()=>{if(++calls<3)throw Object.assign(Error('Never log recipient or key'),{code:'ECONNRESET'});},{wait:async ms=>delays.push(ms),report:(...args)=>signals.push(args)});
assert.equal(calls,3);assert.deepEqual(delays,[2000,4000]);assert.equal(signals.at(-1)[0],'COMMUNITY_MAIL_WORKERS_READY');assert(!JSON.stringify(signals).includes('recipient'));
let failures=0;await assert.rejects(()=>startMailWorkers(async()=>{failures++;throw Error('unavailable');},{attempts:3,wait:async()=>{},report:()=>{}}));assert.equal(failures,3);
console.log(JSON.stringify({startupRecovery:true,boundedRetries:true,noDuplicateStartAfterSuccess:true,noSensitiveErrorMessages:true,realEmails:0}));
