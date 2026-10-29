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
