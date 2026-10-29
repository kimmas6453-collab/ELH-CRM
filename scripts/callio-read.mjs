import {readFile,writeFile} from 'node:fs/promises';
const dir=new URL('../private/',import.meta.url);
const credentials=JSON.parse((await readFile(new URL('callio-login.json',dir),'utf8')).replace(/^\uFEFF/,''));
const response=await fetch('https://clientapi.phonenet.io/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});
if(!response.ok)throw Error('Callio login HTTP '+response.status);
const data=await response.json();
// Persist the response privately; never log authentication material.
await writeFile(new URL('callio-session.json',dir),JSON.stringify(data));
console.log(JSON.stringify({login:true,fields:Object.keys(data)}));
