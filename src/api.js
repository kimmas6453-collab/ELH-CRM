import {createClient} from '@supabase/supabase-js';
import {SessionCache} from './cache.js';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured=Boolean(url && key);
export const supabase=configured ? createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export const cache=new SessionCache();
export async function rpc(name,args={}) {
  const {data,error}=await supabase.rpc(name,args);
  if(error) throw error; return data;
}
export async function read(name,args={}) {
  const start=performance.now();
  const result=await cache.get(JSON.stringify([name,args]),()=>rpc(name,args));
  performance.measure('EH '+name,{start,end:performance.now()});
  return result;
}
export async function mutate(name,args={}) { const data=await rpc(name,args); cache.clear(); return data; }
