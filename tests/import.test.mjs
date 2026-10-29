import {test} from 'node:test';import assert from 'node:assert/strict';
import {csvParse,convert} from '../scripts/prepare-import.mjs';
test('CSV quoted multiline notes and escaped quotes',()=>{
 assert.deepEqual(csvParse('a,b\r\n"x,y","line1\n""line2"""\r\n'),[{a:'x,y',b:'line1\n"line2"'}]);
});
test('import rejects unmapped staff and duplicate assignment IDs',()=>{
 const r={Assignment_ID:'a',Customer_Name:'Test',Phone:'0900000001',Assigned_To:'a@example.test'};
 assert.throws(()=>convert([r],[]),/ánh xạ/);
 assert.throws(()=>convert([r,r],[{email:r.Assigned_To,id:'a'}]),/trùng/);
});
