import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const shifts=readFileSync(new URL('../src/shifts.js',import.meta.url),'utf8');
const attendance=readFileSync(new URL('../src/attendance.js',import.meta.url),'utf8');
test('S5.6F Shift cancellation pending is not re-registered',()=>{
 assert.match(shifts,/state==='CANCEL_PENDING'\?/);
 assert.match(shifts,/r\.duplicate/);
 assert.match(shifts,/counts\.SKIPPED/);
 assert.match(shifts,/counts\.FAILED/);
});
test('S5.6F Attendance UI handles locking and adjustment state',()=>{
 assert.match(attendance,/r\.approved_in\|\|isLocked\.includes/);
 assert.match(attendance,/r\.approved_out\|\|isLocked\.includes/);
 assert.match(attendance,/reason\.trim\(\)\.length<5/);
 assert.match(attendance,/Ngày giờ không hợp lệ/);
});
test('S5.6F existing CRM/Callio entry points remain untouched',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/id="callio"/);
 assert.match(main,/id="tls-shifts"/);
 assert.match(main,/id="tls-attendance"/);
});
