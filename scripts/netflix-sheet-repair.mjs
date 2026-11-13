// Narrow, private recovery. No orders, deliveries, wallet writes or emails.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {roomSheetClient,roomIdentityMatches,locateCustomerIdCell,examplesTitle,sheetHeaders} from '../mirpanel-admin/community/netflix-room-sheet-client.mjs';
import {roomStates} from '../mirpanel-admin/community/netflix-room-state.mjs';
const expectedSheet='1ZdZEzTWSMsV8yXu7xoebKfrHYO5cHdT9-jjEyT_AqWw';
const apply=process.argv.includes('--apply');
const root=path.resolve('outputs/netflix-sheet-recovery',new Date().toISOString().replace(/[:.]/g,'-'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let pool;
async function privateBytes(input,unprotect=false){
 const verb=unprotect?'Unprotect':'Protect';
 const command=`Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[Security.Cryptography.ProtectedData]::${verb}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))`;
 return await new Promise((resolve,reject)=>{
  const child=execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,maxBuffer:128*1024*1024},(error,stdout,stderr)=>error?reject(Error('PRIVATE_BACKUP_FAILED_'+String(error.code??'UNKNOWN').replace(/[^A-Z0-9_]/gi,'_')+'_'+(stderr.includes('FromBase64String')?'ENCODING':stderr.includes('Protect')?'DPAPI':'PROCESS'))):resolve(Buffer.from(stdout.trim(),'base64')));
  child.stdin.end(input.toString('base64'));
 });
}
try{
 const config=await fs.readFile(path.join(process.env.USERPROFILE,'.render/cli.yaml'),'utf8');
 const key=config.match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
 const setting=async name=>{
  const r=await fetch('https://api.render.com/v1/services/srv-d8ead74m0tmc73emhsvg/env-vars/'+name,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('RENDER_'+r.status);const d=await r.json();return d.value??d.envVar?.value;
 };
 const names=['COMMUNITY_DATABASE_URL','COMMUNITY_DATABASE_CA','PAYMENT_ENCRYPTION_KEY_B64','PAYMENT_TOKEN_SECRET_B64','NETFLIX_ROOM_SHEET_SERVICE_ACCOUNT','NETFLIX_ROOM_SHEET_ID','NETFLIX_ROOM_SHEET_OWNER_EMAIL'];
 const env=Object.fromEntries(await Promise.all(names.map(async n=>[n,await setting(n)])));
 if(env.NETFLIX_ROOM_SHEET_ID!==expectedSheet)throw Error('SHEET_ID_MISMATCH');
 const database=new URL(env.COMMUNITY_DATABASE_URL);
 if(!(database.hostname==='db.sidgtcgyqkdplgfabmmp.supabase.co'||database.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(database.username).endsWith('.sidgtcgyqkdplgfabmmp')))throw Error('DATABASE_PROJECT_MISMATCH');
 const account=JSON.parse(env.NETFLIX_ROOM_SHEET_SERVICE_ACCOUNT),now=Math.floor(Date.now()/1000);
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const payload=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:account.client_email,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+300,scope:'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly'});
 const signature=crypto.createSign('RSA-SHA256').update(payload).sign(account.private_key,'base64url');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:payload+'.'+signature}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('GOOGLE_AUTH_'+response.status);const token=(await response.json()).access_token;
 const get=async url=>{const r=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('GOOGLE_READ_'+r.status);return r.json();};
 const endpoint='https://sheets.googleapis.com/v4/spreadsheets/'+expectedSheet;
 const read=()=>get(endpoint+'?includeGridData=true');
 const spreadsheet=await read();
 const permissions=await get('https://www.googleapis.com/drive/v3/files/'+expectedSheet+'/permissions?fields=permissions(type,role,emailAddress,deleted),nextPageToken');
 await fs.mkdir(root,{recursive:true});
 const bytes=Buffer.from(JSON.stringify({createdAt:new Date().toISOString(),spreadsheet,permissions}));
 const encrypted=await privateBytes(bytes);await fs.writeFile(path.join(root,'spreadsheet-backup.dpapi'),encrypted);
 const restored=await privateBytes(await fs.readFile(path.join(root,'spreadsheet-backup.dpapi')),true);
 if(hash(bytes)!==hash(restored))throw Error('BACKUP_VERIFY_FAILED');
 console.log(JSON.stringify({backupVerified:true,backupDirectory:root,backupSha256:hash(bytes)}));
 const stockTab=book=>{const tabs=book.sheets.filter(s=>s.properties.title!==examplesTitle);if(tabs.length!==1)throw Error('STOCK_TAB_AMBIGUOUS');return tabs[0];};
 const cells=book=>(stockTab(book).data?.[0]?.rowData||[]).map(({values=[]})=>Array.from({length:8},(_,i)=>{
  const cell=values[i],v=cell?.userEnteredValue;
  if(!v)return '';
  if(v.formulaValue!==undefined)return v.formulaValue;
  if(i===1&&v.numberValue!==undefined)return cell.formattedValue??v.numberValue;
  return v.stringValue??v.numberValue??v.boolValue??'';
 }));
 const rows=cells(spreadsheet);
 if(JSON.stringify(rows[0]?.slice(0,6))!==JSON.stringify(sheetHeaders))throw Error('SHEET_HEADERS_MISMATCH');
 pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},max:1,connectionTimeoutMillis:20000,options:'-c default_transaction_read_only=on -c statement_timeout=30000'});
 const security=createPaymentSecurity({encryptionKey:env.PAYMENT_ENCRYPTION_KEY_B64,tokenSecret:env.PAYMENT_TOKEN_SECRET_B64});
 const deliveries=(await pool.query(`select d.id,d.order_id,d.line_index,d.message_cipher,n.member_number::text,r.id room_id,
  exists(select 1 from mirpanel_community.subscription_renewals v join public.payment_orders ro on ro.id=v.order_id
   where v.source_id=d.id and v.user_id=u.user_id and ro.status not in ('cancelled','rejected','expired')
    and (ro.payment_confirmed or ro.status in ('approved','completed'))) renewed
  from mirpanel_community.customer_order_deliveries d join public.payment_orders o on o.id=d.order_id
  join mirpanel_community.community_order_owners u on u.order_id=o.id
  left join mirpanel_community.community_member_numbers n on n.user_id=u.user_id
  left join mirpanel_community.netflix_room_units r on r.delivery_id=d.id
  where coalesce(o.checkout_snapshot->'items'->d.line_index->>'productId',o.checkout_snapshot->>'productId',o.product_id)='netflix'
   and (o.payment_confirmed or o.status in ('approved','completed')) and o.status not in ('cancelled','rejected','expired')
   and not exists(select 1 from mirpanel_community.netflix_room_assignment_history h where h.delivery_id=d.id)
  order by d.delivered_at,d.id`)).rows;
 const claims=[],issues=[];
 for(const d of deliveries){
  let snapshot;try{snapshot=JSON.parse(security.decryptSecret(d.message_cipher));}catch{}
  if(snapshot?.id!==d.id||snapshot?.order!==d.order_id||snapshot?.line!==d.line_index){issues.push({kind:'invalid_snapshot'});continue;}
  if(!snapshot.email||!snapshot.roomName||!snapshot.roomCode){issues.push({kind:'unstructured_delivery'});continue;}
  claims.push({identity:snapshot,member:d.member_number,status:d.renewed?'✓ Yenilənib':'✓ Satılıb',source:'delivery',roomId:d.room_id});
 }
 const rooms=await roomStates(pool);
 for(const room of rooms.filter(r=>!r.deleted_at&&r.legacy_assignment_id)){
  const a=JSON.parse(security.decryptSecret(room.account_cipher)),p=JSON.parse(security.decryptSecret(room.pin_cipher));
  if(a.id!==room.group_id||p.id!==room.id)throw Error('LEGACY_REFERENCE_MISMATCH');
  claims.push({identity:{email:a.email,roomName:room.room_name,roomCode:p.pin},member:room.member_number,status:'✓ Satılıb',source:'legacy'});
 }
 const proposed=new Map(),conflicts=new Set();
 for(const claim of claims){
  const result=locateCustomerIdCell(rows,claim.identity,claim.member??'');
  if(result.reason){
   const emailRows=rows.filter(row=>String(row[2]??'').trim().toLowerCase()===String(claim.identity.email).trim().toLowerCase());
   issues.push({kind:result.reason,emailMatches:emailRows.length,stockLinked:!!claim.roomId,
    stableIdFound:!!claim.roomId&&rows.some(row=>row[6]===claim.roomId),
    demoAddress:/@(?:[^@]*\.)?(?:example\.(?:com|org|net)|[^@]*\.test|[^@]*\.invalid)$/i.test(claim.identity.email),
    pinMatches:emailRows.filter(row=>String(row[1]??'').replace(/\D/g,'').endsWith(String(claim.identity.roomCode))).length});continue;
  }
  const index=result.rowIndex??rows.findIndex((r,i)=>i>0&&roomIdentityMatches(r,claim.identity));
  const previous=proposed.get(index);
  if(previous&&previous.member!==claim.member){conflicts.add(index);issues.push({kind:'multiple_buyers'});continue;}
  if(previous?.status==='✓ Yenilənib')continue;
  proposed.set(index,{...claim,index});
 }
 for(const index of conflicts)proposed.delete(index);
 // A blank stock state never authorizes removal of an existing sheet owner.
 let freeStatusCandidates=0;
 for(const room of rooms.filter(r=>!r.deleted_at&&!r.synthetic&&r.state==='free'&&!r.delivery_id&&!r.legacy_assignment_id)){
  const a=JSON.parse(security.decryptSecret(room.account_cipher)),p=JSON.parse(security.decryptSecret(room.pin_cipher));
  const identity={email:a.email,roomName:room.room_name,roomCode:p.pin};
  const matches=rows.flatMap((r,i)=>i>0&&roomIdentityMatches(r,identity)?[i]:[]);
  if(matches.length!==1||proposed.has(matches[0])||conflicts.has(matches[0]))continue;
  if(rows[matches[0]][0]!=='')continue;
  if(rows[matches[0]][5]!=='✕ Satılmayıb')freeStatusCandidates++;
 }
 const idCandidates=[...proposed.values()].filter(c=>String(rows[c.index][0]??'')!==c.member).length;
 const statusCandidates=[...proposed.values()].filter(c=>rows[c.index][5]!==c.status).length;
 const reasonCounts=Object.fromEntries([...new Set(issues.map(i=>i.kind))].map(k=>[k,issues.filter(i=>i.kind===k).length]));
 const summary={mode:apply?'repair':'audit',sheetRows:rows.length-1,stockRooms:rooms.length,paidDeliveries:deliveries.length,legacyAssignments:claims.filter(c=>c.source==='legacy').length,uniqueProvenRows:proposed.size,idCandidates,statusCandidates,freeStatusCandidates,openIssues:reasonCounts,
  issueDiagnostics:issues};
 if(apply){
  let lastRequest=0;
  const quotaFetch=async(url,options)=>{
   for(let attempt=0;attempt<4;attempt++){
    const wait=Math.max(0,lastRequest+1150-Date.now());if(wait)await new Promise(r=>setTimeout(r,wait));
    lastRequest=Date.now();const response=await fetch(url,options);
    if(response.ok)return response;
    console.log(JSON.stringify({googleHttpStatus:response.status,retry:attempt+1}));
    if(![429,500,502,503,504].includes(response.status)||attempt===3)return response;
    await new Promise(r=>setTimeout(r,Math.min(30000,Math.max(2000,Number(response.headers.get('retry-after')||0)*1000,2000*2**attempt))));
   }
  };
  const client=roomSheetClient(expectedSheet,account,env.NETFLIX_ROOM_SHEET_OWNER_EMAIL,quotaFetch);
  let count=0;
  for(const claim of proposed.values()){
   if(String(rows[claim.index][0]??'')===claim.member&&rows[claim.index][5]===claim.status)continue;
   const r=await client.writeCustomerId(claim.identity,claim.member,{status:claim.status});
   if(!r.done)throw Error('REPAIR_CONFLICT_'+String(r.reason).toUpperCase());
   count++;if(count%5===0)console.log(JSON.stringify({verifiedWrites:count}));
  }
  const verified=cells(await read());
  for(const claim of proposed.values()){
   const r=locateCustomerIdCell(verified,claim.identity,claim.member);
   const index=verified.findIndex((row,i)=>i>0&&roomIdentityMatches(row,claim.identity));
   if(!r.done||verified[index]?.[5]!==claim.status)throw Error('REPAIR_READBACK_FAILED');
  }
  summary.restoredIds=idCandidates;summary.restoredStatuses=statusCandidates;summary.readbackVerified=true;
 }
 await fs.writeFile(path.join(root,'summary.json'),JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary));
}catch(e){console.log(JSON.stringify({error:/^[A-Z][A-Z_0-9]+$/.test(e.message)?e.message:e.code||'PRIVATE_RECOVERY_FAILED'}));process.exitCode=1;}
finally{await pool?.end();}
