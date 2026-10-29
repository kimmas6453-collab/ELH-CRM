import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const dir=new URL('../private/',import.meta.url);
const config=JSON.parse(await readFile(new URL('supabase-server.json',dir),'utf8'));
const calls=JSON.parse(await readFile(new URL('callio-history.json',dir),'utf8'));
const db=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
const timestamp=x=>x?new Date(x).toISOString():null;
for(let i=0;i<calls.length;i+=200){
 const records=calls.slice(i,i+200).map(x=>({id:x._id,started_at:timestamp(x.startTime||x.createTime),ended_at:timestamp(x.endTime),direction:x.direction,from_number:String(x.fromNumber||''),to_number:String(x.toNumber||''),extension:String(x.fromExt||x.toExt||''),duration_seconds:Math.max(0,Math.round(x.duration||0)),talk_seconds:Math.max(0,Math.round(x.billDuration||0)),outcome:x.hangupCause,source_data:x,synced_at:new Date().toISOString()}));
 const {error}=await db.from('callio_calls').upsert(records,{onConflict:'id'});if(error)throw Error('Call import: '+error.code+' '+error.message);
}
const {count,error}=await db.from('callio_calls').select('id',{count:'exact',head:true});if(error||count!==calls.length)throw Error('Call reconciliation failed');
const {error:stateError}=await db.from('callio_sync_state').upsert({id:'callio',last_success:new Date().toISOString(),history_from:timestamp(Math.min(...calls.map(x=>x.startTime||x.createTime))),records:count,detail:'Initial API history imported. Automatic schedule not enabled yet.'});if(stateError)throw stateError;
await writeFile(new URL('callio-import-result.json',dir),JSON.stringify({count,completedAt:new Date().toISOString()}));console.log('Callio records reconciled: '+count);
