import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Resolve explicitly from this script rather than process cwd.
const legacy=new URL('../../ELH-CRM/',import.meta.url);
const files=await readdir(legacy),functions=new Map(),sources=[];
let html='';
for(const name of files.filter(n=>/\.(js|html)$/.test(n))){
 const text=await readFile(new URL(name,legacy),'utf8');
 sources.push({file:name,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});
 if(name==='Index.html')html=text;
 if(name.endsWith('.js'))for(const m of text.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)){const list=functions.get(m[1])||[];list.push(name);functions.set(m[1],list);}
}
const rpcs=[...new Set([...html.matchAll(/(?:rpc|rpcCallio)\s*\(\s*["']([^"']+)["']/g)].map(m=>m[1]))].sort();
const result={generatedAt:new Date().toISOString(),sourceDirectory:'D:/EH Project/ELH-CRM',sources,clientRpcNames:rpcs,duplicateBackendFunctions:[...functions].filter(([,v])=>v.length>1).map(([name,files])=>({name,files})),note:'Static inventory only. Dynamic wrappers and calls may need manual review. Original files untouched.'};
await writeFile(new URL('../legacy-inventory.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({files:sources.length,rpcs:rpcs.length,duplicates:result.duplicateBackendFunctions.length}));
