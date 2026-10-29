import {readFile,writeFile} from 'node:fs/promises';
const dir=new URL('../private/',import.meta.url);
const {token}=JSON.parse(await readFile(new URL('callio-session.json',dir),'utf8'));
const to=Date.now(),from=0;
const r=await fetch(`https://clientapi.phonenet.io/call?page=1&pageSize=100&from=${from}&to=${to}`,{headers:{token}});
if(!r.ok)throw Error('Callio history HTTP '+r.status);
const body=await r.json();
await writeFile(new URL('callio-page1.json',dir),JSON.stringify(body));
console.log(JSON.stringify({keys:Object.keys(body),totalDocs:body.totalDocs,totalPages:body.totalPages,page:body.page,hasNextPage:body.hasNextPage,itemFields:Object.keys(body.docs?.[0]||{})}));
const calls=new Map((body.docs||[]).map(x=>[x._id,x]));
for(let page=2;page<=body.totalPages;page++){
 const resp=await fetch(`https://clientapi.phonenet.io/call?page=${page}&pageSize=100&from=${from}&to=${to}`,{headers:{token}});
 if(!resp.ok)throw Error('Callio page '+page+' HTTP '+resp.status);
 const batch=await resp.json();for(const call of batch.docs)calls.set(call._id,call);
 if(page%10===0)console.log('Read calls: '+calls.size);
}
if(calls.size!==body.totalDocs)throw Error('Call count changed or pagination incomplete; retry with fixed snapshot');
await writeFile(new URL('callio-history.json',dir),JSON.stringify([...calls.values()]));
await writeFile(new URL('callio-backfill-result.json',dir),JSON.stringify({count:calls.size,from,to,oldest:Math.min(...[...calls.values()].map(x=>x.startTime||x.createTime)),newest:Math.max(...[...calls.values()].map(x=>x.startTime||x.createTime))}));
console.log('Verified full available API history: '+calls.size);
