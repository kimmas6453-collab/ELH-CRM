import './shifts.css';
import {rpc,mutate,supabase} from './api.js';
import {escapeHtml as e} from './domain.js';
const tz='Asia/Ho_Chi_Minh';
const dateISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function monday(offset=0){const now=new Date();const local=new Date(now.toLocaleString('en-US',{timeZone:tz}));local.setHours(12,0,0,0);local.setDate(local.getDate()-(local.getDay()+6)%7+offset*7);return local;}
function isoOffset(start,n){const d=new Date(start+'T12:00:00');d.setDate(d.getDate()+n);return dateISO(d);}
const label=s=>s==='APPROVED'?'Đã duyệt':s==='PENDING'?'Chờ duyệt':s==='WAITLISTED'?'Danh sách chờ':s==='CANCEL_PENDING'?'Chờ hủy':s==='CANCELLED'?'Đã hủy':'Từ chối';
const shName=s=>s==='AM'?'Sáng 09–12h':'Chiều 14–17h';
export async function openShifts(profile){
 const d=document.createElement('dialog');d.className='report-dialog tls-dialog';d.setAttribute('aria-label','Lịch làm việc TLS');
 d.innerHTML=`<button class="close" aria-label="Đóng">×</button><span class="eyebrow">ELLIE HOMES / TELESALES</span><h2>Lịch làm việc TLS</h2>
 <nav class="tls-toolbar"><button data-prev>← Tuần trước</button><strong data-week></strong><button data-next>Tuần sau →</button><button data-copy>Sao chép tuần trước</button><button data-refresh>Làm mới</button></nav>
 <p class="tls-status" role="status" aria-live="polite"></p><div data-summary></div><div data-calendar></div>
 ${profile.role==='ADMIN'?'<div data-management></div>':''}`;
 document.body.append(d);d.showModal();d.querySelector('.close').onclick=()=>d.close();d.onclose=()=>d.remove();
 const sub=supabase.auth.onAuthStateChange((_ev,s)=>{if(s?.user.id!==profile.id)d.close();});d.addEventListener('close',()=>sub.data.subscription.unsubscribe());
 let start=dateISO(monday(1)),week=null;const $=s=>d.querySelector(s);const status=t=>{if(d.isConnected)$('[role=status]').textContent=t;};
 const busy=async (cb)=>{d.querySelectorAll('button').forEach(b=>b.disabled=true);try{await cb();}catch(err){status('Không thực hiện được: '+(err.message||err));}finally{if(d.isConnected)d.querySelectorAll('button').forEach(b=>b.disabled=false);}};
 async function load(){
  status('Đang tải lịch…');week=await rpc('tls_week',{p_week:start});if(!d.isConnected)return;
  $('[data-week]').textContent=`${isoOffset(start,0)} – ${isoOffset(start,5)}`;
  if(profile.role==='ADMIN'){await manager();status('');return;}const slots=week.slots||[],approved=slots.filter(s=>s.mine?.status==='APPROVED').length;
  $('[data-summary]').innerHTML=`<div class="tls-summary"><strong>${approved}/${week.min_weekly} ca được xác nhận</strong><span>${approved>=week.min_weekly?'Đã đạt yêu cầu tối thiểu':`Còn thiếu ${week.min_weekly-approved} ca`}</span><small>Hạn đăng ký thông thường: ${e(new Date(week.deadline).toLocaleString('vi-VN',{timeZone:tz}))}</small></div>`;
  let html='<div class="tls-grid"><div class="tls-head">Ngày</div><div class="tls-head">Sáng 09:00–12:00</div><div class="tls-head">Chiều 14:00–17:00</div>';
  for(let i=0;i<6;i++){
   html+=`<div class="tls-day">Thứ ${i+2}<small>${e(isoOffset(start,i))}</small></div>`;
   for(const sh of ['AM','PM']){
    const s=slots.find(x=>x.date===isoOffset(start,i)&&x.shift===sh),state=s?.mine?.status;
    html+=`<div class="tls-cell"><strong>${state?e(label(state)):'Chưa đăng ký'}</strong>
    <small>${s?.capacity?`${Number(s.approved||0)}/${Number(s.capacity)} chỗ`:'Không giới hạn chỗ'}</small>
    ${state==='APPROVED'||state==='PENDING'||state==='WAITLISTED'?`<button data-cancel="${e(s.mine.id)}">Xin hủy</button>`:
      state==='CANCEL_PENDING'?'<small>Đang chờ duyệt hủy</small>':!s?.open?'<small>Ca đã đóng</small>':`<button data-register="${e(s.date)}" data-shift="${sh}">+ Đăng ký</button>`}</div>`;
   }
  }
  html+='</div><p class="tls-footnote">Chủ nhật nghỉ. Ca chờ duyệt hoặc danh sách chờ chưa được tính vào mức tối thiểu 5 ca.</p>';
  $('[data-calendar]').innerHTML=html;
  $('[data-calendar]').onclick=ev=>{
   const b=ev.target.closest('button');if(!b)return;
   busy(async()=>{
    if(b.dataset.register){
     const r=await mutate('tls_register',{p_work_date:b.dataset.register,p_shift:b.dataset.shift});
     await load();
     status(`Đăng ký: ${label(r.status)}${r.duplicate?' (ca đã tồn tại)':''}`);
    }else if(b.dataset.cancel){
     if(!confirm('Gửi yêu cầu hủy ca này?'))return;
     const r=await mutate('tls_cancel',{p_registration:b.dataset.cancel,p_reason:'TLS yêu cầu hủy'});
     await load();
     status(`Kết quả: ${label(r)}`);
    }
   });
  };
  if(profile.role==='ADMIN')await manager();
  status('');
 }
 async function manager(){
  const data=await rpc('tls_admin_overview',{p_week:start});
  const members=data.members||[],exceptions=data.exceptions||[],ok=members.filter(x=>x.count>=week.min_weekly).length;
  $('[data-management]').innerHTML=`<section class="tls-manager"><h3>Quản lý lịch tuần</h3><p><strong>${members.length}</strong> TLS · <strong>${ok}</strong> đủ ca · <strong>${members.length-ok}</strong> thiếu ca · <strong>${exceptions.length}</strong> yêu cầu cần xử lý</p>
  <div class="table-scroll"><table><thead><tr><th>Nhân viên</th><th>Ca đã duyệt</th><th>Giờ đăng ký</th><th>Trạng thái</th></tr></thead><tbody>
  ${members.map(m=>`<tr><td>${e(m.name)}</td><td>${m.count}</td><td>${m.count*3}h</td><td>${m.count>=week.min_weekly?'Đạt':`Thiếu ${week.min_weekly-m.count}`}</td></tr>`).join('')}</tbody></table></div>
  <h3>Yêu cầu ngoại lệ</h3>${exceptions.length?exceptions.map(r=>`<article class="tls-exception"><strong>${e(r.employee)}</strong> · ${e(r.date)} · ${shName(r.shift)} <span>${e(label(r.status))}</span><p>${e(r.reason||'Không có ghi chú')}</p><button data-decision="${e(r.id)}" data-approve="1">Duyệt</button> <button data-decision="${e(r.id)}" data-approve="0">Từ chối</button></article>`).join(''):'<p>Không có yêu cầu chờ xử lý.</p>'}
  <button data-export>Xuất CSV tổng hợp</button></section>`;
  $('[data-management]').onclick=ev=>{const b=ev.target.closest('button');if(!b)return;
   if(b.hasAttribute('data-export')){const lines=[['Nhân viên','Số ca được duyệt','Số giờ dự kiến','Trạng thái'],...members.map(m=>[m.name,m.count,m.count*3,m.count>=week.min_weekly?'Đạt':'Thiếu'])];const csv='\ufeff'+lines.map(row=>row.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`TLS_LICH_${start}.csv`;a.click();URL.revokeObjectURL(a.href);return;}
   if(b.dataset.decision)busy(async()=>{const yes=b.dataset.approve==='1';if(!confirm(yes?'Duyệt yêu cầu?':'Từ chối yêu cầu?'))return;await mutate('tls_admin_decide',{p_registration:b.dataset.decision,p_approve:yes,p_note:''});await load();});
  };
 }
 $('[data-prev]').onclick=()=>busy(async()=>{start=isoOffset(start,-7);await load();});
 $('[data-next]').onclick=()=>busy(async()=>{start=isoOffset(start,7);await load();});
 $('[data-refresh]').onclick=()=>busy(load);
 $('[data-copy]').onclick=()=>busy(async()=>{
  const prev=await rpc('tls_week',{p_week:isoOffset(start,-7)});
  const source=(prev.slots||[]).filter(x=>x.mine?.status==='APPROVED');
  if(!source.length){status('Tuần trước không có ca đã duyệt để sao chép.');return;}
  if(!confirm(`Sao chép ${source.length} ca đã duyệt từ tuần trước vào tuần này? Lịch chỉ được đăng ký sau khi chị xác nhận.`))return;
  const counts={APPROVED:0,PENDING:0,WAITLISTED:0,SKIPPED:0,FAILED:0};
  const target=await rpc('tls_week',{p_week:start});
  const occupied=new Set((target.slots||[]).filter(s=>
   ['APPROVED','PENDING','WAITLISTED','CANCEL_PENDING'].includes(s.mine?.status)
  ).map(s=>`${s.date}|${s.shift}`));
  const failures=[];
  for(const s of source){
   const i=Math.round((new Date(s.date+'T12:00:00')-new Date(prev.week+'T12:00:00'))/86400000);
   const workDate=isoOffset(start,i),key=`${workDate}|${s.shift}`;
   if(occupied.has(key)){counts.SKIPPED++;continue;}
   try{
    const r=await mutate('tls_register',{p_work_date:workDate,p_shift:s.shift});
    if(r.duplicate){counts.SKIPPED++;occupied.add(key);continue;}
    if(counts[r.status]===undefined){counts.FAILED++;failures.push(`${workDate}: unexpected ${r.status}`);continue;}
    counts[r.status]++;occupied.add(key);
   }catch(err){counts.FAILED++;failures.push(`${workDate}: ${err.message||err}`);}
  }
  await load();
  status(`Sao chép: ${counts.APPROVED} đã duyệt, ${counts.PENDING} chờ duyệt, ${counts.WAITLISTED} danh sách chờ, ${counts.SKIPPED} đã có, ${counts.FAILED} lỗi.${failures.length?' Lỗi đầu tiên: '+failures[0]:''}`);
 });
 if(profile.role==='ADMIN'){for(const k of ['[data-summary]','[data-calendar]','[data-copy]'])d.querySelector(k)?.remove();} await busy(load);
}
