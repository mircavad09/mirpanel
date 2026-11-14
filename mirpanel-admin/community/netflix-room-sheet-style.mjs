import {safeCalendarDate} from '../payment-order-lifecycle.mjs';

export const roomSheetStyleVersion='4';
export const roomSheetStyleKey='mirpanel.netflix-room-style';
const months='yanvar fevral mart aprel may iyun iyul avqust sentyabr oktyabr noyabr dekabr'.split(' ');
const epoch=Date.UTC(1899,11,30);
const dayMilliseconds=86400000;

function color(hex){
 const value=parseInt(hex.replace('#',''),16);
 return {red:(value>>16&255)/255,green:(value>>8&255)/255,blue:(value&255)/255};
}

export const roomStatusStyles=[
 {name:'Yoxlama tələb olunur',caption:'⚠ Yoxlama tələb olunur'},
 {name:'Satılmayıb',caption:'✕ Satılmayıb'},
 {name:'Satılıb',caption:'✓ Satılıb'},
 {name:'Yenilənib',caption:'✓ Yenilənib'},
 {name:'Yenilənmə gözlənilir',caption:'◷ Yenilənmə gözlənilir'},
 {name:'Ödəniş edib',caption:'✓ Ödəniş edib'},
 {name:'Yenilənməyib',caption:'✕ Yenilənməyib'}
];

export function roomStatusCaption(value){
 const [text,...details]=String(value??'').trim().split('\n');
 const name=text.replace(/^(?:[✕✓◷✔✗×]\s*)+/u,'');
 return [roomStatusStyles.find(status=>status.name===name)?.caption??text,...details].join('\n');
}

// Numeric dates retain the original calendar year. Month names are explicit so
// the Azerbaijani display does not depend on the spreadsheet owner's locale.
export function roomDateCell(value){
 let serial,iso;
 if(typeof value==='number'&&Number.isInteger(value)&&value>=2&&value<2958466){
  serial=value;
  iso=new Date(epoch+serial*dayMilliseconds).toISOString().slice(0,10);
 }else{
  iso=safeCalendarDate(value);
  if(!iso)return null;
  serial=(Date.parse(iso+'T00:00:00Z')-epoch)/dayMilliseconds;
 }
 return {userEnteredValue:{numberValue:serial},
  userEnteredFormat:{numberFormat:{type:'DATE',pattern:'d "'+months[Number(iso.slice(5,7))-1]+'"'}}};
}

export function roomCellFormat(index){
 return {
  backgroundColor:color('#FFFFFF'),
  textFormat:{fontFamily:'Arial',fontSize:11,foregroundColor:color('#20262D'),bold:index===0||index===1},
  verticalAlignment:'MIDDLE',
  horizontalAlignment:'LEFT',
  wrapStrategy:'WRAP',
  padding:{top:6,bottom:6,left:10,right:10}
 };
}

export function roomSheetCells(values){
 return values.map((value,index)=>{
  const date=index===4?roomDateCell(value):null;
  if(index===4&&value!==''&&value!=null&&!date)throw Error('ROOM_SHEET_DATE_INVALID');
  return {
   userEnteredValue:date?.userEnteredValue??{stringValue:index===5?roomStatusCaption(value):String(value??'')},
   userEnteredFormat:{...roomCellFormat(index),...date?.userEnteredFormat}
  };
 });
}

export const roomStripeFormula='=ISEVEN(ROW())';

export function roomSheetStyleRequests(sheetId){
 const body={sheetId,startRowIndex:1,endColumnIndex:6};
 const formatFields=['backgroundColor','backgroundColorStyle','textFormat','verticalAlignment','horizontalAlignment','wrapStrategy','padding'];
 const repeat=(range,userEnteredFormat)=>({repeatCell:{range,cell:{userEnteredFormat},
  fields:formatFields.map(field=>'userEnteredFormat.'+field).join(',')}});
 const requests=[
  repeat(body,roomCellFormat(-1)),
  repeat({...body,endColumnIndex:2},roomCellFormat(0)),
  repeat({sheetId,endRowIndex:1,endColumnIndex:6},{
   ...roomCellFormat(0),backgroundColor:color('#EDF0F3')
  }),
  {addConditionalFormatRule:{index:0,rule:{ranges:[body],booleanRule:{
   condition:{type:'CUSTOM_FORMULA',values:[{userEnteredValue:roomStripeFormula}]},
   format:{backgroundColor:color('#F4F6F7')}
  }}}}
 ];
 for(const [index,width] of [[2,330],[3,330]]){
  requests.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:index,endIndex:index+1},
   properties:{pixelSize:width},fields:'pixelSize'}});
 }
 return requests;
}

export function roomPresentationUpdates(sheetId,dates){
 return dates.flatMap(([value],index)=>{
  // Existing text remains as entered. Format only numeric dates so the year,
  // formula, and underlying serial stay intact.
  const date=typeof value==='number'?roomDateCell(value):null;
  return date?[{updateCells:{start:{sheetId,rowIndex:index+1,columnIndex:4},
   rows:[{values:[{userEnteredFormat:date.userEnteredFormat}]}],
   fields:'userEnteredFormat.numberFormat'}}]:[];
 });
}
