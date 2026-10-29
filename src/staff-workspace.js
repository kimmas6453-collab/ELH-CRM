export function setupStaffWorkspace({
  root, onFilter, onSort, onProject
}) {
  if (!root) return;

  // One main navigation: Data của tôi
  root.querySelectorAll(
    '.sidebar [data-mode],.mobile-nav [data-mode]'
  ).forEach(btn => {
    if (btn.dataset.mode === 'all') {
      btn.textContent = 'Data của tôi';
    } else {
      btn.remove();
    }
  });

  for (const id of [
    'dashboard','reports','mobile-dashboard',
    'mobile-reports','team','mobile-team'
  ]) {
    root.querySelector('#'+id)?.remove();
  }

  const toolbar=root.querySelector('.toolbar');
  if (!toolbar) return;

  const panel=document.createElement('div');
  panel.className='staff-workspace-controls';
  panel.innerHTML=`
    <div class="staff-workspace-chips">
      <button data-quick="all" class="active">Tất cả</button>
      <button data-quick="urgent">Cần xử lý</button>
      <button data-quick="new">Chưa liên hệ</button>
      <button data-quick="no_answer">Không nghe máy</button>
      <button data-quick="interested">Có nhu cầu</button>
      <button data-quick="appointment">Hẹn gặp</button>
    </div>
    <div class="staff-workspace-fields">
      <label>Dự án
        <input class="staff-project"
          maxlength="200" placeholder="Tất cả dự án">
      </label>
      <label>Sắp xếp
        <select class="staff-sort">
          <option value="priority">Ưu tiên xử lý</option>
          <option value="newest">Data mới nhất</option>
          <option value="oldest">Data cũ nhất</option>
          <option value="followup">Lịch hẹn gần nhất</option>
        </select>
      </label>
    </div>
  `;

  toolbar.after(panel);

  panel.querySelectorAll('[data-quick]').forEach(btn=>{
    btn.onclick=()=>{
      panel.querySelectorAll('[data-quick]')
        .forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      onFilter(btn.dataset.quick);
    };
  });

  panel.querySelector('.staff-sort').onchange=ev=>{
    onSort(ev.target.value);
  };

  let timer;
  panel.querySelector('.staff-project').oninput=ev=>{
    clearTimeout(timer);
    timer=setTimeout(()=>onProject(ev.target.value.trim()),300);
  };

  const style=document.createElement('style');
  style.textContent=`
    .staff-workspace-controls {
      margin:14px 0 20px;
      display:grid;gap:14px;
    }
    .staff-workspace-chips {
      display:flex;gap:8px;
      overflow-x:auto;padding:4px 0;
    }
    .staff-workspace-chips button {
      flex:0 0 auto;
      border:1px solid #dce4ec;
      background:white;
      padding:10px 14px;
      border-radius:22px;
      cursor:pointer;
    }
    .staff-workspace-chips button.active {
      background:#102a40;
      color:white;
      border-color:#102a40;
    }
    .staff-workspace-fields {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
    }
    .staff-workspace-fields label {
      display:grid;gap:6px;
    }
    .staff-workspace-fields input,
    .staff-workspace-fields select {
      min-width:0;width:100%;
      box-sizing:border-box;
      border:1px solid #dce4ec;
      padding:11px;border-radius:9px;
    }
    .customer-detail-tabs {
      display:flex;gap:8px;
      margin:16px 0;
      border-bottom:1px solid #e5eaf0;
      padding-bottom:10px;
    }
    .customer-detail-tabs button {
      padding:10px 16px;
      border:1px solid #dce4ec;
      border-radius:8px;
      background:white;
    }
    .customer-detail-tabs button.active {
      background:#102a40;color:white;
    }
    @media(max-width:767px) {
      .staff-workspace-fields {
        grid-template-columns:1fr;
      }
    }
  `;
  document.head.append(style);
}

export function decorateCustomerDetail(dialog) {
  if (!dialog || dialog.querySelector('.customer-detail-tabs')) return;

  const form=dialog.querySelector('#update');
  const history=dialog.querySelector('.history');
  if (!form || !history) return;

  const tabs=document.createElement('nav');
  tabs.className='customer-detail-tabs';
  tabs.innerHTML=`
    <button data-detail-tab="current" class="active">
      Hiện tại
    </button>
    <button data-detail-tab="history">
      Lịch sử tương tác
    </button>
  `;

  form.before(tabs);

  const historyTitle=Array.from(
    dialog.querySelectorAll('h3')
  ).find(x=>x.textContent.includes('Lịch sử'));

  const more=dialog.querySelector('#history-more');
  const currentParts=[form];
  const source=dialog.querySelector('.source-details');
  if(source)currentParts.push(source);

  function selectTab(name) {
    tabs.querySelectorAll('button').forEach(b=>
      b.classList.toggle('active',b.dataset.detailTab===name)
    );

    currentParts.forEach(x=>x.hidden=name!=='current');
    if(historyTitle)historyTitle.hidden=name!=='history';
    history.hidden=name!=='history';
    if(more)more.hidden=name!=='history' || more.dataset.noMore==='true';
  }

  if(more && more.hidden)more.dataset.noMore='true';

  tabs.querySelectorAll('button').forEach(button=>{
    button.onclick=()=>selectTab(button.dataset.detailTab);
  });

  selectTab('current');
}