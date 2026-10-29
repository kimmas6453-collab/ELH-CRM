import {supabase,cache} from './api.js';
import {escapeHtml as e} from './domain.js';
export function accountForm(container,onChanged){
 container.innerHTML='<details><summary>Tạo tài khoản mới</summary><form class="account-create"><label>Họ tên<input name="name" maxlength="200" required></label><label>Email đăng nhập<input name="email" type="email" required></label><label>Vai trò<select name="role"><option value="TELESALES">Nhân viên — chỉ dữ liệu được giao</option><option value="EXECUTIVE">Điều hành — chỉ số liệu tổng hợp</option></select></label><button class="primary">Tạo tài khoản</button></form></details><div class="account-result" role="status"></div>';
 const form=container.querySelector('form'),result=container.querySelector('.account-result');
 form.onsubmit=async ev=>{ev.preventDefault();const button=form.querySelector('button');button.disabled=true;result.textContent='Đang tạo…';try{const values=Object.fromEntries(new FormData(form));const data=await accountAction({action:'create',...values});showCredential(result,data);form.reset();cache.clear();await onChanged();}catch(err){result.textContent=err.message;}finally{button.disabled=false;}};
}
async function accountAction(body){
 const {data,error}=await supabase.functions.invoke('crm-accounts',{body});if(error){let message='Không thực hiện được thao tác tài khoản.';try{message=(await error.context.json()).error||message;}catch{}throw Error(message);}return data;
}
function showCredential(container,data){
 container.innerHTML=`<p>Tài khoản: <strong>${e(data.email)}</strong>. Mật khẩu mới chỉ hiện trong lần này; chuyển riêng cho đúng nhân viên.</p><label>Mật khẩu<input type="password" readonly autocomplete="off" value="${e(data.password)}"></label><button type="button">Hiện / ẩn mật khẩu</button>`;
 container.querySelector('button').onclick=()=>{const input=container.querySelector('input');input.type=input.type==='password'?'text':'password';};
}
export function resetAccount(person,parent){
 const old=parent.querySelector('.reset-confirm');old?.remove();const box=document.createElement('section');box.className='reset-confirm';
 box.innerHTML=`<h3>Đặt lại mật khẩu</h3><p>Tạo mật khẩu mới cho ${e(person.email)}. Mật khẩu cũ sẽ không đăng nhập được nữa.</p><button class="primary">Xác nhận đặt lại</button><button class="cancel-reset">Hủy</button><div role="status"></div>`;parent.append(box);box.scrollIntoView({block:'nearest'});box.querySelector('.cancel-reset').onclick=()=>box.remove();
 box.querySelector('.primary').onclick=async ev=>{const button=ev.currentTarget;button.disabled=true;const result=box.querySelector('[role=status]');try{showCredential(result,await accountAction({action:'reset',id:person.id}));button.remove();}catch(err){result.textContent=err.message;button.disabled=false;}};
}

export function bulkAccounts(container,onChanged){
 const section=document.createElement('details');section.innerHTML='<summary>Tạo nhiều tài khoản từ CSV</summary><p>Tối đa 20 người/lần. Cột: name,email,role. Vai trò TELESALES hoặc EXECUTIVE. Tài khoản trùng sẽ báo lỗi, không đặt lại mật khẩu.</p><form><label>Danh sách CSV<textarea name="csv" rows="6" maxlength="20000" required placeholder="name,email,role"></textarea></label><button>Xem trước tài khoản</button></form><div class="bulk-account-preview"></div><div class="bulk-account-results"></div>';container.append(section);
 const form=section.querySelector('form'),preview=section.querySelector('.bulk-account-preview'),results=section.querySelector('.bulk-account-results');
 form.oninput=()=>preview.replaceChildren();
 form.onsubmit=async ev=>{ev.preventDefault();try{const {csvParse}=await import('./csv.js');const rows=csvParse(form.elements.csv.value).map(x=>({name:String(x.name||'').trim(),email:String(x.email||'').trim().toLowerCase(),role:String(x.role||'').trim()}));
 if(!rows.length||rows.length>20)throw Error('Nhập từ 1 đến 20 tài khoản.');const seen=new Set();for(const r of rows){if(!r.name||r.name.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)||!['TELESALES','EXECUTIVE'].includes(r.role))throw Error('Kiểm tra họ tên, email và vai trò của từng dòng.');if(seen.has(r.email))throw Error('Email lặp trong danh sách.');seen.add(r.email);}
 preview.innerHTML='<ul>'+rows.map(r=>`<li>${e(r.name)} · ${e(r.email)} · ${e(r.role)}</li>`).join('')+'</ul><button class="primary">Xác nhận tạo tài khoản</button><p>Mật khẩu từng người chỉ hiển thị trong phiên này. Chuyển riêng cho đúng người trước khi đóng cửa sổ.</p>';
 preview.querySelector('button').onclick=async ev=>{ev.currentTarget.disabled=true;form.querySelectorAll('textarea,button').forEach(x=>x.disabled=true);for(const r of rows){if(!section.isConnected)break;const line=document.createElement('section');results.append(line);line.textContent='Đang tạo '+r.email;try{showCredential(line,await accountAction({action:'create',...r}));}catch(err){line.textContent=r.email+': '+err.message;}}cache.clear();await onChanged();preview.replaceChildren();form.querySelectorAll('textarea,button').forEach(x=>x.disabled=false);};
 }catch(err){preview.textContent=err.message;}};
}
