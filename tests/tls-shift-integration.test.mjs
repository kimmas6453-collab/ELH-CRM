import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const read=p=>readFileSync(new URL(p, import.meta.url),'utf8');
test('TLS entry points wired to CRM without replacing other features',()=>{
 const m=read('../src/main.js');
 assert.match(m,/id="tls-shifts"/);assert.match(m,/id="tls-attendance"/);
 assert.match(m,/import\('\.\/shifts\.js'\)/);
 assert.match(m,/import\('\.\/attendance\.js'\)/);
 assert.match(m,/id="callio"/);
});
test('shift and attendance code and styles present',()=>{
 for(const p of ['../src/shifts.js','../src/shifts.css','../src/attendance.js','../src/attendance.css'])assert.ok(existsSync(new URL(p,import.meta.url)));
 assert.match(read('../src/shifts.js'),/Sao chép tuần trước/);
 assert.match(read('../src/attendance.js'),/tls_att_action/);
});
test('RPC signatures match SQL and prohibit direct authenticated table access',()=>{
 const sh=read('../supabase/migrations/202610210031_tls_shifts.sql');
 const at=read('../supabase/migrations/202610210032_tls_attendance.sql');
 for(const f of ['tls_week','tls_register','tls_cancel','tls_admin_overview','tls_admin_decide'])assert.ok(sh.includes('public.'+f+'('));
 for(const f of ['tls_att_action','tls_att_request','tls_att_decide','tls_att_report','tls_att_lock_month'])assert.ok(at.includes('public.'+f+'('));
 assert.match(sh,/enable row level security/i);assert.match(at,/enable row level security/i);
 assert.match(sh,/revoke all on public.tls_shift_policies/i);
 assert.match(at,/revoke all on public.tls_attendance_policy/i);
});
test('reminder migration does not automatically schedule production jobs',()=>{
 const r=read('../supabase/migrations/202610210033_tls_reminders.sql');
 assert.match(r,/tls_generate_reminders/);
 assert.doesNotMatch(r,/cron\.schedule\s*\(/i);
 assert.match(r,/reminder_key text not null unique/i);
});
