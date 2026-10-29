import { createClient } from 'npm:@supabase/supabase-js@2';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const secret=Deno.env.get('CALLIO_SYNC_SECRET');
 if(!secret||req.headers.get('x-sync-secret')!==secret)return json({error:'Unauthorized'},401);
 const token=Deno.env.get('CALLIO_API_TOKEN')?.trim();
 if(!token)return json({error:'Callio API token is not configured'},503);
 const db=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
 const lease=crypto.randomUUID();
 const {data:claimed,error:lockError}=await db.rpc('claim_callio_sync',{p_lease:lease});
 if(lockError)return json({error:'Cannot acquire sync lease'},500);
 if(!claimed)return json({status:'already_running'},202);
 try{
  const {data:state,error:stateError}=await db.from('callio_sync_state').select('last_success').eq('id','callio').maybeSingle();if(stateError)throw Error('State read failed');
  const to=Date.now();const from=Math.max(0,state?.last_success?new Date(state.last_success).getTime()-48*3600000:0);
  // Refresh the vendor's account identifiers; never infer the CRM owner from a name.
  for(let page=1;page<=20;page++){
   const response=await fetch(`https://clientapi.phonenet.io/user?page=${page}&pageSize=100`,{headers:{token},signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('Callio users HTTP '+response.status);
   const users=await response.json();if(!Array.isArray(users.docs))throw Error('Invalid Callio users response');
   const accounts=users.docs.filter(u=>u._id&&u.email).map(u=>({id:u._id,email:u.email,name:u.name||u.email,extension:String(u.ext||'')}));
   if(accounts.length){const {error}=await db.from('callio_accounts').upsert(accounts,{onConflict:'id'});if(error)throw Error('Account sync failed');}
   if(!users.hasNextPage)break;
   if(page===20)throw Error('Account pagination limit exceeded');
  }
  let pages=1,seen=new Set();
  for(let page=1;page<=pages;page++){
   const url=new URL('https://clientapi.phonenet.io/call');url.search=new URLSearchParams({page:String(page),pageSize:'100',from:String(from),to:String(to)}).toString();
   const resp=await fetch(url,{headers:{token},signal:AbortSignal.timeout(20000)});
   if(!resp.ok)throw Error('Callio HTTP '+resp.status);
   const batch=await resp.json();if(!Array.isArray(batch.docs)||!Number.isInteger(batch.totalPages))throw Error('Invalid Callio response');
   pages=batch.totalPages;if(pages>50)throw Error('Backfill exceeds a scheduled run; administrator must backfill first');
   const rows=batch.docs.map(x=>{seen.add(x._id);return {id:x._id,started_at:new Date(x.startTime||x.createTime).toISOString(),ended_at:x.endTime?new Date(x.endTime).toISOString():null,direction:x.direction,from_number:String(x.fromNumber||''),to_number:String(x.toNumber||''),extension:String(x.fromExt||x.toExt||''),duration_seconds:Math.max(0,Math.round(x.duration||0)),talk_seconds:Math.max(0,Math.round(x.billDuration||0)),outcome:x.hangupCause,source_data:x,synced_at:new Date().toISOString()};});
   if(rows.length){const {error}=await db.from('callio_calls').upsert(rows,{onConflict:'id'});if(error)throw Error('Database upsert failed');}
  }
  const {count,error:countError}=await db.from('callio_calls').select('id',{count:'exact',head:true});if(countError)throw Error('Count failed');
  const {error}=await db.from('callio_sync_state').update({last_success:new Date(to).toISOString(),records:count,detail:'Scheduled sync completed'}).eq('id','callio');if(error)throw Error('Watermark update failed');
  return json({ok:true,processed:seen.size,total:count});
 }catch(err){
  const message=err instanceof Error?err.message:'Sync failed';
  await db.from('callio_sync_state').update({detail:message}).eq('id','callio');
  return json({error:message},502);
 }finally{await db.rpc('release_callio_sync',{p_lease:lease});}
});
