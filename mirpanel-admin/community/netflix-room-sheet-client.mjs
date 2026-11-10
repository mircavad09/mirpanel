import {createSign} from 'node:crypto';
import {roomSheetCells,roomSheetStyleKey,roomSheetStyleVersion,roomSheetStyleRequests,roomPresentationUpdates,roomStatusStyles} from './netflix-room-sheet-style.mjs';

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
 return {async open(){
  // Verify the destination before sending any account data. Reject shared drives,
  // groups, domains, public links and additional editors.
  const drive='https://www.googleapis.com/drive/v3/files/'+id;
  const permissions=await request(drive+'/permissions?fields=nextPageToken,permissions(type,role,emailAddress,deleted)&pageSize=100');
  const entries=permissions.permissions||[];
  if(permissions.nextPageToken||entries.length!==2||
     !entries.some(p=>p.type==='user'&&p.role==='owner'&&!p.deleted&&p.emailAddress?.toLowerCase()===ownerEmail.toLowerCase())||
     !entries.some(p=>p.type==='user'&&p.role==='writer'&&!p.deleted&&p.emailAddress===account.client_email))
   throw Error('ROOM_SHEET_ACCESS');
  const metadata=await request(endpoint+'?fields=properties(title),sheets(properties(sheetId,title,gridProperties(columnCount,rowCount)),developerMetadata,conditionalFormats)');
  const stockSheets=metadata.sheets?.filter(sheet=>sheet.properties.title!==examplesTitle)??[];
  if(stockSheets.length!==1||metadata.sheets.length>2)throw Error('ROOM_SHEET_DESTINATION');
  const stockSheet=stockSheets[0];
  const {sheetId,title}=stockSheet.properties;
  const range=name=>endpoint+'/values/'+encodeURIComponent("'"+title.replaceAll("'","''")+"'!"+name);
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
  const styled=stockSheet.developerMetadata?.some(item=>
   item.metadataKey===roomSheetStyleKey&&item.metadataValue===roomSheetStyleVersion);
  if(!styled){
   const rows=(await request(range('A2:G')+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER')).values||[];
   const updates=roomPresentationUpdates(sheetId,rows);
   const captions=new Set(roomStatusStyles.map(status=>status.caption));
   const rules=stockSheet.conditionalFormats||[];
   const cleanup=rules.flatMap((rule,index)=>{
    const owned=rule.ranges?.length===1&&rule.ranges[0].startColumnIndex===5&&rule.ranges[0].endColumnIndex===6&&
     (['TEXT_EQ','TEXT_STARTS_WITH'].includes(rule.booleanRule?.condition?.type)&&captions.has(rule.booleanRule.condition.values?.[0]?.userEnteredValue)||
      rule.booleanRule?.condition?.type==='CUSTOM_FORMULA'&&[...captions].some(caption=>
       rule.booleanRule.condition.values?.[0]?.userEnteredValue==='=LEFT($F2,FIND(CHAR(10),$F2&CHAR(10))-1)="'+caption+'"'));
    return owned?[{deleteConditionalFormatRule:{sheetId,index}}]:[];
   }).reverse();
   await request(endpoint+':batchUpdate',{requests:[...cleanup,...roomSheetStyleRequests(sheetId)]});
   for(let offset=0;offset<updates.length;offset+=200){
    await request(endpoint+':batchUpdate',{requests:updates.slice(offset,offset+200)});
   }
   if(rows.length)await request(endpoint+':batchUpdate',{requests:[{
    autoResizeDimensions:{dimensions:{sheetId,dimension:'ROWS',startIndex:1,endIndex:rows.length+1}}
   }]});
   await request(endpoint+':batchUpdate',{requests:[{createDeveloperMetadata:{developerMetadata:{
    metadataKey:roomSheetStyleKey,metadataValue:roomSheetStyleVersion,visibility:'DOCUMENT',location:{sheetId}
   }}}]});
  }
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
   const ids=(await request(range('G2:G'))).values||[];
   const rowIndex=locateRoomRow(ids,values[6]);
   const row={values:roomSheetCells(values)};
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
