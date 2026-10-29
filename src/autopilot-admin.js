import {supabase,rpc} from './api.js';
const $=id=>document.getElementById(id);
let revision=0;
function output(x){$('out').textContent=typeof x==='string'?x:JSON.stringify(x,null,2);}
async function load(){
 if(!supabase){output('Supabase not configured');return;}
 const {data:{user}}=await supabase.auth.getUser();
 if(!user){output('Please sign in to CRM first');return;}
 const s=await rpc('elh_autopilot_admin_state');
 revision=s.revision;$('state').textContent=`Backend enabled=${s.enabled} · revision=${revision}`;
 $('rules').value=JSON.stringify(s.rules,null,2);
}
$('save').onclick=async()=>{
 try{const raw=JSON.parse($('rules').value);const s=await rpc('elh_autopilot_save_rules',{p_rules:raw,p_revision:revision});revision=s.revision;output('Draft saved. Automation remains OFF.');await load();}catch(e){output(e.message)}
};
$('shadow').onclick=async()=>{try{output(await rpc('elh_autopilot_shadow',{p_limit:100}));}catch(e){output(e.message)}};
load().catch(e=>output(e.message));
