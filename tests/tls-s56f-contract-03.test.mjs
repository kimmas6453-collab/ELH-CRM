// ELH-S56F-CONTRACT-03
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const shift=read('../supabase/migrations/202610210031_tls_shifts.sql');
const att=read('../supabase/migrations/202610210032_tls_attendance.sql');
const shiftUI=read('../src/shifts.js');
const attUI=read('../src/attendance.js');
function functionText(sql,name) {
 const regex=new RegExp('(?:create\\s+or\\s+replace\\s+)?function\\s+(?:public\\.)?'+name+'\\s*\\(','i');
 const m=regex.exec(sql);
 assert.ok(m,'Missing RPC '+name);
 const rest=sql.slice(m.index);
 const next=/\$\w+\$\s*;/g.exec(rest);
 return next?rest.slice(0,next.index+next[0].length):rest.slice(0,13000);
}
test('S5.6F contract: attendance scope and approved shift',()=>{
 const f=functionText(att,'tls_att_action');
 for(const x of ['NOT_YOUR_SHIFT','SHIFT_NOT_APPROVED','auth.uid()'])
  assert.ok(f.includes(x),x);
});
test('S5.6F contract: check-in/out time and duplicate guards',()=>{
 const f=functionText(att,'tls_att_action');
 for(const x of ['OUTSIDE_CHECKIN_WINDOW','OUTSIDE_CHECKOUT_WINDOW','CHECKIN_REQUIRED','ALREADY_CHECKED_IN','ALREADY_CHECKED_OUT','PERIOD_LOCKED'])
  assert.ok(f.includes(x),x);
});
test('S5.6F contract: adjustment approval and audit',()=>{
 const f=functionText(att,'tls_att_decide');
 for(const x of ['private.is_admin()','PERIOD_LOCKED','tls_attendance_audit'])
  assert.ok(f.includes(x),x);
});
test('S5.6F contract: locking period safeguards',()=>{
 const f=functionText(att,'tls_att_lock_month');
 for(const x of ['private.is_admin()','CANNOT_LOCK_CURRENT_OR_FUTURE_MONTH','PENDING_ADJUSTMENTS'])
  assert.ok(f.includes(x),x);
});
test('S5.6F contract: Shift registration policy',()=>{
 const f=functionText(shift,'tls_register');
 for(const x of ['NOT_TELESALES','INVALID_SHIFT','SHIFT_STARTED','REGISTRATION_NOT_OPEN','TOO_FAR_AHEAD','SHIFT_CLOSED'])
  assert.ok(f.includes(x),x);
});
test('S5.6F patched Shift UI still protects cancel-pending/copy duplicate',()=>{
 for(const x of ["state==='CANCEL_PENDING'","r.duplicate","counts.SKIPPED","counts.FAILED"])
  assert.ok(shiftUI.includes(x),x);
});
test('S5.6F patched Attendance UI retains lock and input validation',()=>{
 for(const x of ['isLocked.includes','reason.trim().length<5','Ngày giờ không hợp lệ'])
  assert.ok(attUI.includes(x),x);
});
test.todo('Runtime UAT: authorized TELESALES and ADMIN actions require real sessions and valid shift window');
test.todo('Runtime UAT: approved check-in without original check_in_at - decide business policy, then test check-out');
