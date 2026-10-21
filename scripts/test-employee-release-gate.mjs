import {spawn} from 'node:child_process';import fs from 'node:fs';
const suites=['test-employee-reporting','test-employee-panel-db','test-employee-http','test-employee-release','test-employee-admin-bridge','test-employee-key','test-employee-real-postgres','test-employee-browser','test-employee-review','test-employee-review-postgres','test-employee-review-browser','test-payment-system','test-payment-orders-admin','test-admin-auth-boundary','test-payment-method-selection','test-payment-receipt-browser','test-payment-orders-browser','test-order-duration-filter','test-product-order-isolation','test-old-order-approval-database'];
const results=[];
for(const suite of suites){
 console.log('RUN '+suite);
 const result=await new Promise(resolve=>{const child=spawn(process.execPath,['scripts/'+suite+'.mjs'],{env:{...process.env,MIRPANEL_TEST_LIVE:'0',MIRPANEL_TEST_LOCAL_ONLY:'1',MIRPANEL_REAL_TEST:'1'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);child.on('error',error=>resolve({suite,exitCode:1,stdout,stderr:error.message}));child.on('exit',exitCode=>resolve({suite,exitCode,stdout,stderr}));});
 results.push(result);console.log((result.exitCode===0?'PASS ':'FAIL ')+suite);
 if(result.exitCode!==0){console.log(result.stdout);console.error(result.stderr);break;}
}
const failed=results.filter(r=>r.exitCode!==0).length,report={ok:!failed&&results.length===suites.length,suites:results.length,expectedSuites:suites.length,passed:results.length-failed,failed,reportedEmployeeChecks:results.filter(r=>r.suite.startsWith('test-employee-')).reduce((sum,r)=>sum+Number(r.stdout.match(/"checks":\s*(\d+)/)?.[1]||0),0),productionWrites:0,results};
fs.mkdirSync('payment-test-artifacts',{recursive:true});fs.writeFileSync('payment-test-artifacts/employee-release-gate-result.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:results.map(({suite,exitCode})=>({suite,exitCode}))},null,2));
if(!report.ok)process.exitCode=1;
