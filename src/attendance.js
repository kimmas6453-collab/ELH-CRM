import {rpc,mutate,supabase} from './api.js';
import {escapeHtml as e} from './domain.js';
import './attendance.css';
const tz='Asia/Ho_Chi_Minh';
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(s,n)=>{const d=new Date(`${s}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const monday=s=>{const d=new Date(`${s}T12:00:00Z`);return addDays(s,-(d.getUTCDay()+6)%7);};
const viTime=stamp=>stamp?new Date(stamp).toLocaleTimeString('vi-VN',{timeZone:tz,hour:'2-digit',minute:'2-digit'}):'—';
const datestr=stamp=>stamp?new Date(stamp).toLocaleString('vi-VN',{timeZone:tz}):'';
const shiftName=sh=>sh==='AM'?'Sáng 09–12h':'Chiều 14–17h';
const csvCell=x=>{
 const raw=String(x??'');
 const safe=/^[\u0000-\u0020]*[=+\-@]/.test(raw)?"'"+raw:raw;
 return '"' + safe.replace(/"/g, '""') + '"';
};
function exportCSV(rows,filename){const csv='\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
export async function openAttendance(profile){
 const admin=profile.role==='ADMIN';
 const dlg=document.createElement('dialog');dlg.className='report-dialog tls-att-dialog';dlg.setAttribute('aria-label','Chấm công TLS');
 dlg.innerHTML=`<button class="close" aria-label="Đóng">×</button><span class="eyebrow">ELLIE HOMES / TELESALES</span><h2>Chấm công & Đối soát</h2><div class="att-toolbar"><button data-prev>← Tuần trước</button><strong data-period></strong><button data-next>Tuần sau →</button><button data-this>Tuần hiện tại</button><button data-month>Xem tháng</button><button data-refresh>Làm mới</button></div><p data-message role="status" aria-live="polite"></p><div data-metrics></div><div data-table></div>${admin?'<div data-requests></div><div data-lock></div>':''}<p class="att-hint">Công quy đổi chỉ để đối soát (mặc định 360 phút = 1 công). Thời gian tính công giới hạn trong khung ca; không tự động tính lương.</p>`;
 document.body.append(dlg);dlg.showModal();dlg.querySelector('.close').onclick=()=>dlg.close();dlg.onclose=()=>dlg.remove();
 const sub=supabase.auth.onAuthStateChange((_ev,s)=>{if(s?.user.id!==profile.id)dlg.close();});dlg.addEventListener('close',()=>sub.data.subscription.unsubscribe());
 const $=sel=>dlg.querySelector(sel);let start=monday(localDate()),month=false,state=null;
 const say=t=>{if(dlg.isConnected)$('[data-message]').textContent=t;};
 const busy=async fn=>{dlg.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(err){say(`Lỗi: ${err.message||err}`);}finally{if(dlg.isConnected)dlg.querySelectorAll('button').forEach(b=>b.disabled=false);}};
 const range=()=>month?{from:start.slice(0,7)+'-01',to:addDays(addDays(start.slice(0,7)+'-01',32).slice(0,7)+'-01',-1)}:{from:start,to:addDays(start,6)};
 async function load(){
  const {from,to}=range();say('Đang tải dữ liệu…');state=await rpc('tls_att_report',{p_from:from,p_to:to});if(!dlg.isConnected)return;
  $('[data-period]').textContent=`${from} → ${to}`;
  const rows=state.rows||[],minutes=rows.reduce((t,r)=>t+Number(r.minutes||0),0),finished=rows.filter(r=>r.status==='COMPLETED').length,pending=(state.requests||[]).length;
  $('[data-metrics]').innerHTML=`<div class="att-metrics"><article><span>Ca đã duyệt</span><strong>${rows.length}</strong></article><article><span>Ca hoàn tất</span><strong>${finished}</strong></article><article><span>Phút hợp lệ</span><strong>${minutes.toLocaleString('vi-VN')}</strong></article><article><span>Công quy đổi</span><strong>${(minutes/Number(state.minutes_per_workday||360)).toFixed(2)}</strong></article><article><span>Yêu cầu chờ xử lý</span><strong>${pending}</strong></article></div>`;
  const isLocked=state.locked_months||[];
  $('[data-table]').innerHTML=`<div class="att-section-title"><h3>Chi tiết theo ca</h3><button data-export>Xuất CSV</button></div><div class="table-scroll"><table><thead><tr>${admin?'<th>Nhân viên</th>':''}<th>Ngày</th><th>Ca</th><th>Check-in</th><th>Check-out</th><th>Phút hợp lệ</th><th>Trễ</th><th>Về sớm</th><th>Trạng thái / Thao tác</th></tr></thead><tbody>${rows.map(r=>`<tr>${admin?`<td>${e(r.employee)}</td>`:''}<td>${e(r.work_date)}</td><td>${shiftName(r.shift)}</td><td>${viTime(r.approved_in||r.check_in)}${r.approved_in?'<small> (đã chỉnh)</small>':''}</td><td>${viTime(r.approved_out||r.check_out)}${r.approved_out?'<small> (đã chỉnh)</small>':''}</td><td>${Number(r.minutes||0)}</td><td>${Number(r.late_minutes||0)}′</td><td>${Number(r.early_minutes||0)}′</td><td><span class="att-state">${e(r.status)}${r.pending?' · Chờ điều chỉnh':''}</span>${!admin?`<div class="att-row-actions"><button data-in="${e(r.registration_id)}" ${(r.check_in||r.approved_in||isLocked.includes(r.work_date.slice(0,7)+'-01'))?'disabled':''}>Vào ca</button><button data-out="${e(r.registration_id)}" ${(!r.check_in||r.check_out||r.approved_out||isLocked.includes(r.work_date.slice(0,7)+'-01'))?'disabled':''}>Ra ca</button><button data-adjust="${e(r.registration_id)}" ${r.pending||isLocked.includes(r.work_date.slice(0,7)+'-01')?'disabled':''}>Xin sửa</button></div>`:''}</td></tr>`).join('')||`<tr><td colspan="${admin?9:8}">Không có ca đã duyệt trong khoảng này.</td></tr>`}</tbody></table></div>`;
  $('[data-table]').onclick=ev=>{const b=ev.target.closest('button');if(!b)return;
   if(b.dataset.export!==undefined){exportCSV([['Nhân viên','Ngày','Ca','Vào','Ra','Phút','Trễ phút','Về sớm phút','Trạng thái'],...rows.map(r=>[r.employee,r.work_date,r.shift,datestr(r.approved_in||r.check_in),datestr(r.approved_out||r.check_out),r.minutes,r.late_minutes,r.early_minutes,r.status])],`EH_TLS_CONG_${from}_${to}.csv`);return;}
   if(b.dataset.in||b.dataset.out){const action=b.dataset.in?'IN':'OUT',id=b.dataset.in||b.dataset.out;busy(async()=>{if(!confirm(`Xác nhận ${action==='IN'?'check-in':'check-out'} theo giờ máy chủ?`))return;const result=await mutate('tls_att_action',{p_registration:id,p_action:action});await load();say(`Đã ghi nhận ${action==='IN'?'vào ca':'ra ca'} lúc ${datestr(result.at)}.`);});return;}
   if(b.dataset.adjust){const id=b.dataset.adjust;const rawIn=prompt('Giờ vào đề nghị (YYYY-MM-DD HH:mm). Để trống nếu không sửa giờ vào:','');if(rawIn===null)return;const rawOut=prompt('Giờ ra đề nghị (YYYY-MM-DD HH:mm). Để trống nếu không sửa giờ ra:','');if(rawOut===null)return;const reason=prompt('Lý do điều chỉnh (tối thiểu 5 ký tự):','');if(reason===null)return;
    const parse=v=>{
     const value=v.trim();if(!value)return null;
     if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value))throw new Error('Giờ phải theo dạng YYYY-MM-DD HH:mm');
     const date=new Date(value.replace(' ','T')+':00+07:00');
     if(!Number.isFinite(date.getTime()))throw new Error('Ngày giờ không hợp lệ');
     const check=new Date(date.getTime()+7*3600000).toISOString().slice(0,16).replace('T',' ');
     if(check!==value)throw new Error('Ngày giờ không hợp lệ');
     return date.toISOString();
    };
    busy(async()=>{if(!rawIn.trim()&&!rawOut.trim())throw new Error('Nhập ít nhất một giờ cần điều chỉnh');if(reason.trim().length<5)throw new Error('Lý do phải có ít nhất 5 ký tự');const requestedIn=parse(rawIn),requestedOut=parse(rawOut);if(requestedIn&&requestedOut&&requestedOut<=requestedIn)throw new Error('Giờ ra phải sau giờ vào');await mutate('tls_att_request',{p_registration:id,p_in:requestedIn,p_out:requestedOut,p_reason:reason.trim()});await load();say('Đã gửi yêu cầu điều chỉnh để quản lý phê duyệt.');});}
  };
  if(admin){
   const reqs=state.requests||[];
   $('[data-requests]').innerHTML=`<h3>Yêu cầu điều chỉnh chờ duyệt (${reqs.length})</h3>${reqs.map(r=>`<article class="att-request"><div><strong>${e(r.employee)}</strong> · ${e(r.date)} · ${shiftName(r.shift)}<p>${e(r.reason)}</p><small>Đề nghị vào: ${datestr(r.requested_in)||'Giữ nguyên'} · Ra: ${datestr(r.requested_out)||'Giữ nguyên'}</small></div><div><button data-decide="${e(r.id)}" data-yes="1">Duyệt</button><button data-decide="${e(r.id)}" data-yes="0">Từ chối</button></div></article>`).join('')||'<p>Không có yêu cầu chờ duyệt.</p>'}`;
   $('[data-requests]').onclick=ev=>{const b=ev.target.closest('[data-decide]');if(!b)return;busy(async()=>{const yes=b.dataset.yes==='1';if(!confirm(yes?'Duyệt điều chỉnh chấm công?':'Từ chối điều chỉnh?'))return;const note=prompt('Ghi chú quản lý (có thể để trống):','');if(note===null)return;await mutate('tls_att_decide',{p_request:b.dataset.decide,p_approve:yes,p_note:note});await load();say('Đã xử lý yêu cầu.');});};
   const lockable=month&&range().from<localDate().slice(0,7)+'-01';
   $('[data-lock]').innerHTML=`<section class="att-lock"><h3>Khóa kỳ chấm công</h3><p>Kỳ đã khóa: ${isLocked.map(e).join(', ')||'Chưa có trong phạm vi này'}</p><button data-lock-month ${!lockable?'disabled':''}>Khóa tháng đang xem</button><button data-unlock-month ${!lockable?'disabled':''}>Mở khóa tháng đang xem</button><small>Chỉ quản trị viên. Không thể khóa tháng hiện tại hoặc còn yêu cầu điều chỉnh chờ duyệt.</small></section>`;
   $('[data-lock]').onclick=ev=>{const b=ev.target.closest('button');if(!b)return;const yes=b.hasAttribute('data-lock-month');busy(async()=>{if(!confirm(yes?'Khóa kỳ? Sau khi khóa không thể chấm công hoặc điều chỉnh trong tháng này.':'Mở khóa kỳ? Thao tác này cần được quản lý kiểm soát.'))return;await mutate('tls_att_lock_month',{p_month:range().from,p_lock:yes,p_note:''});await load();say(yes?'Đã khóa tháng.':'Đã mở khóa tháng.');});};
  }
  say('');
 }
 $('[data-prev]').onclick=()=>busy(async()=>{start=month?addDays(start.slice(0,7)+'-01',-1).slice(0,7)+'-01':addDays(start,-7);await load();});
 $('[data-next]').onclick=()=>busy(async()=>{start=month?addDays(addDays(start.slice(0,7)+'-01',32).slice(0,7)+'-01',0):addDays(start,7);await load();});
 $('[data-this]').onclick=()=>busy(async()=>{start=month?localDate().slice(0,7)+'-01':monday(localDate());await load();});
 $('[data-month]').onclick=()=>busy(async()=>{month=!month;start=month?start.slice(0,7)+'-01':monday(start);$('[data-month]').textContent=month?'Xem tuần':'Xem tháng';await load();});
 $('[data-refresh]').onclick=()=>busy(load);
 await busy(load);
}
