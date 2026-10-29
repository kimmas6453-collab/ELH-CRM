import {allocationJobs} from './allocation-jobs.js';
import {healthPanel} from './health.js';
import {reviewRequests} from './callio-requests.js';
import {operations} from './operations.js';
import {accountForm,resetAccount,bulkAccounts} from './accounts.js';
import {rpc,supabase,cache} from './api.js';
import {escapeHtml as e} from './domain.js';
import {showCallioMapping} from './callio-mapping.js';
export async function openTeam(profile){
 const dialog=document.createElement('dialog');dialog.className='report-dialog';dialog.setAttribute('aria-label','Quản lý đội ngũ');
 dialog.innerHTML='<button class="close" aria-label="Đóng quản lý">×</button><span class="eyebrow">ELLIE HOMES / QUẢN TRỊ</span><h2>Đội ngũ & kết nối</h2><button id="open-import">Nhập khách hàng CSV</button><p class="team-status" role="status"></p><section class="accounts-panel"></section><div class="team-body"></div><section class="health-panel"></section><section class="jobs-panel"></section><section class="operations-panel"></section><section class="requests-panel"></section><section class="mapping-panel"></section>';
 document.body.append(dialog);dialog.showModal();dialog.querySelector('.close').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
 const listener=supabase.auth.onAuthStateChange((_event,s)=>{if(s?.user.id!==profile.id)dialog.close();});dialog.addEventListener('close',()=>listener.data.subscription.unsubscribe());
 dialog.querySelector('#open-import').onclick=async()=>{const {openImport}=await import('./import-pool.js');await openImport(profile);};
 const status=dialog.querySelector('.team-status');
 const load=async()=>{status.textContent='Đang tải đội ngũ…';try{const d=await rpc('crm_team');if(!dialog.isConnected)return;
 dialog.querySelector('.team-body').innerHTML=`<section class="metrics">${[['Tài khoản',d.members.length],['Kho khách',d.pool],['Số cần kiểm tra',d.invalid_phones],['Cuộc gọi chưa ghép',d.unmapped_calls]].map(([k,v])=>`<article><span>${e(k)}</span><strong>${Number(v).toLocaleString('vi-VN')}</strong></article>`).join('')}</section><p>Đồng bộ Callio gần nhất: <strong>${d.sync?.last_success?e(new Date(d.sync.last_success).toLocaleString('vi-VN')):'Chưa có'}</strong> · ${e(d.sync?.detail||'Chưa cấu hình')}</p><div class="table-scroll"><table class="team-table"><thead><tr><th>NHÂN VIÊN</th><th>QUYỀN</th><th>ĐƯỢC GIAO</th><th>CHƯA GỌI</th><th>QUÁ HẸN</th><th>BOOKING</th><th>TÀI KHOẢN</th></tr></thead><tbody>${d.members.map(p=>`<tr><td>${e(p.name)}<small>${e(p.email)}</small></td><td>${e(p.role)}</td><td>${p.assigned}</td><td>${p.pending}</td><td>${p.overdue}</td><td>${p.booking}</td><td>${p.role==='ADMIN'?'Quản trị':`<button data-member="${e(p.id)}" data-active="${!p.active}">${p.active?'Khóa tài khoản':'Mở tài khoản'}</button><button data-reset="${e(p.id)}">Đặt lại mật khẩu</button>`}</td></tr>`).join('')}</tbody></table></div>`;
 dialog.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>resetAccount(d.members.find(p=>p.id===b.dataset.reset),dialog.querySelector('.accounts-panel')));
 allocationJobs(dialog.querySelector('.jobs-panel'),d.members);operations(dialog.querySelector('.operations-panel'),d.members,load);
 status.textContent='Khóa tài khoản sẽ chặn truy cập dữ liệu ngay, giữ nguyên khách và lịch sử.';
 dialog.querySelectorAll('[data-member]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await rpc('crm_set_active',{p_id:b.dataset.member,p_active:b.dataset.active==='true'});cache.clear();await load();}catch(err){status.textContent=err.message;b.disabled=false;}});
 }catch(err){status.textContent=err.message;}};
 healthPanel(dialog.querySelector('.health-panel'));accountForm(dialog.querySelector('.accounts-panel'),load);bulkAccounts(dialog.querySelector('.accounts-panel'),load);await load();try{await reviewRequests(dialog.querySelector('.requests-panel'));await showCallioMapping(dialog.querySelector('.mapping-panel'));}catch(err){status.textContent=err.message;}
}
