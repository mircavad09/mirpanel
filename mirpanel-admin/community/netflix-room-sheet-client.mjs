import {createSign} from 'node:crypto';

export const sheetTitle='Netflix Şəxsi — Otaq stoku';
export const sheetHeaders=['Müştəri ID-si','Otaq adı və PIN','Gmail','Şifrə','Bitmə tarixi','Status'];
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
  const metadata=await request(endpoint+'?fields=properties(title),sheets(properties(sheetId,title,gridProperties(columnCount)))');
  if(metadata.sheets?.length!==1)throw Error('ROOM_SHEET_DESTINATION');
  const {sheetId,title}=metadata.sheets[0].properties;
  const range=name=>endpoint+'/values/'+encodeURIComponent("'"+title.replaceAll("'","''")+"'!"+name);
  const header=[...sheetHeaders,'Stok otağının ID-si'];
  const columns=metadata.sheets[0].properties.gridProperties?.columnCount??26;
  const lastColumn=String.fromCharCode(64+Math.min(columns,8));
  const existing=(await request(range('A1:'+lastColumn+'1'))).values?.[0]||[];
  if(!existing.length){
   if((await request(range('A2:'+lastColumn))).values?.length)throw Error('ROOM_SHEET_HEADERS');
   const requests=[
    {updateSpreadsheetProperties:{properties:{title:sheetTitle},fields:'title'}},
    {updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:[{values:header.map(stringValue=>({userEnteredValue:{stringValue}}))}],fields:'userEnteredValue'}},
    {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:6,endIndex:7},properties:{hiddenByUser:true},fields:'hiddenByUser'}}
   ];
   if(columns<7)requests.unshift({appendDimension:{sheetId,dimension:'COLUMNS',length:7-columns}});
   await request(endpoint+':batchUpdate',{requests});
  }else if(metadata.properties?.title!==sheetTitle||JSON.stringify(existing)!==JSON.stringify(header))throw Error('ROOM_SHEET_HEADERS');
  return {async upsert(values){
   const ids=(await request(range('G2:G'))).values||[];
   const rowIndex=locateRoomRow(ids,values[6]);
   // stringValue prevents spreadsheet formula injection and preserves leading zeros.
   const row={values:values.map((value,index)=>({userEnteredValue:{stringValue:String(value)},
    ...(index===5?{userEnteredFormat:{textFormat:{foregroundColor:value===paidStatus?{red:.1,green:.55,blue:.23}:{red:0,green:0,blue:0},bold:value===paidStatus}}}:{})}))};
   const operation=rowIndex===null
    ? {appendCells:{sheetId,rows:[row],fields:'userEnteredValue,userEnteredFormat.textFormat'}}
    : {updateCells:{start:{sheetId,rowIndex,columnIndex:0},rows:[row],fields:'userEnteredValue,userEnteredFormat.textFormat'}};
   await request(endpoint+':batchUpdate',{requests:[operation]});
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
