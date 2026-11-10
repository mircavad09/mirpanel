import {safeCalendarDate} from '../payment-order-lifecycle.mjs';

export const roomSheetStyleVersion='3';
export const roomSheetStyleKey='mirpanel.netflix-room-style';
const months='yanvar fevral mart aprel may iyun iyul avqust sentyabr oktyabr noyabr dekabr'.split(' ');
const epoch=Date.UTC(1899,11,30);
const dayMilliseconds=86400000;

function color(hex){
 const value=parseInt(hex.replace('#',''),16);
 return {red:(value>>16&255)/255,green:(value>>8&255)/255,blue:(value&255)/255};
}

export const roomStatusStyles=[
 {name:'Yoxlama tələb olunur',caption:'⚠ Yoxlama tələb olunur',background:'#493B17',foreground:'#FFE08A'},
 {name:'Satılmayıb',caption:'✕ Satılmayıb',background:'#30343B',foreground:'#E1E5EB'},
 {name:'Satılıb',caption:'✓ Satılıb',background:'#17392A',foreground:'#8AE5AC'},
 {name:'Yenilənmə gözlənilir',caption:'◷ Yenilənmə gözlənilir',background:'#493B17',foreground:'#FFE08A'},
 {name:'Ödəniş edib',caption:'✓ Ödəniş edib',background:'#123D35',foreground:'#7EF0BF'},
 {name:'Yenilənməyib',caption:'✕ Yenilənməyib',background:'#49242B',foreground:'#FFB7C1'}
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
 const border={style:'SOLID',color:color('#3B4048')};
 return {
  backgroundColor:color(index===1?'#080A0D':'#25292F'),
  textFormat:{fontFamily:'Arial',fontSize:11,foregroundColor:color('#F3F4F6'),bold:index===0||index===1},
  verticalAlignment:'MIDDLE',
  horizontalAlignment:'LEFT',
  wrapStrategy:'WRAP',
  padding:{top:10,bottom:10,left:10,right:10},
  borders:{top:border,bottom:border,left:border,right:border}
 };
}

export function roomSheetCells(values){
 return values.map((value,index)=>{
  const date=index===4?roomDateCell(value):null;
  return {
   userEnteredValue:date?.userEnteredValue??{stringValue:index===5?roomStatusCaption(value):String(value??'')},
   userEnteredFormat:{...roomCellFormat(index),...date?.userEnteredFormat}
  };
 });
}

export function roomSheetStyleRequests(sheetId){
 const range={sheetId};
 const body={sheetId,startRowIndex:1};
 const border={style:'SOLID',color:color('#3B4048')};
 const requests=[
  {repeatCell:{range,cell:{userEnteredFormat:roomCellFormat(-1)},fields:'userEnteredFormat'}},
  {repeatCell:{range:{...body,startColumnIndex:0,endColumnIndex:1},
   cell:{userEnteredFormat:roomCellFormat(0)},fields:'userEnteredFormat'}},
  {repeatCell:{range:{...body,startColumnIndex:1,endColumnIndex:2},
   cell:{userEnteredFormat:roomCellFormat(1)},fields:'userEnteredFormat'}},
  {updateBorders:{range:{sheetId,startColumnIndex:0,endColumnIndex:8},
   top:border,bottom:border,left:border,right:border,innerHorizontal:border,innerVertical:border}},
  {repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{
   ...roomCellFormat(-1),backgroundColor:color('#111418'),
   textFormat:{fontFamily:'Arial',fontSize:12,bold:true,foregroundColor:color('#FFFFFF')}
  }},fields:'userEnteredFormat'}},
  {updateSheetProperties:{properties:{sheetId,gridProperties:{frozenRowCount:1,hideGridlines:true}},
   fields:'gridProperties.frozenRowCount,gridProperties.hideGridlines'}},
  {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:6,endIndex:8},
   properties:{hiddenByUser:true},fields:'hiddenByUser'}},
  {setBasicFilter:{filter:{range:{sheetId,startRowIndex:0,startColumnIndex:0,endColumnIndex:8}}}},
  {updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:0,endIndex:1},
   properties:{pixelSize:44},fields:'pixelSize'}}
 ];
 for(const [index,width] of [145,190,330,330,155,430].entries()){
  requests.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:index,endIndex:index+1},
   properties:{pixelSize:width},fields:'pixelSize'}});
 }
 for(const [index,status] of roomStatusStyles.entries()){
  requests.push({addConditionalFormatRule:{index,rule:{
   ranges:[{sheetId,startRowIndex:1,startColumnIndex:5,endColumnIndex:6}],
   booleanRule:{condition:{type:'TEXT_STARTS_WITH',values:[{userEnteredValue:status.caption}]},
    format:{backgroundColor:color(status.background),textFormat:{
     foregroundColor:color(status.foreground),bold:status.name==='Ödəniş edib'
    }}}
  }}});
 }
 return requests;
}

export function roomPresentationUpdates(sheetId,rows){
 const requests=[];
 for(const [index,row] of rows.entries()){
  const date=roomDateCell(row[4]);
  if(date)requests.push({updateCells:{start:{sheetId,rowIndex:index+1,columnIndex:4},
   rows:[{values:[date]}],fields:'userEnteredValue,userEnteredFormat.numberFormat'}});
  const status=roomStatusCaption(row[5]);
  if(status!==String(row[5]??''))requests.push({updateCells:{
   start:{sheetId,rowIndex:index+1,columnIndex:5},
   rows:[{values:[{userEnteredValue:{stringValue:status}}]}],fields:'userEnteredValue'
  }});
 }
 return requests;
}
