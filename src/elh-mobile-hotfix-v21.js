import './elh-mobile-hotfix-v21.css';

const isMobile = () =>
  window.matchMedia('(max-width:767px)').matches;

function enhanceWorkspace() {
  const root = document.querySelector('.workspace');
  if (!root) return;

  const header = root.querySelector('main.content > header');

  if (header && !header.querySelector('.eh21-mobile-toolbar')) {
    const bar = document.createElement('div');
    bar.className = 'eh21-mobile-toolbar';

    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'eh21-menu-button';
    menu.setAttribute('aria-label','Open navigation');
    menu.setAttribute('aria-expanded','false');
    menu.textContent = '\u2630';

    const title = document.createElement('strong');
    title.textContent = 'Ellie Homes CRM';

    const actions = document.createElement('button');
    actions.type = 'button';
    actions.className = 'eh21-actions-button';
    actions.setAttribute('aria-label','More actions');
    actions.setAttribute('aria-expanded','false');
    actions.textContent = '\u22ef';

    bar.append(menu,title,actions);
    header.prepend(bar);

    const backdrop = document.createElement('div');
    backdrop.className = 'eh21-backdrop';
    backdrop.hidden = true;
    root.append(backdrop);

    const closeMenu = () => {
      root.classList.remove('eh21-menu-open');
      backdrop.hidden = true;
      menu.setAttribute('aria-expanded','false');
    };

    menu.onclick = () => {
      const open = root.classList.toggle('eh21-menu-open');
      backdrop.hidden = !open;
      menu.setAttribute('aria-expanded',String(open));
    };

    backdrop.onclick = closeMenu;

    const sidebar = root.querySelector('.sidebar');
    sidebar?.addEventListener('click', event => {
      if (event.target.closest('button,a')) {
        closeMenu();
      }
    });

    actions.onclick = () => {
      const open = root.classList.toggle('eh21-actions-open');
      actions.setAttribute('aria-expanded',String(open));
    };
  }

  // Make detail action available on desktop.
  root.querySelectorAll('.lead-row').forEach(row => {
    const detail = row.querySelector(
      'button[data-action="detail"]'
    );

    const cell = row.querySelector('.lead-actions');

    if (!detail || !cell) return;
    if (cell.querySelector('.eh-ux-eye,.eh21-eye,.eh3-view')) return;

    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'eh21-eye';
    eye.dataset.action = 'detail';
    eye.dataset.id = detail.dataset.id;

    eye.setAttribute('aria-label','View customer');
    eye.title = 'View customer';

    eye.innerHTML = `
      <svg viewBox="0 0 24 24" width="19"
        height="19" fill="none"
        stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `;

    cell.prepend(eye);
  });
}

// Staff card taps are handled by the existing Sales UX V2.
// Add the same behavior for ADMIN mobile only.
document.addEventListener('click', event => {
  if (!isMobile()) return;

  const row = event.target.closest?.('.lead-row');
  if (!row) return;

  if (event.target.closest(
    'button,a,input,select,textarea,label'
  )) return;

  const root = row.closest('.workspace');

  // Avoid double navigation with the installed staff handler.
  if (root?.classList.contains('eh-ux-staff')) return;

  const detail = row.querySelector(
    'button[data-action="detail"]'
  );

  detail?.click();
}, true);

document.addEventListener('keydown', event => {
  if (!isMobile()) return;
  if (!['Enter',' '].includes(event.key)) return;

  const row = event.target.closest?.('.lead-row');
  if (!row || event.target !== row) return;

  event.preventDefault();
  row.querySelector('button[data-action="detail"]')?.click();
});

function start() {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded',start,{once:true});
    return;
  }

  let queued = false;

  const schedule = () => {
    if (queued) return;
    queued = true;

    queueMicrotask(() => {
      queued = false;
      enhanceWorkspace();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body,{
    childList:true,
    subtree:true
  });

  schedule();
}

start();