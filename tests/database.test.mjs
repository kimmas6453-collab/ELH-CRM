import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
let db;
const admin='00000000-0000-0000-0000-000000000001',a='00000000-0000-0000-0000-000000000002',b='00000000-0000-0000-0000-000000000003';
async function asUser(id,sql) {await db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role authenticated;`);return db.query(sql);}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth; create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610190001_crm.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/202610190002_legacy.sql',import.meta.url),'utf8'));
 await db.exec('create role service_role;');
 await db.exec(await readFile(new URL('../supabase/migrations/202610190003_callio.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/202610190004_sync_lease.sql',import.meta.url),'utf8'));
 await db.exec(`insert into auth.users values('${admin}'),('${a}'),('${b}');insert into profiles values('${admin}','admin@example.test','Admin','ADMIN',true),('${a}','a@example.test','A','TELESALES',true),('${b}','b@example.test','B','TELESALES',true);insert into leads(id,name,phone,assigned_to) values('a','Client A','0900000001','${a}'),('b','Client B','0900000002','${b}'),('pool','Pool','0900000003',null);`);
});
after(()=>db.close());
test('staff can only read own assigned records, admin sees pool',async()=>{
 assert.deepEqual((await asUser(a,'select id from leads')).rows,[{id:'a'}]);
 assert.equal((await asUser(admin,'select id from leads')).rows.length,3);
});
test('staff cannot promote self or reassign directly',async()=>{
 await assert.rejects(asUser(a,"update profiles set role='ADMIN'"),/permission denied/);
 await assert.rejects(asUser(a,`update leads set assigned_to='${a}' where id='b'`),/permission denied/);
});
test('call authorization rejects another owner, accepts own',async()=>{
 await assert.rejects(asUser(a,"select crm_prepare_call('b')"),/Không có quyền/);
 assert.equal((await asUser(a,"select crm_prepare_call('a') as v")).rows[0].v.phone,'0900000001');
});
test('updates are transactional, version-checked and audited',async()=>{
 await asUser(a,"select crm_update('a',1,'Đã liên hệ',null,'Contacted')");
 await assert.rejects(asUser(a,"select crm_update('a',1,'Booking',null,'Overwrite')"),/đã được cập nhật/);
 const r=(await asUser(a,"select crm_detail('a') as v")).rows[0].v;
 assert.equal(r.lead.version,2); assert.equal(r.history.length,1);
 await assert.rejects(asUser(a,"select crm_update('b',1,'Booking',null,'')"),/Không có quyền/);
});
test('only admins allocate pool and cannot overwrite assigned leads',async()=>{
 await assert.rejects(asUser(a,`select crm_assign(array['pool'],'${a}')`),/quản trị/);
 assert.equal((await asUser(admin,`select crm_assign(array['pool','b'],'${a}') as v`)).rows[0].v.count,1);
});
test('keyset pagination has no duplicate rows and caps size',async()=>{
 const first=(await asUser(admin,"select crm_leads(p_limit=>1) as v")).rows[0].v;
 assert.equal(first.items.length,1); assert.equal(first.hasMore,true);
 const c=first.items[0];
 const next=(await asUser(admin,`select crm_leads(p_limit=>1,p_cursor_at=>'${c.created_at}',p_cursor_id=>'${c.id}') as v`)).rows[0].v;
 assert.notEqual(next.items[0].id,c.id);
});
test('inactive staff lose data and call access immediately',async()=>{
 await db.exec(`reset role;update profiles set active=false where id='${b}';`);
 assert.equal((await asUser(b,'select id from leads')).rows.length,0);
 await assert.rejects(asUser(b,"select crm_prepare_call('b')"),/Không có quyền/);
});
test('anon cannot execute CRM functions',async()=>{
 await db.exec('reset role;set role anon;');
 await assert.rejects(db.query('select crm_summary()'),/permission denied/);
});
test('executive can read aggregates but no customer records or mutations',async()=>{
 const exec='00000000-0000-0000-0000-000000000004';
 await db.exec(`reset role;insert into auth.users values('${exec}');insert into profiles values('${exec}','exec@example.test','Executive','EXECUTIVE',true);`);
 assert.equal((await asUser(exec,'select * from leads')).rows.length,0);
 assert.equal((await asUser(exec,'select * from activities')).rows.length,0);
 const r=(await asUser(exec,'select crm_executive_summary() as v')).rows[0].v;
 assert.equal(r.assigned,3);assert.ok(!JSON.stringify(r).includes('090000'));
 await assert.rejects(asUser(exec,"select crm_create('X','0900000099','','')"),/Không có quyền/);
 await assert.rejects(asUser(exec,"select crm_prepare_call('a')"),/Không có quyền/);
 await assert.rejects(asUser(a,'select crm_executive_summary()'),/Không có quyền/);
});
test('legacy invalid phones are retained but cannot be dialed or created as new intake',async()=>{
 await db.exec(`reset role;insert into leads(id,name,phone,assigned_to) values('invalid','Legacy','invalid','${a}');`);
 await assert.rejects(asUser(a,"select crm_prepare_call('invalid')"),/cần kiểm tra/);
 await assert.rejects(asUser(a,"select crm_create('X','invalid','','')"),/không hợp lệ/);
});
test('call reports respect verified ownership, executive only sees aggregates',async()=>{
 await db.exec(`reset role;insert into callio_calls(id,owner_id,started_at,direction,talk_seconds,source_data) values('c1','${a}','2026-10-19T02:00Z','outbound',20,'{}'),('c2','${b}','2026-10-19T02:01Z','outbound',0,'{}'),('c3',null,'2026-10-19T02:02Z','inbound',0,'{}');`);
 const query="select crm_call_report('2026-10-19','2026-10-20') as v";
 assert.equal((await asUser(a,query)).rows[0].v.total,1);
 assert.equal((await asUser(admin,query)).rows[0].v.total,3);
 const exec='00000000-0000-0000-0000-000000000004';
 assert.equal((await asUser(exec,query)).rows[0].v.total,3);
 assert.equal((await asUser(exec,'select * from callio_calls')).rows.length,0);
 await assert.rejects(asUser(a,`select claim_callio_sync('${a}')`),/permission denied/);
});
test('sync lease excludes simultaneous workers and wrong release token',async()=>{
 await db.exec('reset role;set role service_role;');
 assert.equal((await db.query(`select claim_callio_sync('${a}') as ok`)).rows[0].ok,true);
 assert.equal((await db.query(`select claim_callio_sync('${b}') as ok`)).rows[0].ok,false);
 await db.query(`select release_callio_sync('${b}')`);
 assert.equal((await db.query(`select claim_callio_sync('${b}') as ok`)).rows[0].ok,false);
 await db.query(`select release_callio_sync('${a}')`);
 assert.equal((await db.query(`select claim_callio_sync('${b}') as ok`)).rows[0].ok,true);
});

test('verified Callio mapping assigns backfill and new calls without leaking to other staff',async()=>{
 await db.exec('reset role;');
 await db.exec(await readFile(new URL('../supabase/migrations/202610190005_callio_mapping.sql',import.meta.url),'utf8'));
 await db.exec(`insert into callio_accounts(id,email,name) values('nv1','nv1@example.test','NV1');insert into callio_calls(id,started_at,direction,source_data) values('mapped','2026-10-19','outbound','{"fromUser":{"_id":"nv1"}}');`);
 await assert.rejects(asUser(a,`select crm_link_callio('nv1','${a}')`),/ADMIN/);
 assert.equal((await asUser(admin,`select crm_link_callio('nv1','${a}') as v`)).rows[0].v.updated,1);
 assert.equal((await asUser(a,"select id from callio_calls where id='mapped'")).rows.length,1);
 assert.equal((await asUser(b,"select id from callio_calls where id='mapped'")).rows.length,0);
 await db.exec(`reset role;insert into callio_calls(id,started_at,direction,source_data) values('new-call','2026-10-19','outbound','{"fromUser":{"_id":"nv1"}}');`);
 assert.equal((await asUser(a,"select id from callio_calls where id='new-call'")).rows.length,1);
 await asUser(admin,"select crm_link_callio('nv1',null)");
 assert.equal((await asUser(a,"select id from callio_calls where id in ('mapped','new-call')")).rows.length,0);
});
test('team admin functions block staff and self lock',async()=>{
 await db.exec('reset role;');
 await db.exec(await readFile(new URL('../supabase/migrations/202610190006_team.sql',import.meta.url),'utf8'));
 await assert.rejects(asUser(a,'select crm_team()'),/ADMIN/);
 await assert.rejects(asUser(a,`select crm_set_active('${b}',true)`),/ADMIN/);
 await assert.rejects(asUser(admin,`select crm_set_active('${admin}',false)`),/tự khóa/);
 await asUser(admin,`select crm_set_active('${b}',true)`);
 assert.equal((await asUser(admin,'select crm_team() as v')).rows[0].v.members.length,4);
});
test('notifications isolate owners and survive assignment audit',async()=>{
 await db.exec('reset role;');await db.exec(await readFile(new URL('../supabase/migrations/202610190007_notifications.sql',import.meta.url),'utf8'));
 await db.exec(`insert into notifications(owner_id,kind,title) values('${a}','TEST','A'),('${b}','TEST','B');`);
 assert.equal((await asUser(a,'select * from notifications')).rows.length,1);
 await asUser(a,'select crm_read_notifications()');
 assert.equal((await asUser(b,'select read_at from notifications')).rows[0].read_at,null);
 await assert.rejects(asUser(a,"update notifications set title='Changed'"),/permission denied/);
 await db.exec(`reset role;insert into leads(id,name,phone) values('notify-pool','N','0900000088');`);
 await asUser(admin,`select crm_assign(array['notify-pool'],'${a}')`);
 assert.equal((await asUser(a,"select * from notifications where kind='ALLOCATION'")).rows.length,1);
});
test('bulk import preview is read-only, duplicate-safe and admin-only',async()=>{
 await db.exec('reset role;');await db.exec(await readFile(new URL('../supabase/migrations/202610190008_import.sql',import.meta.url),'utf8'));
 const rows=JSON.stringify([{name:'Import test',phone:'0900000077'},{name:'Duplicate',phone:'0900000077'}]);
 await assert.rejects(asUser(a,`select crm_import_pool('${rows}')`),/ADMIN/);
 assert.equal((await asUser(admin,`select crm_import_pool('${rows}') as v`)).rows[0].v.inserted,1);
 assert.equal((await asUser(admin,"select id from leads where phone='0900000077'")).rows.length,0);
 assert.equal((await asUser(admin,`select crm_import_pool('${rows}',false) as v`)).rows[0].v.inserted,1);
 assert.equal((await asUser(admin,`select crm_import_pool('${rows}',false) as v`)).rows[0].v.inserted,0);
 await assert.rejects(asUser(admin,`select crm_import_pool('[{"name":"Bad","phone":"1"}]',false)`),/không hợp lệ/);
});

test('team operations preserve role isolation, terminal due semantics and contact history',async()=>{
 await db.exec('reset role;');await db.exec(await readFile(new URL('../supabase/migrations/202610190009_operations.sql',import.meta.url),'utf8'));
 await db.exec(`insert into leads(id,name,phone,assigned_to,status,next_followup) values('booked-overdue','Done','0900000061','${a}','Booking','2020-01-01'),('active-overdue','Follow','0900000062','${a}','Đã liên hệ','2020-01-01');`);
 await assert.rejects(asUser(a,`select crm_staff360('${b}')`),/ADMIN/);
 await assert.rejects(asUser(a,'select crm_admin_history()'),/ADMIN/);
 const team=(await asUser(admin,'select crm_team() as v')).rows[0].v;
 assert.equal(team.members.find(p=>p.id===a).overdue,1);
 assert.equal((await asUser(admin,`select crm_staff360('${a}','overdue') as v`)).rows[0].v.total,1);
 await asUser(a,"select crm_update('active-overdue',1,'Hẹn gặp','2027-01-01','New appointment')");
 const detail=(await asUser(a,"select crm_detail('active-overdue') as v")).rows[0].v;
 assert.ok(detail.lead.last_contact);
 assert.equal((await asUser(a,"select next_followup::text from activities where lead_id='active-overdue'")).rows[0].next_followup,'2027-01-01');
});

test('multi-staff allocation preview, atomic validation and idempotent retry',async()=>{
 await db.exec(`reset role;insert into leads(id,name,phone) values('batch-a','Batch A','0900000063'),('batch-b','Batch B','0900000064');`);
 const plan=JSON.stringify([{staff:a,count:1},{staff:b,count:1}]);const key='00000000-0000-0000-0000-000000000099';
 await assert.rejects(asUser(a,`select crm_allocate_batch('${plan}')`),/ADMIN/);
 assert.equal((await asUser(admin,`select crm_allocate_batch('${plan}') as v`)).rows[0].v.requested,2);
 const before=(await asUser(admin,'select count(*)::int as n from leads where assigned_to is null')).rows[0].n;
 const r=(await asUser(admin,`select crm_allocate_batch('${plan}',false,'${key}') as v`)).rows[0].v;
 assert.equal(r.count,2);
 const again=(await asUser(admin,`select crm_allocate_batch('${plan}',false,'${key}') as v`)).rows[0].v;
 assert.deepEqual(again,r);
 assert.equal((await asUser(admin,'select count(*)::int as n from leads where assigned_to is null')).rows[0].n,before-2);
 await assert.rejects(asUser(admin,`select crm_allocate_batch('[{"staff":"${a}","count":500}]',false,'00000000-0000-0000-0000-000000000098')`),/không đủ/);
 await assert.rejects(asUser(admin,"select crm_allocate_batch(null)"),/không hợp lệ/);
 assert.equal((await asUser(admin,"select count(*)::int as n from admin_events where kind='ASSIGN_BATCH'")).rows[0].n,1);
});

test('Callio request does not grant history access until admin verifies; stale approvals fail',async()=>{
 await db.exec('reset role;');await db.exec(await readFile(new URL('../supabase/migrations/202610190010_callio_requests.sql',import.meta.url),'utf8'));
 await asUser(a,"select crm_request_callio_link('NV1@example.test')");
 assert.equal((await asUser(a,"select id from callio_calls where id='mapped'")).rows.length,0);
 assert.equal((await asUser(b,'select * from callio_link_requests')).rows.length,0);
 await assert.rejects(asUser(a,`select crm_review_callio_link('${a}','nv1',true)`),/ADMIN/);
 await asUser(admin,`select crm_review_callio_link('${a}','nv1',true)`);
 assert.equal((await asUser(a,"select id from callio_calls where id='mapped'")).rows.length,1);
 await assert.rejects(asUser(b,"select crm_request_callio_link('nv1@example.test')"),/Chưa thể/);
 await assert.rejects(asUser(admin,`select crm_review_callio_link('${a}','nv1',true)`),/thay đổi/);
});

test('accent-insensitive partial search, atomic intake and history remain scoped',async()=>{
 await db.exec('reset role;');await db.exec(await readFile(new URL('../supabase/migrations/202610190011_parity.sql',import.meta.url),'utf8'));
 await asUser(a,"select crm_intake('Đặng Thị Ánh','0912345678','Căn hộ','','2027-03-01')");
 const r=(await asUser(a,"select crm_leads(p_query=>'dang thi') as v")).rows[0].v;
 assert.equal(r.items.length,1);assert.equal(r.items[0].next_followup,'2027-03-01');
 assert.equal((await asUser(a,"select crm_leads(p_query=>'34567') as v")).rows[0].v.items.length,1);
 assert.equal((await asUser(b,"select crm_leads(p_query=>'dang thi') as v")).rows[0].v.items.length,0);
 assert.equal((await asUser(a,"select crm_leads(p_query=>'%') as v")).rows[0].v.items.length,0);
 assert.equal((await asUser(a,"select crm_duplicate('0912345678') as v")).rows[0].v,true);
 const id=r.items[0].id;
 assert.equal((await asUser(b,`select crm_activity_page('${id}') as v`)).rows[0].v.length,0);
 assert.equal((await asUser(a,`select crm_activity_page('${id}') as v`)).rows[0].v[0].next_followup,'2027-03-01');
 await assert.rejects(asUser(a,"select crm_intake('Duplicate','0912345678','','',null)"),/đã có/);
});

test('executive due metrics contain no customer data; reminder jobs are private and deduplicated',async()=>{
 await db.exec('reset role;');await db.exec(await readFile(new URL('../supabase/migrations/202610190013_executive.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../supabase/migrations/202610190014_health.sql',import.meta.url),'utf8'));
 const exec='00000000-0000-0000-0000-000000000004';
 const summary=(await asUser(exec,'select crm_executive_summary() as v')).rows[0].v;
 assert.equal(typeof summary.due,'number');assert.ok(!JSON.stringify(summary).includes('0912345678'));
 await assert.rejects(asUser(a,'select crm_quality()'),/ADMIN/);
 await assert.rejects(asUser(a,'select crm_set_reminders(true)'),/ADMIN/);
 await assert.rejects(asUser(admin,'select private.daily_reminders()'),/permission denied/);
 await db.exec(`reset role;insert into leads(id,name,phone,assigned_to,status,next_followup) values('reminder-test','R','0900000055','${a}','Hẹn gặp','2020-01-01');`);
 assert.equal((await db.query('select private.daily_reminders() as n')).rows[0].n,0);
 await asUser(admin,'select crm_set_reminders(true)');await db.exec('reset role;');
 assert.equal((await db.query('select private.daily_reminders() as n')).rows[0].n,1);
 assert.equal((await db.query('select private.daily_reminders() as n')).rows[0].n,0);
 assert.equal((await asUser(b,"select * from notifications where kind='FOLLOWUP'")).rows.length,0);
 assert.equal((await asUser(admin,'select crm_health() as v')).rows[0].v.reminders,true);
});

test('durable allocation jobs balance recipients, resume and skip externally assigned records',async()=>{
 await db.exec('reset role;');await db.exec(await readFile(new URL('../supabase/migrations/202610190016_allocation_jobs.sql',import.meta.url),'utf8'));
 await db.exec(`insert into leads(id,name,phone,source) select 'job-'||g,'Job '||g,'09'||lpad(g::text,8,'0'),'job-test' from generate_series(1,125) g;`);
 const request=JSON.stringify({recipients:[a,b],policy:'equal',filters:{source:'job-test'}});const key='00000000-0000-0000-0000-000000000088';
 await assert.rejects(asUser(a,`select crm_job_preview('${request}')`),/ADMIN/);
 const preview=(await asUser(admin,`select crm_job_preview('${request}') as v`)).rows[0].v;assert.equal(preview.total,125);assert.deepEqual(preview.workers.map(x=>x.amount).sort(),[62,63]);
 await asUser(admin,`select crm_job_create('${request}','${key}')`);await asUser(admin,`select crm_job_create('${request}','${key}')`);
 await asUser(admin,`select crm_assign(array['job-1'],'${b}')`);
 const first=(await asUser(admin,`select crm_job_step('${key}') as v`)).rows[0].v;assert.equal(first.pending,5);assert.equal(first.skipped,1);
 const end=(await asUser(admin,`select crm_job_step('${key}') as v`)).rows[0].v;assert.equal(end.state,'DONE');assert.equal(end.assigned,124);
 assert.deepEqual((await asUser(admin,`select crm_job_step('${key}') as v`)).rows[0].v,end);
 assert.equal((await asUser(a,'select * from allocation_jobs')).rows.length,0);
});

test('daily priority queue excludes terminal cases and never crosses staff ownership',async()=>{
 await db.exec('reset role;');await db.exec(await readFile(new URL('../supabase/migrations/202610190017_daily_queue.sql',import.meta.url),'utf8'));
 const q=(await asUser(a,"select crm_daily_queue('overdue') as v")).rows[0].v;
 assert.ok(q.items.some(x=>x.id==='reminder-test'&&x.score>=80));assert.ok(!q.items.some(x=>x.id==='booked-overdue'));
 assert.ok(!(await asUser(b,"select crm_daily_queue('all') as v")).rows[0].v.items.some(x=>x.id==='reminder-test'));
});

test('dashboard aggregates are scoped, date filtered, and never expose raw customer data to executives',async()=>{
 await db.exec('reset role;');await db.exec(await readFile(new URL('../supabase/migrations/202610190018_dashboard.sql',import.meta.url),'utf8'));
 const q="select crm_dashboard('2026-10-19T00:00:00+07:00','2026-10-20T00:00:00+07:00') as v";
 const staff=(await asUser(a,q)).rows[0].v;
 const visible=(await asUser(a,"select count(*)::int n from callio_calls where started_at>='2026-10-19T00:00:00+07:00' and started_at<'2026-10-20T00:00:00+07:00'")).rows[0].n;
 assert.equal(staff.totals.total,visible);
 const exec='00000000-0000-0000-0000-000000000004';const agg=(await asUser(exec,q)).rows[0].v;
 assert.ok(agg.totals.total>=staff.totals.total);assert.ok(!JSON.stringify(agg).includes('090000'));
 await assert.rejects(asUser(exec,"select crm_dashboard_calls('2026-10-19','2026-10-20')"),/Không có quyền/);
 await assert.rejects(asUser(exec,"select crm_call_transcript('c1')"),/Không có quyền/);
 await assert.rejects(asUser(a,"select crm_call_transcript('c2')"),/Không có quyền/);
 await assert.rejects(asUser(a,"select * from private.dashboard_calls('2026-10-19','2026-10-20','','','')"),/permission denied/);
 const empty=(await asUser(a,"select crm_dashboard('2020-01-01','2020-01-02') as v")).rows[0].v;assert.equal(empty.totals.total,0);assert.deepEqual(empty.daily,[]);
 await assert.rejects(asUser(a,"select crm_dashboard('2020-01-01','2026-01-01')"),/366/);
 await db.exec('reset role;set role anon;');await assert.rejects(db.query(q),/permission denied/);
});

test('faithful intelligence UI data stays RLS-scoped and excludes executive raw rows',async()=>{
 await db.exec('reset role;');await db.exec(await readFile(new URL('../supabase/migrations/202610190019_intelligence_ui.sql',import.meta.url),'utf8'));
 const r=(await asUser(a,"select crm_intelligence_page('2026-10-19','2026-10-20') as v")).rows[0].v;
 assert.ok(r.items.every(x=>x.id!=='c2'));assert.ok(r.items.length<=300);assert.ok(!JSON.stringify(r).includes('source_data'));
 assert.deepEqual((await asUser(a,"select crm_intelligence_leads(array['0900000002']) as v")).rows[0].v,[]);
 await assert.rejects(asUser('00000000-0000-0000-0000-000000000004',"select crm_intelligence_page('2026-10-19','2026-10-20')"),/Không có quyền/);
 await db.exec('reset role;set role anon;');await assert.rejects(db.query("select crm_intelligence_page('2026-10-19','2026-10-20')"),/permission denied/);
});
