import assert from 'node:assert/strict';
import {roomDateCell,roomStatusCaption,roomSheetCells,roomSheetStyleRequests,roomPresentationUpdates,roomStatusStyles} from '../mirpanel-admin/community/netflix-room-sheet-style.mjs';
import {roomSheetState} from '../mirpanel-admin/community/netflix-room-sheet-sync.mjs';

const epoch=Date.UTC(1899,11,30);
for(const [iso,display] of [['2027-02-01','d "fevral"'],['2027-01-15','d "yanvar"'],['2026-12-01','d "dekabr"'],['2028-02-29','d "fevral"']]){
 const cell=roomDateCell(iso);
 assert.equal(cell.userEnteredFormat.numberFormat.pattern,display);
 const saved=new Date(epoch+cell.userEnteredValue.numberValue*86400000).toISOString().slice(0,10);
 assert.equal(saved,iso);
 assert.deepEqual(roomDateCell(cell.userEnteredValue.numberValue),cell);
}
assert.equal(roomDateCell('2027-02-30'),null);
assert.equal(roomDateCell(''),null);
for(const status of roomStatusStyles){
 assert.equal(roomStatusCaption(status.name),status.caption);
 assert.equal(roomStatusCaption(status.caption),status.caption);
 assert.equal(roomStatusCaption('✓ ✕ ◷ '+status.name),status.caption);
}
assert.equal(roomStatusCaption(''), '');
assert.equal(roomStatusCaption('Custom existing status'),'Custom existing status');

const values=['900001','1 · 0408','long.synthetic.email.address.for.wrapping@example.com',
 '=synthetic-password-literal-for-wrap-1234567890','2027-01-15','Yenilənmə gözlənilir','test-room-id'];
const cells=roomSheetCells(values);
assert.equal(cells[1].userEnteredValue.stringValue,'1 · 0408');
assert.equal(cells[3].userEnteredValue.stringValue,values[3]);
assert.equal(cells[0].userEnteredFormat.textFormat.bold,true);
assert.equal(cells[2].userEnteredFormat.wrapStrategy,'WRAP');
assert.equal(cells[3].userEnteredFormat.wrapStrategy,'WRAP');
assert.equal(cells[6].userEnteredValue.stringValue,'test-room-id');
assert.deepEqual(roomSheetCells([...values.slice(0,5),cells[5].userEnteredValue.stringValue,values[6]]),cells);

const requests=roomSheetStyleRequests(7);
assert.equal(requests.filter(r=>r.addConditionalFormatRule).length,6);
assert.equal(requests.find(r=>r.setBasicFilter).setBasicFilter.filter.range.endColumnIndex,8);
assert.equal(requests.find(r=>r.updateSheetProperties).updateSheetProperties.properties.gridProperties.frozenRowCount,1);
assert.ok(requests.some(r=>r.updateDimensionProperties?.properties.hiddenByUser===true));
const updates=roomPresentationUpdates(7,[values]);
assert.equal(updates.length,2);
assert.ok(updates.every(r=>[4,5].includes(r.updateCells.start.columnIndex)));
assert.deepEqual(roomPresentationUpdates(7,[['','','','',123,'✓ Ödəniş edib']]).map(r=>r.updateCells.start.columnIndex),[4]);
assert.equal(roomSheetState({delivery_id:null,group_end:'2027-01-15'})[2],'Satılmayıb');
console.log('PASS: Azerbaijani display dates preserve year, status captions stay idempotent, wrapped credentials, protected ID and presentation-only updates');
