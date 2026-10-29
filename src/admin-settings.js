import {rpc} from './api.js';
import {escapeHtml as e} from './domain.js';

const features = [
  ['dashboard', 'Dashboard'],
  ['reports', 'Báo cáo cuộc gọi'],
  ['csv_export', 'Xuất CSV'],
  ['allocation', 'Quản lý phân bổ data'],
  ['autopilot', 'Cấu hình Autopilot']
];

export async function openAdminSettings(profile) {
  if(profile?.role !== 'ADMIN') {
    throw Error('ADMIN only');
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'report-dialog';
  dialog.setAttribute('aria-label', 'Cài đặt hệ thống');

  dialog.innerHTML = `
    <button class="close" aria-label="Đóng">×</button>
    <span class="eyebrow">ELLIE HOMES / ADMIN</span>
    <h2>Cài đặt hệ thống</h2>
    <p>Phân quyền tài khoản & cấu hình phân bổ data</p>

    <h3>Phân quyền tài khoản</h3>
    <label>Chọn tài khoản
      <select id="permission-user"></select>
    </label>
    <section id="permission-options"></section>
    <button id="permission-save" class="primary">
      Lưu phân quyền
    </button>

    <h3>Cấu hình phân bổ data</h3>
    <p>Quản lý chính sách phân bổ trong mục
    Quản lý đội ngũ. Autopilot chưa được kích hoạt
    bởi trang cấu hình này.</p>

    <p id="permission-message" role="status"></p>
  `;

  document.body.append(dialog);
  dialog.showModal();

  dialog.querySelector('.close').onclick=()=>dialog.close();
  dialog.onclose=()=>dialog.remove();

  const select=dialog.querySelector('#permission-user');
  const options=dialog.querySelector('#permission-options');
  const status=dialog.querySelector('#permission-message');

  const users=await rpc('crm_permission_users');

  select.innerHTML=users.map(u=>
    `<option value="${e(u.id)}">
      ${e(u.name)} (${e(u.role)})
    </option>`
  ).join('');

  async function load() {
    const user=users.find(u=>u.id===select.value);
    if(!user) return;

    const p=await rpc('crm_permission_get',{
      p_user:user.id
    });

    options.innerHTML=features.map(([key,label])=>{
      const locked=user.role==='ADMIN';
      return `<label style="display:flex;gap:12px;margin:12px 0">
        <input type="checkbox" data-permission="${key}"
          ${p[key]?'checked':''}
          ${locked?'disabled':''}>
        ${e(label)}
      </label>`;
    }).join('');
  }

  select.onchange=()=>load().catch(err=>{
    status.textContent=err.message;
  });

  dialog.querySelector('#permission-save').onclick=async()=>{
    const user=users.find(u=>u.id===select.value);
    if(!user || user.role==='ADMIN') return;

    const permissions={};
    options.querySelectorAll('[data-permission]').forEach(x=>{
      permissions[x.dataset.permission]=x.checked;
    });

    try {
      await rpc('crm_permission_save',{
        p_user:user.id,
        p_permissions:permissions
      });
      status.textContent='Đã lưu cấu hình tài khoản.';
    } catch(err) {
      status.textContent=err.message;
    }
  };

  await load();
}