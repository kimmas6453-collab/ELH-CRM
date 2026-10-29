import {supabase,rpc} from './api.js';
import {escapeHtml as e} from './domain.js';
export async function showCallioMapping(container){
 const [{data:accounts,error:ae},{data:staff,error:se}]=await Promise.all([supabase.from('callio_accounts').select('id,email,name,extension,profile_id').order('extension'),supabase.from('profiles').select('id,name,email').eq('role','TELESALES').eq('active',true).order('email')]);
 if(ae||se)throw ae||se;
 container.innerHTML=`<h3>Ghép tài khoản nhân viên</h3><p>Chọn đúng tài khoản CRM của từng người. Lịch sử chưa ghép chỉ xuất hiện trong báo cáo quản lý.</p>${accounts.map(a=>`<form class="mapping-row" data-callio="${e(a.id)}"><label>${e(a.name)} · ${e(a.extension)}<small>${e(a.email)}</small><select name="profile" aria-label="Tài khoản CRM cho ${e(a.name)}"><option value="">Chưa ghép</option>${staff.map(s=>`<option value="${e(s.id)}" ${s.id===a.profile_id?'selected':''}>${e(s.name)} · ${e(s.email.split('@')[0])}</option>`).join('')}</select></label><button>Lưu ghép</button><p class="mapping-result" role="status"></p></form>`).join('')}`;
 container.querySelectorAll('form').forEach(form=>form.onsubmit=async ev=>{ev.preventDefault();const btn=form.querySelector('button'),msg=form.querySelector('.mapping-result');btn.disabled=true;try{const r=await rpc('crm_link_callio',{p_callio_id:form.dataset.callio,p_profile_id:form.elements.profile.value||null});msg.textContent=`Đã cập nhật quyền xem ${r.updated} cuộc gọi.`;}catch(err){msg.textContent=err.message;}finally{btn.disabled=false;}});
}
