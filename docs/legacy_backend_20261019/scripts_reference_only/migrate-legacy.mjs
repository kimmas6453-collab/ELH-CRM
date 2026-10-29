import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const base=new URL('../private/',import.meta.url);
const load=async n=>JSON.parse(await readFile(new URL(n,base),'utf8'));
const save=(n,d)=>writeFile(new URL(n,base),JSON.stringify(d,null,2));
const staff=await load('CRM_STAFF.json'),alloc=await load('CRM_ALLOCATIONS.json'),raw=await load('raw_final001.json'),activities=await load('CRM_ACTIVITIES.json');
const text=x=>String(x??'').trim();
function date(x){if(!x)return null;const s=text(x).replace(' ','T');const d=new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(s)?s:s+'+07:00');if(!Number.isFinite(+d))throw Error('Invalid source date');return d.toISOString();}
function phone(x){let p=text(x).replace(/\.0$/,'').replace(/[\s().-]/g,'');if(/^\+?84\d{9}$/.test(p))p='0'+p.replace(/^\+?84/,'');if(/^\d{9}$/.test(p))p='0'+p;return p;}
const knownEmails=new Set(staff.map(x=>text(x.Email).toLowerCase()));
if(staff.some(x=>!['ADMIN','TELESALES','EXECUTIVE'].includes(x.Role)))throw Error('Unmapped source role');
if(alloc.some(x=>!knownEmails.has(text(x.Assigned_To).toLowerCase())))throw Error('Unmapped allocation owner');
if(activities.some(x=>!knownEmails.has(text(x.Actor).toLowerCase())))throw Error('Unmapped activity actor');
if(new Set(alloc.map(x=>x.Assignment_ID)).size!==alloc.length)throw Error('Duplicate assignment IDs');
const source=new Map(raw.map(x=>[text(x.Customer_ID),x]));
const assigned=new Set(alloc.map(x=>text(x.Customer_ID)));
const allocationIds=new Set(alloc.map(x=>text(x.Assignment_ID)));
if(activities.some(x=>!allocationIds.has(text(x.Assignment_ID))))throw Error('Orphan activity');
const report={sourceCustomers:raw.length,assignments:alloc.length,unassignedCustomers:raw.filter(x=>!assigned.has(text(x.Customer_ID))).length,activities:activities.length,accounts:staff.length,roles:Object.fromEntries(['ADMIN','EXECUTIVE','TELESALES'].map(r=>[r,staff.filter(x=>x.Role===r).length])),invalidSourcePhones:raw.filter(x=>!/^0\d{9}$/.test(phone(x.Phone))).length};
await save('migration-plan.json',report);console.log(JSON.stringify(report));
if(!process.argv.includes('--apply'))process.exit(0);
const config=await load('supabase-server.json');
const db=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
const fail=(error,operation)=>{if(error)throw Error(`${operation}: ${error.code||error.status||'failed'} ${error.message?.slice(0,180)}`);};
let users=[];
for(let page=1;;page++){const {data,error}=await db.auth.admin.listUsers({page,perPage:100});fail(error,'list auth users');users.push(...data.users);if(data.users.length<100)break;}
const ids=new Map(users.map(x=>[x.email.toLowerCase(),x.id]));
let credentials=[];try{credentials=await load('new-account-credentials.json');}catch{}
for(const person of staff){
 const email=text(person.Email).toLowerCase();
 if(!ids.has(email)){
  const password=randomBytes(24).toString('base64url');
  const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:person.Name}});fail(error,'create account');
  ids.set(email,data.user.id);credentials.push({username:email.endsWith('@staff.elliehomes.internal')?email.split('@')[0].toUpperCase():email,email,password,role:person.Role});
  await save('new-account-credentials.json',credentials);
 }
 const {error}=await db.from('profiles').upsert({id:ids.get(email),email,name:person.Name,role:person.Role,active:text(person.Active).toUpperCase()==='YES'},{onConflict:'id'});fail(error,'profile');
}
await save('profile-map.json',Object.fromEntries(ids));
const owner=e=>ids.get(text(e).toLowerCase());
const leads=alloc.map(x=>({id:text(x.Assignment_ID),customer_id:text(x.Customer_ID),name:text(x.Customer_Name)||text(source.get(text(x.Customer_ID))?.Contact_Name)||'Chưa có tên',phone:phone(x.Phone),project:text(x.Project),assigned_to:owner(x.Assigned_To),status:text(x.Status)||'Chưa liên hệ',priority:text(x.Priority),created_at:date(x.Assigned_At),updated_at:date(x.Last_Contact)||date(x.Assigned_At),last_contact:date(x.Last_Contact),next_followup:x.Next_Followup?text(x.Next_Followup).slice(0,10):null,notes:text(x.Notes),source:text(x.Source),legacy_data:{allocation:x,customer:source.get(text(x.Customer_ID))||null}}));
for(const x of raw.filter(x=>!assigned.has(text(x.Customer_ID))))leads.push({id:'pool:'+text(x.Customer_ID),customer_id:text(x.Customer_ID),name:text(x.Contact_Name)||'Chưa có tên',phone:phone(x.Phone),project:text(x.Source_Sheet),assigned_to:null,status:'Chưa liên hệ',priority:'',created_at:'2026-10-19T10:32:39Z',updated_at:'2026-10-19T10:32:39Z',last_contact:null,next_followup:null,notes:text(x.Followup_Notes),source:text(x.Source_Sheet),legacy_data:{customer:x,import_timestamp:true}});
if(leads.some(x=>!x.created_at||!x.updated_at||x.name.length>200||x.phone.length>100||x.notes.length>10000))throw Error('Source exceeds schema constraints');
async function upsert(table,rows,onConflict){for(let n=0;n<rows.length;n+=150){const {error}=await db.from(table).upsert(rows.slice(n,n+150),{onConflict,ignoreDuplicates:true});fail(error,table);if(n%1500===0)console.log(`${table}: ${Math.min(n+150,rows.length)}/${rows.length}`);}}
await upsert('leads',leads,'id');
await upsert('activities',activities.map(x=>({legacy_id:text(x.Activity_ID),lead_id:text(x.Assignment_ID),actor:owner(x.Actor),kind:'LEGACY_UPDATE',status:text(x.Status),note:text(x.Note),next_followup:x.Next_Followup?text(x.Next_Followup).slice(0,10):null,created_at:date(x.Created_At)})),'legacy_id');
for(const sheet of ['raw_final001','CRM_INTAKE','CRM_AUDIT','CRM_NOTIFICATIONS','CRM_BULK_JOBS']){
 const records=await load(sheet+'.json');
 await upsert('legacy_archive',records.map((payload,i)=>({source:sheet,record_key:text(payload.Customer_ID||payload.ID||payload.Job_ID)||createHash('sha256').update(JSON.stringify(payload)).digest('hex')+':'+i,payload})),'source,record_key');
}
const checks={};
for(const table of ['profiles','leads','activities','legacy_archive']){const {count,error}=await db.from(table).select('*',{count:'exact',head:true});fail(error,'reconcile');checks[table]=count;}
if(checks.profiles!==staff.length||checks.leads!==leads.length||checks.activities!==activities.length)throw Error('Reconciliation failed');
await save('migration-result.json',{...report,checks,completedAt:new Date().toISOString()});console.log(JSON.stringify({reconciled:checks}));
