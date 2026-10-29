import {readFile,writeFile} from 'node:fs/promises';import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(await readFile('private/supabase-server.json','utf8'));const db=createClient(c.url,c.key,{auth:{persistSession:false}});
const calls=JSON.parse(await readFile('private/callio-history.json','utf8'));const list=Array.isArray(calls)?calls:calls.docs;if(!list)throw Error('Unknown history format');
const users=new Map();for(const call of list)for(const field of ['fromUser','toUser']){const u=call[field];if(u?._id&&u.email)users.set(u._id,{id:u._id,email:u.email,name:u.name||u.email,extension:String(u.ext||'')});}
const {error}=await db.from('callio_accounts').upsert([...users.values()],{onConflict:'id',ignoreDuplicates:true});if(error)throw Error(error.message);console.log({accountsFromVerifiedHistory:users.size});
