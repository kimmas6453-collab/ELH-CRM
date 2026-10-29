import './admin-console.css';
import {rpc,mutate} from './api.js';
import {escapeHtml as e} from './domain.js';

const features = [
  ['dashboard','Dashboard'],
  ['reports','Báo cáo cuộc gọi'],
  ['csv_export','Xuất CSV'],
  ['allocation','Phân bổ data'],
  ['autopilot','Autopilot']
];
const sections = [
  ['accounts','Quyền theo tài khoản'],
  ['roles','Nhóm quyền & CRUD'],
  ['allocation','Phân bổ data'],
  ['autopilot','Autopilot'],
  ['audit','Nhật ký']
];

export async function openAdminConsole(profile) {
  if (profile?.role !== 'ADMIN') throw Error('ADMIN only');
  const content = document.querySelector('.workspace > main.content');
  if (!content) throw Error('Không tìm thấy nội dung CRM');
  const existing = content.querySelector('.eh-admin-v4');
  if (existing) { existing.querySelector('.eh-admin-back')?.focus(); return; }

  const prior = [...content.children].map(el => ({el, hidden:el.hidden, display:el.style.display}));
  prior.forEach(x => { x.el.hidden = true; x.el.style.display = 'none'; });
  const scrollTop = content.scrollTop;
  const page = document.createElement('section');
  page.className = 'eh-admin-v4';
  content.append(page);
  page.innerHTML = `
    <div class="eh-admin-heading">
      <button type="button" class="eh-admin-back">← Quay lại CRM</button>
      <span class="eyebrow">ELLIE HOMES / ADMIN</span>
      <h1>Cài đặt hệ thống</h1>
      <p>Quyền tài khoản, cấu hình vận hành và lịch sử quản trị.</p>
    </div>
    <nav class="eh-admin-tabs" aria-label="Các nhóm cài đặt">
      ${sections.map(([id,label])=>`<button type="button" data-tab="${id}">${e(label)}</button>`).join('')}
    </nav>
    <div class="eh-admin-body" role="region" aria-live="polite"></div>
  `;
  const body = page.querySelector('.eh-admin-body');
  let closed = false;
  let renderVersion = 0;
  let currentTab = '';
  const close = () => {
    if (closed) return;
    closed = true;
    renderVersion++;
    page.remove();
    prior.forEach(x => { x.el.hidden = x.hidden; x.el.style.display = x.display; });
    content.scrollTop = scrollTop;
  };
  page.querySelector('.eh-admin-back').onclick = close;

  async function accountsTab(token) {
    body.innerHTML = `<section class="eh-admin-card">
      <h2>Phân quyền theo tài khoản</h2>
      <p class="eh-admin-muted">Các quyền module dưới đây được lưu bằng RPC hiện có. Quyền truy cập dữ liệu vẫn phụ thuộc RLS và các kiểm tra backend.</p>
      <label class="eh-admin-field">Tài khoản<select class="eh-admin-user"></select></label>
      <div class="eh-admin-flags"></div>
      <div class="eh-admin-actions"><button type="button" class="eh-admin-save" disabled>Lưu phân quyền</button><span class="eh-admin-status" role="status"></span></div>
    </section>`;
    const select = body.querySelector('.eh-admin-user');
    const flags = body.querySelector('.eh-admin-flags');
    const save = body.querySelector('.eh-admin-save');
    const status = body.querySelector('.eh-admin-status');
    const users = await rpc('crm_permission_users');
    if (closed || token !== renderVersion) return;
    const safeUsers = Array.isArray(users) ? users : [];
    select.innerHTML = safeUsers.map(u=>`<option value="${e(u.id)}">${e(u.name||u.email||u.id)} · ${e(u.role)}</option>`).join('');
    if (!safeUsers.length) { flags.textContent = 'Không có tài khoản để hiển thị.'; return; }
    let loadVersion = 0, baseline = '';
    const selectedUser = () => safeUsers.find(u => u.id === select.value);
    const values = () => Object.fromEntries([...flags.querySelectorAll('[data-permission]')].map(x=>[x.dataset.permission, x.checked]));
    const sync = () => {
      const u = selectedUser();
      save.disabled = !u || u.role === 'ADMIN' || JSON.stringify(values()) === baseline;
    };
    async function loadPermissions() {
      const version = ++loadVersion;
      const user = selectedUser();
      if (!user) return;
      save.disabled = true;
      flags.textContent = 'Đang tải quyền...';
      status.textContent = '';
      const p = await rpc('crm_permission_get',{p_user:user.id});
      if (closed || token !== renderVersion || version !== loadVersion) return;
      flags.innerHTML = features.map(([key,label])=>`<label class="eh-admin-flag">
        <input type="checkbox" data-permission="${key}" ${p?.[key]?'checked':''} ${user.role==='ADMIN'?'disabled':''}>
        <span>${e(label)}</span>
      </label>`).join('');
      baseline = JSON.stringify(values());
      flags.onchange=sync;
      sync();
      if(user.role==='ADMIN') status.textContent='Quyền tài khoản ADMIN không thể sửa tại đây.';
    }
    select.onchange = () => loadPermissions().catch(err=>{ flags.textContent = ''; status.textContent = err.message; });
    save.onclick = async () => {
      const user = selectedUser();
      if (!user || user.role==='ADMIN' || save.disabled) return;
      if (!window.confirm(`Xác nhận cập nhật quyền cho ${user.name || user.email || user.id}?`)) return;
      save.disabled = true;
      status.textContent = 'Đang lưu...';
      try {
        const permissionSet = values();
        await mutate('crm_permission_save',{p_user:user.id,p_permissions:permissionSet});
        baseline = JSON.stringify(permissionSet);
        status.textContent = 'Đã lưu. Kiểm tra lại bằng tài khoản đích trước khi sử dụng.';
      } catch(err) { status.textContent=err.message; }
      finally { sync(); }
    };
    await loadPermissions();
  }

  function rolesTab() {
    // Do not present an unenforced role matrix as effective permissions.
    body.innerHTML = `<section class="eh-admin-card">
      <h2>Nhóm quyền & CRUD</h2>
      <p class="eh-admin-muted">Hiện source chưa có API quản trị CRUD theo nhóm và cơ chế enforcement tương ứng. Đây là danh mục chuẩn bị triển khai, KHÔNG phải quyền có hiệu lực.</p>
      <div class="eh-admin-scroll"><table class="eh-admin-table"><thead><tr><th>Module</th><th>Create</th><th>Read</th><th>Update</th><th>Delete</th></tr></thead><tbody>
        ${[['customers','Khách hàng'],['schedule','Lịch chăm sóc'],...features].map(([,label])=>`<tr><td>${e(label)}</td>${[1,2,3,4].map(()=>'<td>—</td>').join('')}</tr>`).join('')}
      </tbody></table></div>
      <p class="eh-admin-warning">Không cấp quyền dựa trên bảng này. Phải có migration, RPC kiểm tra quyền hiệu lực và RLS tương ứng trước khi bật chức năng lưu nhóm.</p>
    </section>`;
  }

  function allocationTab() {
    body.innerHTML = `<section class="eh-admin-card">
      <h2>Cấu hình phân bổ data</h2>
      <p>Giữ nguyên cơ chế phân bổ đang dùng trong Quản lý đội ngũ: xem trước và xác nhận trước khi giao.</p>
      <p class="eh-admin-muted">Các nhóm Quality, Matching, SLA, Ownership và Recycle đang là danh mục nghiệp vụ; không tự kích hoạt worker.</p>
      <button type="button" class="eh-admin-secondary" id="eh-admin-team">Mở Quản lý đội ngũ</button>
    </section>`;
    body.querySelector('#eh-admin-team').onclick = () => {
      const trigger = document.querySelector('#team');
      if (!trigger) { body.querySelector('#eh-admin-team').after(document.createTextNode(' Không tìm thấy Quản lý đội ngũ.')); return; }
      trigger.click();
    };
  }

  function autopilotTab() {
    body.innerHTML = `<section class="eh-admin-card">
      <h2>Autopilot</h2><p>Trạng thái vận hành không được thay đổi qua trang này.</p>
      <p class="eh-admin-warning">Không tự động bật phân bổ, thu hồi khách hay cron. Cần preflight riêng trước khi kích hoạt tác vụ ghi dữ liệu.</p>
    </section>`;
  }

  async function auditTab(token) {
    body.innerHTML = `<section class="eh-admin-card">
      <h2>Nhật ký quản trị</h2><div class="eh-admin-audit"></div>
      <div class="eh-admin-actions"><button type="button" class="eh-admin-secondary eh-audit-prev">Trang trước</button><button type="button" class="eh-admin-secondary eh-audit-next">Trang sau</button></div>
    </section>`;
    const list = body.querySelector('.eh-admin-audit');
    const prev = body.querySelector('.eh-audit-prev');
    const next = body.querySelector('.eh-audit-next');
    let offset=0, request=0;
    async function load() {
      const index=++request;
      list.textContent='Đang tải nhật ký...';
      const data=await rpc('crm_admin_history',{p_offset:offset});
      if(closed||token!==renderVersion||index!==request)return;
      const rows=Array.isArray(data)?data:[];
      list.innerHTML=rows.map(x=>`<article class="eh-admin-log">
        <strong>${e(x.kind)}</strong><div>${e(x.actor||'')}</div>
        <small>${e(x.created_at?new Date(x.created_at).toLocaleString('vi-VN'):'')}</small>
        ${x.target?`<div>${e(x.target)}</div>`:''}
      </article>`).join('')||'<p>Chưa có nhật ký.</p>';
      prev.disabled=offset===0;
      next.disabled=rows.length<50;
    }
    prev.onclick=()=>{offset=Math.max(0,offset-50);load().catch(err=>list.textContent=err.message);};
    next.onclick=()=>{offset+=50;load().catch(err=>list.textContent=err.message);};
    await load();
  }

  const renderers={accounts:accountsTab,roles:rolesTab,allocation:allocationTab,autopilot:autopilotTab,audit:auditTab};
  async function switchTab(tab) {
    if(closed||!renderers[tab])return;
    currentTab=tab;
    const token=++renderVersion;
    page.querySelectorAll('[data-tab]').forEach(el=>{
      const active=el.dataset.tab===tab;
      el.classList.toggle('active',active);
      el.setAttribute('aria-selected',String(active));
    });
    body.textContent='Đang tải...';
    try { await renderers[tab](token); }
    catch(err) { if(!closed&&token===renderVersion)body.textContent=err.message; }
  }
  page.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>switchTab(el.dataset.tab));
  await switchTab('accounts');
}
