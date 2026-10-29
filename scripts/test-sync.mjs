import {readFile,writeFile} from 'node:fs/promises';
const {secret}=JSON.parse(await readFile('private/callio-sync-secret.json','utf8'));
const url='https://qmzmkijlarwdlslipaou.supabase.co/functions/v1/callio-sync';
for(const authorized of [false,true]){
const r=await fetch(url,{method:'POST',headers:authorized?{'x-sync-secret':secret}:{},body:'{}'});
console.log(JSON.stringify({authorized,status:r.status,result:await r.json()}));
}
