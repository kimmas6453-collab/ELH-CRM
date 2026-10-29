import './style.css';
import {configured,supabase,read,rpc,mutate,cache} from './api.js';
import {escapeHtml as e,statuses,normalizePhone} from './domain.js';
const root=document.querySelector('#app');
let user=null,profile=null,epoch=0,seq=0,items=[],cursor=null,hasMore=false,mode='all',query='',status='',phoneModule=null,activeDetail=null;
const $=id=>document.getElementById(id);
const options=()=>statuses.map(s=>`<option>${e(s)}</option>`).join('');
function message(text) {const box=$('message');if(box) {box.textContent=text; box.hidden=!text;}}
function error(err) {if(err?.message==='STALE_SESSION')return;message(err?.message||'Không thực hiện được yêu cầu.');}
function loginPage() {
 root.innerHTML=`<main class="login"><section class="brand-panel"><span class="brand">EH / ELLIE HOMES</span><h1>Mỗi kết nối.<br>Một cơ hội mới.</h1><p>Không gian chăm sóc khách hàng của đội ngũ Ellie Homes.</p><span class="caption">CUSTOMER RELATIONSHIPS, MADE PERSONAL.</span></section><section class="login-form"><span class="eyebrow">CHÀO MỪNG TRỞ LẠI</span><h2>Bắt đầu ngày làm việc</h2><p>Đăng nhập bằng tài khoản được quản trị viên cấp.</p><div id="message" role="status" hidden></div>${configured?`<form id="login"><label>Tài khoản hoặc email<input type="text" name="email" autocomplete="username" required></label><label>Mật khẩu<input type="password" name="password" autocomplete="current-password" required></label><button class="primary">Đăng nhập</button></form>`:`<div class="notice">Chưa kết nối Supabase. Cấu hình URL và publishable key trong môi trường triển khai.</div>`}<small>Phiên đăng nhập được duy trì trên trình duyệt này. Hãy đăng xuất khi dùng máy chung.</small></section></main>`;
 if(configured) $('login').onsubmit=async ev=>{ev.preventDefault();const form=ev.currentTarget,button=form.querySelector('button');button.disabled=true;try{const data=new FormData(form);const {error:err}=await supabase.auth.signInWithPassword({email:String(data.get('email')).trim().includes('@')?String(data.get('email')).trim():String(data.get('email')).trim().toLowerCase()+'@staff.elliehomes.internal',password:data.get('password')});if(err)throw err;}catch(err){error(err);}finally{button.disabled=false;}};
}
function shell() {
 root.innerHTML=`<div class="workspace"><aside class="sidebar"><a class="brand" href="#">EH <span>ELLIE HOMES</span></a><p class="nav-label">KHÔNG GIAN LÀM VIỆC</p><button data-mode="all" class="nav active">${profile.role==='ADMIN'?'Toàn bộ khách hàng':'Khách hàng của tôi'}</button><button data-mode="today" class="nav">Lịch hôm nay</button><button data-mode="overdue" class="nav">Cần chăm sóc</button>${profile.role==='ADMIN'?'<button data-mode="pool" class="nav">Kho khách chưa phân bổ</button>':''}${profile.role==='ADMIN'?'<button id="team" class="nav">Quản lý đội ngũ</button>':''}${profile.role==="ADMIN" ? `<button id="dashboard" class="nav">Dashboard</button><button id="reports" class="nav">Báo cáo cuộc gọi</button>` : ""}${profile.role==="ADMIN" ? `<button id="admin-settings" class="nav">Cài đặt hệ thống</button>` : ""}<button id="tls-shifts" class="nav">Đăng ký ca TLS</button><button id="tls-attendance" class="nav">Chấm công TLS</button><div class="sidebar-bottom"><strong>${e(profile.name)}</strong><small>${e(profile.email)}</small><button id="password" class="nav">Đổi mật khẩu</button><button id="logout" class="nav">Đăng xuất</button></div></aside><main class="content"><header><div><span class="eyebrow">ELLIE HOMES / CRM</span><h1 id="page-title">Khách hàng</h1><p>Chăm sóc đúng lúc. Kết nối dài lâu.</p></div><div class="header-actions">${profile.role==='ADMIN'?'<button id="mobile-team" class="mobile-admin">Quản lý đội ngũ</button>':''}${profile.role==="ADMIN" ? `<button id="mobile-dashboard">Dashboard</button>` : ""}<button id="callio">Kết nối Callio</button><button id="daily">Công việc ưu tiên</button><button id="notifications" aria-label="Thông báo">Thông báo</button><button id="new" class="primary">+ Thêm khách</button></div></header><div id="message" role="status" hidden></div><section id="metrics" class="metrics" aria-label="Tổng quan"><div class="skeleton"></div></section><section class="table-card"><div class="toolbar"><input id="search" type="search" placeholder="Tìm tên, số điện thoại hoặc dự án…" aria-label="Tìm khách"><select id="status" aria-label="Trạng thái"><option value="">Tất cả trạng thái</option>${options()}</select><button id="refresh">Làm mới</button></div><div id="allocation" hidden><label>Giao khách đã chọn cho <select id="staff" aria-label="Nhân viên nhận khách"></select></label><button id="assign" class="primary">Phân bổ</button></div><div class="table-scroll"><table aria-label="Danh sách khách hàng"><thead><tr><th></th><th>KHÁCH HÀNG</th><th>DỰ ÁN</th><th>TRẠNG THÁI</th><th>HẸN TIẾP</th><th>THAO TÁC</th></tr></thead><tbody id="rows"></tbody></table></div><footer><span id="count"></span><button id="more" hidden>Xem thêm</button></footer></section></main><nav class="mobile-nav" aria-label="Điều hướng chính"><button data-mode="all" class="active" aria-current="page"><span aria-hidden="true">♧</span>Khách hàng</button><button data-mode="today"><span aria-hidden="true">◷</span>Lịch hôm nay</button><button data-mode="overdue"><span aria-hidden="true">◎</span>Chăm sóc</button>${profile.role==='ADMIN'?'<button data-mode="pool"><span aria-hidden="true">▦</span>Kho khách</button>':''}${profile.role==="ADMIN" ? `<button id="mobile-reports"><span aria-hidden="true">▥</span>Báo cáo</button>` : ""}</nav></div><dialog id="detail"></dialog>`;
 $('logout').onclick=async()=>{await supabase.auth.signOut({scope:'local'});location.reload();};
 $('tls-shifts').onclick=async()=>{try{const {openShifts}=await import('./shifts.js');await openShifts(profile);}catch(err){error(err);}};
 $('tls-attendance').onclick=async()=>{try{const {openAttendance}=await import('./attendance.js');await openAttendance(profile);}catch(err){error(err);}};
 $('callio').onclick=async()=>{try{phoneModule??=await import('./callio.js');phoneModule.openCallio();}catch(err){error(err);}};
 $('password').onclick=async()=>{const {changePassword}=await import('./password.js');changePassword();};
 $('daily').onclick=async()=>{try{const {dailyQueue}=await import('./daily.js');dailyQueue(profile,id=>openDetail(id).catch(error),async id=>{try{phoneModule??=await import('./callio.js');message(await phoneModule.callLead(id));}catch(err){error(err);}});}catch(err){error(err);}};
 $('new').onclick=createForm; $('notifications').onclick=async()=>{try{const {openNotifications}=await import('./notifications.js');await openNotifications(profile);}catch(err){error(err);}};
  const report=async()=>{
    if(profile.role!=='ADMIN') return;
    try{
      const {openReports}=await import('./reports.js');
      await openReports(profile);
    }catch(err){error(err);}
  };
  const dashboard=async()=>{
    if(profile.role!=='ADMIN') return;
    try{
      const {openDashboard}=await import('./dashboard.js');
      openDashboard(profile,id=>openDetail(id).catch(error));
    }catch(err){error(err);}
  };
  if($('dashboard')) $('dashboard').onclick=dashboard;
  if($('mobile-dashboard')) $('mobile-dashboard').onclick=dashboard;
  if($('reports')) $('reports').onclick=report;
  if($('mobile-reports')) $('mobile-reports').onclick=report;
  if($('admin-settings')) $('admin-settings').onclick=async()=>{
    try{
      const {openAdminConsole}=await import('./admin-console.js');
      await openAdminConsole(profile);
    }catch(err){error(err);}
  };
 const team=async()=>{try{const {openTeam}=await import('./team.js');await openTeam(profile);}catch(err){error(err);}};if($('team'))$('team').onclick=team;if($('mobile-team'))$('mobile-team').onclick=team;
 let timer;
 $('search').oninput=ev=>{clearTimeout(timer);query=ev.target.value;seq++;timer=setTimeout(()=>loadList(true),250);};
 $('status').onchange=ev=>{status=ev.target.value;loadList(true);};
 $('refresh').onclick=()=>{cache.clear();loadList(true);loadSummary();};
 $('more').onclick=()=>loadList(false);
 document.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{
  mode=btn.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>{const selected=x.dataset.mode===mode;x.classList.toggle('active',selected);if(selected)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');});$('page-title').textContent=({all:'Khách hàng',today:'Lịch hôm nay',overdue:'Cần chăm sóc',pool:'Kho khách'})[mode];
  $('allocation').hidden=mode!=='pool';loadList(true);if(mode==='pool')loadStaff();
 });
 $('rows').onclick=async ev=>{const btn=ev.target.closest('button');if(!btn)return;btn.disabled=true;try{if(btn.dataset.action==='call'){phoneModule??=await import('./callio.js');message(await phoneModule.callLead(btn.dataset.id));}else await openDetail(btn.dataset.id);}catch(err){error(err);}finally{btn.disabled=false;}};
 $('assign')?.addEventListener('click',async()=>{
  const ids=[...document.querySelectorAll('input[name=pick]:checked')].map(x=>x.value);
  const btn=$('assign');btn.disabled=true;
  try{const r=await mutate('crm_assign',{p_ids:ids,p_to:$('staff').value});message(`Đã phân bổ ${r.count} khách.`);await loadList(true);loadSummary();}catch(err){error(err);}finally{btn.disabled=false;}
 });
 loadList(true);loadSummary();
}
async function loadStaff(){try{const {data,error:err}=await supabase.from('profiles').select('id,name').eq('active',true).eq('role','TELESALES').order('name');if(err)throw err;$('staff').innerHTML=data.map(p=>`<option value="${e(p.id)}">${e(p.name)}</option>`).join('');}catch(err){error(err);}}
async function loadSummary(){const ep=epoch;try{const d=await read('crm_summary');if(ep!==epoch)return;$('metrics').innerHTML=[['Khách đang chăm sóc',d.total],['Chưa liên hệ',d.pending],['Hẹn hôm nay',d.today],['Booking',d.booking]].map(([label,n])=>`<article><span>${label}</span><strong>${Number(n).toLocaleString('vi-VN')}</strong></article>`).join('');}catch(err){if(ep===epoch)error(err);}}
/* ELH_SPRINT03_BRIDGE */
async function loadList(reset) {
  if (profile?.role !== 'TELESALES') {
    return loadLegacyList(reset);
  }

  // Do not refresh the list while Customer Detail is open.
  if (root.querySelector(
    '.eh4-page, .eh-v3-page, .eh-vn-detail-page'
  )) {
    return;
  }

  const staff = await import('./staff-workspace-v3.js');

  return staff.loadStaffWorkspace({
    reset,
    root,
    rpc,
    profile,
    query,
    status,
    onReload: () => loadList(true),
    onError: error
  });
}
async function loadLegacyList(reset){
 const request=++seq,ep=epoch; if(reset){cursor=null;items=[];$('rows').innerHTML='<tr><td colspan="6"><div class="skeleton"></div></td></tr>';}
 $('more').disabled=true;
 try{
 const r=await read('crm_leads',{p_query:query,p_status:status,p_mode:mode,p_limit:matchMedia('(max-width:767px)').matches?15:30,p_cursor_at:cursor?.created_at||null,p_cursor_id:cursor?.id||null});
 if(ep!==epoch||request!==seq)return;
 items=reset?r.items:[...items,...r.items];hasMore=r.hasMore;cursor=items.at(-1);
 // Bound the DOM even during long sessions: keep the most recent 150 visible rows.
 if(items.length>150)items=items.slice(-150);
 $('rows').innerHTML=items.length?items.map(x=>`<tr class="lead-row"><td class="lead-avatar">${mode==='pool'?`<input type="checkbox" name="pick" value="${e(x.id)}" aria-label="Chọn ${e(x.name)}">`:'<span class="avatar">'+e(x.name.charAt(0))+'</span>'}</td><td class="lead-name"><button class="text-button" data-action="detail" data-id="${e(x.id)}">${e(x.name)}</button><small>${e(x.phone)}</small></td><td class="lead-project" data-label="Dự án">${e(x.project)||'Chưa có dự án'}</td><td class="lead-status"><span class="badge">${e(x.status)}</span></td><td class="lead-followup" data-label="Hẹn tiếp">${e(x.next_followup)||'Chưa đặt lịch'}</td><td class="lead-actions">${mode!=='pool'?`<button class="call-button" data-action="call" data-id="${e(x.id)}">Gọi Callio ↗</button>`:'Chưa phân bổ'}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">Chưa có khách phù hợp với bộ lọc này.</td></tr>';
 $('count').textContent=`Đang hiển thị ${items.length} khách`;$('more').hidden=!hasMore;
 }catch(err){if(ep===epoch&&request===seq){error(err);if(reset)$('rows').innerHTML='<tr><td colspan="6">Không tải được dữ liệu. Bấm Làm mới để thử lại.</td></tr>';}}
 finally{if(ep===epoch&&request===seq)$('more').disabled=false;}
}
function showDialog(html){const d=$('detail');d.setAttribute('aria-label','Hồ sơ và chăm sóc khách hàng');d.innerHTML='<button class="close" id="close-dialog" aria-label="Đóng">×</button>'+html;$('close-dialog').onclick=()=>d.close();if(!d.open)d.showModal();
import('./customer-tabs.js')
  .then(m => m.enhanceCustomerDetail(d))
  .catch(err => console.error('Customer tabs:',err));
return d;}
function sourceDetails(lead){
 const c=lead.legacy_data?.customer;if(!c)return '';
 const labels={Secondary_Phone:'Số điện thoại khác',Phone_Status:'Chất lượng số',Unit_Code:'Mã căn',Block:'Tòa / Block',Address:'Địa chỉ',Customer_Need:'Nhu cầu',Followup_Notes:'Ghi chú nguồn',Followup_Status:'Trạng thái nguồn',Contact_Date:'Ngày liên hệ nguồn',Birth_Date:'Ngày sinh',Birth_Year:'Năm sinh',Gender:'Giới tính',Contract_Number:'Mã hợp đồng',Area:'Diện tích',Contract_Value:'Giá trị hợp đồng',Paid_Amount:'Đã thanh toán',Source_Sheet:'Nguồn dữ liệu',Quality_Flag:'Đánh giá nguồn'};
 const entries=Object.entries(labels).filter(([key])=>c[key]!==null&&c[key]!==undefined&&c[key]!=='');
 return '<details class="source-details"><summary>Thông tin gốc đã chuyển từ CRM cũ</summary><dl>'+entries.map(([key,label])=>'<dt>'+e(label)+'</dt><dd>'+e(c[key])+'</dd>').join('')+'</dl></details>';
}
async function openDetail(id) {
  const {openCustomerDetailPage} =
    await import('./customer-detail-page.js');

  await openCustomerDetailPage({
    id,
    rpc,
    mutate,
    statuses,
    profile,
    onSaved: async (leadId, newStatus) => {
      const row = [...document.querySelectorAll(
        '.lead-row'
      )].find(x => x.querySelector(
        '[data-id]'
      )?.dataset.id === leadId);

      if (row) {
        const badge = row.querySelector('.lead-status .badge');
        if (badge) badge.textContent = newStatus;
      }

      await loadSummary();
    }
  });
}
function createForm(){showDialog(`<span class="eyebrow">THÊM KHÁCH HÀNG</span><h2>Một kết nối mới</h2><form id="create"><label>Tên khách<input name="name" maxlength="200" required></label><label>Số điện thoại<input name="phone" inputmode="tel" required></label><label>Dự án<input name="project" maxlength="200"></label><label>Nguồn<input name="source" maxlength="200"></label><label>Hẹn chăm sóc đầu tiên<input name="next" type="date"></label><button type="button" id="check-duplicate">Kiểm tra số trùng</button><p id="form-error" role="alert"></p><button class="primary">Tạo khách</button></form>`);$('check-duplicate').onclick=async()=>{try{const phone=normalizePhone($('create').elements.phone.value);const exists=await rpc('crm_duplicate',{p_phone:phone});$('form-error').textContent=exists?'Số đã có trong hệ thống. Liên hệ quản trị.':'Chưa có số này. Hệ thống sẽ kiểm tra lại khi lưu.';}catch(err){$('form-error').textContent=err.message;}};$('create').onsubmit=async ev=>{ev.preventDefault();const f=ev.currentTarget,b=f.querySelector('button');b.disabled=true;try{const d=new FormData(f);await mutate('crm_intake',{p_name:d.get('name'),p_phone:normalizePhone(d.get('phone')),p_project:d.get('project'),p_source:d.get('source'),p_next:d.get('next')||null});$('detail').close();message('Đã thêm khách vào danh sách của bạn.');loadList(true);loadSummary();}catch(err){$('form-error').textContent=err.message;}finally{b.disabled=false;}};}
async function sessionChanged(session){
 if(session?.user?.id===user?.id)return;
 epoch++;seq++;cache.clear();phoneModule?.destroyCallio();items=[];cursor=null;activeDetail=null;
 user=session?.user||null;profile=null;mode='all';query='';status='';
 if(!user){loginPage();return;}const ep=epoch;
 root.innerHTML='<main class="loading"><h1>Đang mở không gian làm việc…</h1></main>';
 try{const p=await rpc('crm_profile');if(ep!==epoch)return;if(!p)throw Error('Tài khoản chưa được cấp quyền CRM. Liên hệ quản trị viên.');profile=p;if(p.role==='EXECUTIVE'){const {executivePage}=await import('./executive.js');if(ep===epoch)await executivePage(root,p);}else shell();}
 catch(err){if(ep===epoch){root.innerHTML=`<main class="loading"><h2>Chưa thể mở CRM</h2><p>${e(err.message)}</p><button id="leave">Đăng xuất</button></main>`;$('leave').onclick=()=>supabase.auth.signOut({scope:'local'});}}
}
loginPage();
if(configured){
 supabase.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>sessionChanged(session),0);});
 window.addEventListener('focus',()=>{if(profile && profile.role==='ADMIN'){cache.clear();loadList(true);loadSummary();}});
}
import './responsive.css';
import './sales-ux-v2.js';
import './elh-mobile-hotfix-v21.js';
import './elh-sprint01.css';
import './telesales-workspace-v4.js';
// Sprint 12: magnetic controller disabled; one Kanban drag handler in Workspace V4.
