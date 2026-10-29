import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const dir=new URL('../private/',import.meta.url);
const keys=JSON.parse(await readFile(new URL('supabase-server.json',dir),'utf8'));
const credentials=JSON.parse(await readFile(new URL('new-account-credentials.json',dir),'utf8'));
const assignments=JSON.parse(await readFile(new URL('CRM_ALLOCATIONS.json',dir),'utf8'));
const admin=createClient(keys.url,keys.key,{auth:{persistSession:false}});
const {data:links,error:linkError}=await admin.from('callio_accounts').select('id,email,extension,profile_id');if(linkError)throw linkError;
for(let n=1;n<=6;n++){const c=credentials.find(x=>x.username==='EH-TLS00'+n);const {data:p,error}=await admin.from('profiles').select('id').eq('email',c.email).single();if(error||links.find(x=>x.email==='tam.elliehomesnv'+n+'@gmail.com')?.profile_id!==p.id)throw Error('Approved mapping mismatch '+n);}
if(links.some(x=>['10007','10008','10000'].includes(x.extension)&&x.profile_id))throw Error('Unexpected mapping');
const report=[];
for(const c of credentials){
 const client=createClient(keys.url,'sb_publishable_dgLlLhz78YwQWPv8V0PjzQ_cEkgtH1q',{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await client.auth.signInWithPassword({email:c.email,password:c.password});if(error)throw Error('Sign-in failed for '+c.username+' ('+(error.code??error.status??'unknown')+'). Existing passwords were not changed.');
 const {data:profile,error:pe}=await client.rpc('crm_profile');if(pe||profile.role!==c.role)throw Error('Role mismatch');
 const {count,error:ce}=await client.from('leads').select('id',{count:'exact',head:true});if(ce)throw ce;
 const expected=c.role==='EXECUTIVE'?0:assignments.filter(x=>x.Assigned_To===c.email).length;
 if(count!==expected)throw Error('RLS count mismatch for '+c.username+': '+count+' expected '+expected);
 const t=performance.now();const {data,error:le}=await client.rpc(c.role==='EXECUTIVE'?'crm_executive_summary':'crm_leads');if(le)throw le;
 const elapsedMs=Math.round(performance.now()-t);
 const {count:archiveCount,error:ae}=await client.from('legacy_archive').select('record_key',{count:'exact',head:true});if(ae||archiveCount!==0)throw Error('Raw archive exposed');
 const {count:callCount,error:cc}=await client.from('callio_calls').select('id',{count:'exact',head:true});if(cc)throw cc;
 const {count:expectedCalls,error:ec}=await admin.from('callio_calls').select('id',{count:'exact',head:true}).eq('owner_id',profile.id);if(ec||callCount!==expectedCalls)throw Error('Call visibility count mismatch '+c.username);
 const {count:foreignCalls,error:fc}=await client.from('callio_calls').select('id',{count:'exact',head:true}).neq('owner_id',profile.id);if(fc||foreignCalls!==0)throw Error('Other staff calls exposed');
 const {count:unownedCalls,error:uc}=await client.from('callio_calls').select('id',{count:'exact',head:true}).is('owner_id',null);if(uc||unownedCalls!==0)throw Error('Unmapped calls exposed');
 report.push({username:c.username,role:c.role,visibleLeads:count,firstQueryMs:elapsedMs,rawArchiveVisible:archiveCount,visibleCalls:callCount,foreignCallsVisible:foreignCalls,unmappedCallsVisible:unownedCalls});
 await client.auth.signOut({scope:'local'});
}
await writeFile(new URL('live-role-verification.json',dir),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
