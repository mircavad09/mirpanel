import {createSign} from 'node:crypto';
import {roomSheetCells,roomSheetStyleKey,roomSheetStyleVersion,roomSheetStyleRequests,roomPresentationUpdates,roomStatusStyles,roomStripeFormula} from './netflix-room-sheet-style.mjs';

export const sheetTitle='Netflix Şəxsi — Otaq stoku';
export const sheetHeaders=['Müştəri ID-si','Otaq adı və PIN','Gmail','Şifrə','Bitmə tarixi','Status'];
export const examplesTitle='SINAQ — nümunələr';
export const paidStatus='✓ Ödəniş edib';
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const tokenURL='https://oauth2.googleapis.com/token';

export function roomSheetClient(id,account,ownerEmail,http=fetch){
 if(!/^[\w-]{20,}$/.test(id)||!account.client_email?.endsWith('.gserviceaccount.com')||!account.private_key||
    !ownerEmail||ownerEmail.toLowerCase()===account.client_email.toLowerCase())
  throw Error('ROOM_SHEET_CONFIG');
 const endpoint='https://sheets.googleapis.com/v4/spreadsheets/'+id;
 let token,validUntil=0;
 async function access(){
  const now=Math.floor(Date.now()/1000);
  if(token&&now<validUntil)return token;
  const claims=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:account.client_email,aud:tokenURL,iat:now,exp:now+300,
   scope:'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly'});
  const signature=createSign('RSA-SHA256').update(claims).sign(account.private_key,'base64url');
  const response=await http(tokenURL,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
   body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:claims+'.'+signature})});
  if(!response.ok)throw Error('ROOM_SHEET_AUTH');
  const data=await response.json();
  token=data.access_token;validUntil=now+Number(data.expires_in)-60;
  if(!token)throw Error('ROOM_SHEET_AUTH');
  return token;
 }
 async function request(url,body){
  const response=await http(url,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{Authorization:'Bearer '+await access(),...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error('ROOM_SHEET_REQUEST');
  return response.json();
 }
 async function stockDestination(){
  // Verify the destination before sending any account data. Reject shared drives,
  // groups, domains, public links and additional editors.
  const drive='https://www.googleapis.com/drive/v3/files/'+id;
  const permissions=await request(drive+'/permissions?fields=nextPageToken,permissions(type,role,emailAddress,deleted)&pageSize=100');
  const entries=permissions.permissions||[];
  if(permissions.nextPageToken||entries.length!==2||
     !entries.some(p=>p.type==='user'&&p.role==='owner'&&!p.deleted&&p.emailAddress?.toLowerCase()===ownerEmail.toLowerCase())||
     !entries.some(p=>p.type==='user'&&p.role==='writer'&&!p.deleted&&p.emailAddress===account.client_email))
   throw Error('ROOM_SHEET_ACCESS');
  const metadata=await request(endpoint+'?fields=properties(title),sheets(properties(sheetId,title,gridProperties(columnCount,rowCount)),developerMetadata,conditionalFormats,basicFilter,filterViews,bandedRanges)');
  const stockSheets=metadata.sheets?.filter(sheet=>sheet.properties.title!==examplesTitle)??[];
  if(stockSheets.length!==1||metadata.sheets.length>2)throw Error('ROOM_SHEET_DESTINATION');
  const stockSheet=stockSheets[0];
  const {sheetId,title}=stockSheet.properties;
  const range=name=>endpoint+'/values/'+encodeURIComponent("'"+title.replaceAll("'","''")+"'!"+name);
  return {metadata,stockSheet,sheetId,range};
 }
 async function applyStyle(stockSheet,sheetId,range){
  if(stockSheet.developerMetadata?.some(item=>
   item.metadataKey===roomSheetStyleKey&&item.metadataValue===roomSheetStyleVersion))return;
  const dates=(await request(range('E2:E')+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER')).values||[];
  const updates=roomPresentationUpdates(sheetId,dates);
  const captions=new Set(roomStatusStyles.map(status=>status.caption));
  const rules=stockSheet.conditionalFormats||[];
  const cleanup=rules.flatMap((rule,index)=>{
   const owned=rule.ranges?.length===1&&rule.ranges[0].startColumnIndex===5&&rule.ranges[0].endColumnIndex===6&&
    (['TEXT_EQ','TEXT_STARTS_WITH'].includes(rule.booleanRule?.condition?.type)&&captions.has(rule.booleanRule.condition.values?.[0]?.userEnteredValue)||
     rule.booleanRule?.condition?.type==='CUSTOM_FORMULA'&&[...captions].some(caption=>
      rule.booleanRule.condition.values?.[0]?.userEnteredValue==='=LEFT($F2,FIND(CHAR(10),$F2&CHAR(10))-1)="'+caption+'"'));
   const stripe=rule.ranges?.length===1&&rule.ranges[0].startRowIndex===1&&
    !rule.ranges[0].startColumnIndex&&rule.ranges[0].endColumnIndex===6&&
    rule.booleanRule?.condition?.type==='CUSTOM_FORMULA'&&
    rule.booleanRule.condition.values?.[0]?.userEnteredValue===roomStripeFormula;
   return (owned||stripe)?[{deleteConditionalFormatRule:{sheetId,index}}]:[];
  }).reverse();
  await request(endpoint+':batchUpdate',{requests:[...cleanup,...roomSheetStyleRequests(sheetId)]});
  for(let offset=0;offset<updates.length;offset+=200){
   await request(endpoint+':batchUpdate',{requests:updates.slice(offset,offset+200)});
  }
  await request(endpoint+':batchUpdate',{requests:[{createDeveloperMetadata:{developerMetadata:{
   metadataKey:roomSheetStyleKey,metadataValue:roomSheetStyleVersion,visibility:'DOCUMENT',location:{sheetId}
  }}}]});
 }
 return {
 async applyLightStyle(){
  const {metadata,stockSheet,sheetId,range}=await stockDestination();
  const headers=(await request(range('A1:F1'))).values?.[0];
  if(metadata.properties?.title!==sheetTitle||JSON.stringify(headers)!==JSON.stringify(sheetHeaders))
   throw Error('ROOM_SHEET_HEADERS');
  await applyStyle(stockSheet,sheetId,range);
 },
 async writeCustomerId(delivery,memberNumber,{status='✓ Satılıb'}={}){
  const {sheetId,stockSheet}=await stockDestination();
  const range="'"+stockSheet.properties.title.replaceAll("'","''")+"'!A1:F";
  const query=new URLSearchParams({ranges:range,fields:'sheets(properties(sheetId),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,formattedValue))))'});
  const read=async()=>{
   const {sheets}=await request(endpoint+'?'+query);
   const grid=sheets?.find(sheet=>sheet.properties.sheetId===sheetId)?.data?.[0];
   if(!grid||grid.startRow||grid.startColumn)throw Error('ROOM_SHEET_DESTINATION');
   const rows=(grid.rowData||[]).map(({values=[]})=>[
    enteredCell(values[0]),
    // Legacy rows may store a number with a custom format displaying “room PIN”.
    // Read both representations together; never substitute a formula's display.
    values[1]?.userEnteredValue?.numberValue!==undefined?values[1].formattedValue:enteredCell(values[1],false),
    enteredCell(values[2],false),enteredCell(values[3]),enteredCell(values[4]),enteredCell(values[5])
   ]);
   const result=locateCustomerIdCell(rows,delivery,memberNumber);
   if(result.reason)return result;
   const rowIndex=result.rowIndex??rows.findIndex((row,i)=>i>0&&roomIdentityMatches(row,delivery));
   return {rowIndex,done:result.done&&rows[rowIndex]?.[5]===status};
  };
  // Resolve again immediately before writing to catch a sort, edit or conflict
  // that happened during the first read.
  const first=await read();
  if(first.reason||first.done)return first;
  const current=await read();
  if(current.reason||current.done)return current;
  await request(endpoint+':batchUpdate',{requests:[{updateCells:{
   start:{sheetId,rowIndex:current.rowIndex,columnIndex:0},
   rows:[{values:[{userEnteredValue:{stringValue:memberNumber}}]}],fields:'userEnteredValue'
  }},{updateCells:{start:{sheetId,rowIndex:current.rowIndex,columnIndex:5},
   rows:[{values:[{userEnteredValue:{stringValue:status}}]}],fields:'userEnteredValue'}}]});
  const saved=await read();
  if(!saved.done)throw Error('ROOM_SHEET_WRITE_NOT_CONFIRMED');
  return saved;
 },
 async open(){
  const {metadata,stockSheet,sheetId,range}=await stockDestination();
  const legacyHeader=[...sheetHeaders,'Stok otağının ID-si'];
  const header=[...legacyHeader,'Netflix hesabının ID-si'];
  const columns=stockSheet.properties.gridProperties?.columnCount??26;
  const lastColumn=String.fromCharCode(64+Math.min(columns,8));
  const existing=(await request(range('A1:'+lastColumn+'1'))).values?.[0]||[];
  if(!existing.length){
   if((await request(range('A2:'+lastColumn))).values?.length)throw Error('ROOM_SHEET_HEADERS');
   const requests=[
    {updateSpreadsheetProperties:{properties:{title:sheetTitle},fields:'title'}},
    {updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:[{values:header.map(stringValue=>({userEnteredValue:{stringValue}}))}],fields:'userEnteredValue'}},
    {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:6,endIndex:8},properties:{hiddenByUser:true},fields:'hiddenByUser'}}
   ];
   if(columns<8)requests.unshift({appendDimension:{sheetId,dimension:'COLUMNS',length:8-columns}});
   await request(endpoint+':batchUpdate',{requests});
  }else if(metadata.properties?.title!==sheetTitle)throw Error('ROOM_SHEET_HEADERS');
  else if(JSON.stringify(existing)===JSON.stringify(legacyHeader)){
   const requests=[{updateCells:{start:{sheetId,rowIndex:0,columnIndex:7},rows:[{values:[{userEnteredValue:{stringValue:header[7]}}]}],fields:'userEnteredValue'}}];
   if(columns<8)requests.unshift({appendDimension:{sheetId,dimension:'COLUMNS',length:8-columns}});
   await request(endpoint+':batchUpdate',{requests});
  }else if(JSON.stringify(existing)!==JSON.stringify(header))throw Error('ROOM_SHEET_HEADERS');
  await applyStyle(stockSheet,sheetId,range);
  return {async group(){
   const rows=(await request(range('A2:H')+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER')).values||[];
   const grouped=groupRoomRows(rows);if(!grouped)return;
   if(JSON.stringify(rows.map(r=>Array.from({length:8},(_,i)=>r[i]??'')))===JSON.stringify(grouped.rows))return;
   const requiredRows=Math.max(rows.length,grouped.rows.length)+1;
   const requests=[{updateCells:{range:{sheetId,startRowIndex:1,endRowIndex:requiredRows,startColumnIndex:0,endColumnIndex:8},
    rows:grouped.rows.map(values=>({values:roomSheetCells(values)})),fields:'userEnteredValue,userEnteredFormat'}}];
   const capacity=stockSheet.properties.gridProperties?.rowCount??1000;
   if(requiredRows>capacity)requests.unshift({appendDimension:{sheetId,dimension:'ROWS',length:requiredRows-capacity}});
   for(const index of grouped.ends)requests.push({updateBorders:{range:{sheetId,startRowIndex:index+1,endRowIndex:index+2,startColumnIndex:0,endColumnIndex:6},bottom:{style:'SOLID_MEDIUM',color:{red:.55,green:.55,blue:.55}}}});
   requests.push({autoResizeDimensions:{dimensions:{sheetId,dimension:'ROWS',startIndex:1,endIndex:grouped.rows.length+1}}});
   await request(endpoint+':batchUpdate',{requests});
  },async upsert(values){
   const read=async()=>{
    const q=new URLSearchParams({ranges:"'"+stockSheet.properties.title.replaceAll("'","''")+"'!A1:H",fields:'sheets(properties(sheetId),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,formattedValue))))'});
    const response=await request(endpoint+'?'+q),grid=response.sheets?.find(s=>s.properties.sheetId===sheetId)?.data?.[0];
    if(!grid||grid.startRow||grid.startColumn)throw Error('ROOM_SHEET_DESTINATION');
    const rows=(grid.rowData||[]).map(({values=[]})=>Array.from({length:8},(_,i)=>i===1&&values[i]?.userEnteredValue?.numberValue!==undefined?values[i].formattedValue:enteredCell(values[i])));
    const resolved=protectedRoomUpsert(rows,values);
    return {...resolved,actual:resolved.rowIndex===null?null:rows[resolved.rowIndex]};
   };
   await read();
   const {rowIndex,values:safeValues}=await read();
   const row={values:roomSheetCells(safeValues)};
   const operation=rowIndex===null
    ? {appendCells:{sheetId,rows:[row],fields:'userEnteredValue,userEnteredFormat'}}
    : {updateCells:{start:{sheetId,rowIndex,columnIndex:0},rows:[row],fields:'userEnteredValue,userEnteredFormat.numberFormat'}};
   await request(endpoint+':batchUpdate',{requests:[operation]});
   let updatedIndex=rowIndex;
   if(updatedIndex===null){
    const savedIds=(await request(range('G2:G'))).values||[];
    updatedIndex=locateRoomRow(savedIds,values[6]);
   }
   if(Number.isInteger(updatedIndex)&&updatedIndex>=1){
    await request(endpoint+':batchUpdate',{requests:[{
     autoResizeDimensions:{dimensions:{sheetId,dimension:'ROWS',startIndex:updatedIndex,endIndex:updatedIndex+1}}
    }]});
   }
   const saved=await read(),actual=saved.actual;
   if(!actual||String(actual[0]??'')!==String(safeValues[0])||actual[3]!==safeValues[3]||
    actual[5]!==row.values[5].userEnteredValue.stringValue||actual[6]!==safeValues[6])throw Error('ROOM_SHEET_WRITE_NOT_CONFIRMED');
  }};
 }};
}

export function locateRoomRow(ids,id){
 let row=null;
 for(const [index,cell] of ids.entries()){
  if(cell[0]!==id)continue;
  if(row!==null)throw Error('ROOM_SHEET_DUPLICATE_ID');
  row=index+1;
 }
 return row;
}

// Group solely by the hidden account ID. Empty separators never have a room ID.
export function groupRoomRows(rows){
 const uuid=x=>typeof x==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(x);
 const records=rows.filter(row=>{
  if(!row.some(v=>v!==''&&v!=null))return false;
  return !(row.slice(0,7).every(v=>v===''||v==null)&&String(row[7]).startsWith('separator:')&&uuid(row[7].slice(10)));
 });
 if(records.some(row=>!uuid(row[6])||!uuid(row[7])))return null;
 const ids=new Set();for(const row of records){if(ids.has(row[6]))throw Error('ROOM_SHEET_DUPLICATE_ID');ids.add(row[6]);}
 records.sort((a,b)=>a[7].localeCompare(b[7])||a[1].localeCompare(b[1],undefined,{numeric:true})||a[6].localeCompare(b[6]));
 const result=[],ends=[];
 for(const [n,row]of records.entries()){
  result.push(Array.from({length:8},(_,i)=>row[i]??''));
  if(records[n+1]?.[7]!==row[7]){ends.push(result.length-1);result.push([...Array(7).fill(''),'separator:'+row[7]]);}
 }
 return {rows:result,ends};
}


function matchText(value){return String(value??'').normalize('NFC').trim().toLowerCase();}
export function roomIdentityMatches(row,delivery){
 if(matchText(row[2])!==matchText(delivery.email)||!matchText(delivery.email)||!/^\d{4}$/.test(delivery.roomCode??''))return false;
 const raw=row[1];if(raw==null||String(raw).startsWith('='))return false;
 if(/^\d+$/.test(String(raw))&&/^\d+$/.test(delivery.roomName??'')&&String(raw)===delivery.roomName+delivery.roomCode)return true;
 const parts=String(raw).trim().match(/^(.+?)\s*(?:[·•|:–—-]|\s+)\s*(\d(?:[\s-]*\d){0,3})\s*$/u);
 return !!parts&&matchText(parts[1])===matchText(delivery.roomName)&&parts[2].replace(/[\s-]/g,'').padStart(4,'0')===delivery.roomCode;
}

// All whole-row writers share this ownership guard. Unknown ownership must
// never erase the proven owner written by a delivery job.
export function protectedRoomUpsert(rows,incoming){
 if(JSON.stringify(rows[0]?.slice(0,6))!==JSON.stringify(sheetHeaders))throw Error('ROOM_SHEET_HEADERS');
 const value=[...incoming],parsed=String(value[1]).match(/^(.+) · (\d{4})$/u);
 if(!parsed)throw Error('ROOM_SHEET_DATA');
 const identity={email:value[2],roomName:parsed[1],roomCode:parsed[2]};
 const matches=rows.flatMap((row,i)=>i>0&&roomIdentityMatches(row,identity)?[i]:[]);
 if(matches.length>1)throw Error('ROOM_SHEET_DUPLICATE');
 const keyed=locateRoomRow(rows.slice(1).map(row=>[row[6]]),value[6]);
 if(keyed!==null&&!roomIdentityMatches(rows[keyed],identity))throw Error('ROOM_SHEET_IDENTITY_CONFLICT');
 const rowIndex=keyed??matches[0]??null;
 if(rowIndex===null&&value[0]!=='')throw Error('ROOM_SHEET_MISSING');
 if(rowIndex!==null){
  const old=rows[rowIndex];
  if(old[6]&&old[6]!==value[6])throw Error('ROOM_SHEET_IDENTITY_CONFLICT');
  if(old[7]&&old[7]!==value[7])throw Error('ROOM_SHEET_IDENTITY_CONFLICT');
  if(old[0]!==''&&old[0]!=null){
   if(!/^\d+$/.test(String(old[0])))throw Error('ROOM_SHEET_OWNER_CONFLICT');
   if(value[0]!==''&&String(value[0])!==String(old[0]))throw Error('ROOM_SHEET_OWNER_CONFLICT');
   if(value[0]===''){value[0]=old[0];value[5]=old[5];}
  }
 }
 return {rowIndex,values:value};
}
function enteredCell(cell,includeEffective=true){
 const value=cell?.userEnteredValue??(includeEffective?cell?.effectiveValue:undefined);
 if(!value)return undefined;
 return value.formulaValue??value.stringValue??value.numberValue??value.boolValue??'#CELL_ERROR';
}
export function locateCustomerIdCell(rows,delivery,memberNumber){
 if(JSON.stringify(rows[0]?.slice(0,3))!==JSON.stringify(sheetHeaders.slice(0,3)))return {reason:'headers'};
 const email=matchText(delivery.email),name=matchText(delivery.roomName);
 if(!email||!name||!/^\d{4}$/.test(delivery.roomCode??'')||!/^\d+$/.test(memberNumber))return {reason:'delivery'};
 const matches=[];
 for(let i=1;i<rows.length;i++){
  const [id,room,gmail]=rows[i];
  if(roomIdentityMatches([id,room,gmail],delivery))matches.push({id,rowIndex:i});
 }
 if(!matches.length)return {reason:'missing'};
 if(matches.length!==1)return {reason:'duplicate'};
 const {id,rowIndex}=matches[0];
 if(String(id??'')===memberNumber)return {done:true};
 if(id!==''&&id!==undefined&&id!==null)return {reason:'conflict'};
 return {rowIndex};
}
