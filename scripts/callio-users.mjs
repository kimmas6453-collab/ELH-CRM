import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('../private/',import.meta.url);
const {token}=JSON.parse(await readFile(new URL('callio-api-token.json',base),'utf8'));
const r=await fetch('https://clientapi.phonenet.io/user?page=1&pageSize=100',{headers:{token}});if(!r.ok)throw Error('Callio user list HTTP '+r.status);
const data=await r.json();await writeFile(new URL('callio-users.json',base),JSON.stringify(data));
console.log(JSON.stringify({keys:Object.keys(data),total:data.totalDocs,users:(data.docs||[]).map(x=>({id:x._id,name:x.name,email:x.email,ext:x.ext}))}));
