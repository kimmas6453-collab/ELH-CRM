// Offline conversion only. Does not connect to Google or Supabase.
// node scripts/prepare-import.mjs allocations.csv profiles.json output.json
// profiles.json is an array of {id,email} exported from the NEW profiles table.
import {readFile,writeFile} from 'node:fs/promises';
import {normalizePhone} from '../src/domain.js';
export function csvParse(text) {
 const rows=[];let row=[],cell='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('CSV có dấu ngoặc kép chưa đóng');
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
 const header=rows.shift();if(!header)throw Error('CSV trống');
 return rows.filter(r=>r.some(Boolean)).map((r,i)=>{
  if(r.length!==header.length)throw Error('Sai số cột dòng '+(i+2));
  return Object.fromEntries(header.map((h,n)=>[h,r[n]]));
 });
}
function date(value){
 if(!value)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value).toISOString().slice(0,10)!==value)throw Error('Ngày phải theo YYYY-MM-DD');return value;
}
export function convert(rows,profiles){
 const owners=new Map(profiles.map(p=>[p.email.toLowerCase(),p.id]));const seen=new Set();
 return rows.map((r,i)=>{
  const owner=owners.get((r.Assigned_To||'').trim().toLowerCase());
  if(r.Assigned_To&&!owner)throw Error(`Dòng ${i+2}: chưa ánh xạ nhân viên; dừng import.`);
  if(!r.Assignment_ID||seen.has(r.Assignment_ID))throw Error(`Dòng ${i+2}: ID trống hoặc trùng.`);seen.add(r.Assignment_ID);
  return {id:r.Assignment_ID,customer_id:r.Customer_ID||r.Assignment_ID,name:r.Customer_Name,phone:normalizePhone(r.Phone),project:r.Project||'',assigned_to:owner||null,status:r.Status||'Mới',next_followup:date(r.Next_Followup),notes:r.Notes||'',source:r.Source||'',priority:r.Priority||''};
 });
}
if(process.argv[1]?.endsWith('prepare-import.mjs')){
 const [input,profiles,output]=process.argv.slice(2);if(!output)throw Error('Usage: node scripts/prepare-import.mjs allocations.csv profiles.json output.json');
 const result=convert(csvParse(await readFile(input,'utf8')),JSON.parse(await readFile(profiles,'utf8')));
 await writeFile(output,JSON.stringify(result,null,2),{flag:'wx'});console.log(`Đã kiểm tra ${result.length} dòng. Chỉ tạo file local; chưa upload.`);
}
