import './sales-ux-v2.css';

const LABEL = {
  view: 'Xem h\u1ed3 s\u01a1',
  call: 'G\u1ecdi Callio',
  mine: 'Data c\u1ee7a t\u00f4i',
  save: 'L\u01b0u c\u1eadp nh\u1eadt',
  back: 'Quay l\u1ea1i',
  calling: '\u0110ang g\u1eedi y\u00eau c\u1ea7u g\u1ecdi...',
  callSent: 'Y\u00eau c\u1ea7u Callio \u0111\u00e3 \u0111\u01b0\u1ee3c g\u1eedi.'
};

const $ = (selector, scope = document) =>
  scope.querySelector(selector);

const mobile = () =>
  window.matchMedia('(max-width: 767px)').matches;

function staffWorkspace(root) {
  return root &&
    !root.querySelector('#admin-settings');
}

function eyeSvg() {
  return `
    <svg width="18" height="18"
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `;
}

function ensureEyeButtons(root) {
  root.querySelectorAll('.lead-row').forEach(row => {
    const detail = $(
      'button[data-action="detail"]', row
    );

    const actions = $('.lead-actions', row);

    if (!detail || !actions) return;
    if ($('.eh-ux-eye,.eh21-eye,.eh3-view', actions)) return;

    const eye = document.createElement('button');

    eye.type = 'button';
    eye.className = 'eh-ux-eye';
    eye.dataset.action = 'detail';
    eye.dataset.id = detail.dataset.id;

    eye.setAttribute('aria-label', LABEL.view);
    eye.title = LABEL.view;
    eye.innerHTML = eyeSvg();

    // Existing #rows click handler handles data-action=detail.
    actions.prepend(eye);

    if (staffWorkspace(root)) {
      row.tabIndex = 0;
      row.setAttribute('aria-label',
        `${LABEL.view}: ${detail.textContent.trim()}`
      );
    }
  });
}

function adaptStaffNavigation(root) {
  if (!staffWorkspace(root)) return;

  root.classList.add('eh-ux-staff');

  root.querySelectorAll('[data-mode="all"]')
    .forEach(button => {
      if (button.dataset.ehUxLabel === '1') return;

      button.dataset.ehUxLabel = '1';
      button.textContent = LABEL.mine;
    });
}

function customerIdFromLocation() {
  const state = window.history.state || {};

  if (state.elhDetailId) return state.elhDetailId;
  if (state.ehCustomerDetail) return state.ehCustomerDetail;

  const match = window.location.hash.match(
    /^#khach-hang\/(.+)$/
  );

  if (!match) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function formSnapshot(form) {
  return JSON.stringify(
    Array.from(new FormData(form).entries())
  );
}

function installDetailActions(root) {
  const page = root.querySelector(
    '.eh4-page, .eh-v3-page, .eh-vn-detail-page'
  );

  if (!page) return;
  if ($('.eh-ux-mobile-footer', page)) return;

  const form = page.querySelector('form');
  const originalSave = form?.querySelector(
    'button[type="submit"]'
  );

  if (!form || !originalSave) return;

  const footer = document.createElement('div');
  footer.className = 'eh-ux-mobile-footer';

  const call = document.createElement('button');
  call.type = 'button';
  call.className = 'eh-ux-mobile-call';
  call.textContent = LABEL.call;

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'eh-ux-mobile-save';
  save.textContent = LABEL.save;

  const message = document.createElement('span');
  message.className = 'eh-ux-mobile-message';
  message.setAttribute('role', 'status');

  footer.append(call, save, message);
  page.append(footer);

  let baseline = formSnapshot(form);

  const sync = () => {
    save.disabled =
      originalSave.disabled ||
      formSnapshot(form) === baseline;
  };

  form.addEventListener('input', sync);
  form.addEventListener('change', sync);

  // Mobile Save invokes the existing CRM form submission.
  save.onclick = () => {
    if (save.disabled || originalSave.disabled) return;

    if (!form.reportValidity()) return;

    form.requestSubmit(originalSave);
  };

  // Reuse the existing Callio integration.
  call.onclick = async () => {
    const id = customerIdFromLocation();

    if (!id) {
      message.textContent =
        'Customer identifier unavailable';
      return;
    }

    call.disabled = true;
    message.textContent = LABEL.calling;

    try {
      const callio = await import('./callio.js');

      if (typeof callio.callLead !== 'function') {
        throw Error('Callio callLead unavailable');
      }

      const result = await callio.callLead(id);

      message.textContent =
        typeof result === 'string' && result
          ? result
          : LABEL.callSent;

    } catch (err) {
      message.textContent =
        err?.message || 'Callio request failed';
    } finally {
      call.disabled = false;
    }
  };

  const resultMessage = page.querySelector(
    '.eh4-message, .eh-v3-message, #eh-vn-message'
  );

  if (resultMessage) {
    const observer = new MutationObserver(() => {
      const text = resultMessage.textContent || '';

      // Refresh baseline only after confirmed save success.
      if (text.startsWith('\u0110\u00e3 l\u01b0u')) {
        baseline = formSnapshot(form);
      }

      sync();
    });

    observer.observe(resultMessage, {
      childList: true,
      characterData: true,
      subtree: true
    });

    // Release observer when page leaves the DOM.
    const cleanup = new MutationObserver(() => {
      if (!page.isConnected) {
        observer.disconnect();
        cleanup.disconnect();
      }
    });

    cleanup.observe(root, {
      childList: true,
      subtree: true
    });
  }

  const disabledObserver = new MutationObserver(sync);

  disabledObserver.observe(originalSave, {
    attributes: true,
    attributeFilter: ['disabled']
  });

  sync();
}

function reconcile() {
  const root = $('.workspace');

  if (!root) return;

  adaptStaffNavigation(root);
  ensureEyeButtons(root);
  installDetailActions(root);
}

// Desktop eye is delegated to existing list behavior.
// Mobile cards open details, while Callio remains independent.
document.addEventListener('click', event => {
  if (!mobile()) return;

  const row = event.target.closest?.(
    '.eh-ux-staff .lead-row'
  );

  if (!row) return;

  if (event.target.closest(
    'button,a,input,select,textarea,label'
  )) return;

  const detail = row.querySelector(
    'button[data-action="detail"]'
  );

  detail?.click();
}, true);

document.addEventListener('keydown', event => {
  if (!mobile()) return;

  if (event.key !== 'Enter' &&
      event.key !== ' ') return;

  const row = event.target.closest?.(
    '.eh-ux-staff .lead-row'
  );

  if (!row || event.target !== row) return;

  event.preventDefault();

  row.querySelector(
    'button[data-action="detail"]'
  )?.click();
});

function start() {
  if (!document.body) {
    document.addEventListener(
      'DOMContentLoaded', start, {once:true}
    );
    return;
  }

  let scheduled = false;

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;

    queueMicrotask(() => {
      scheduled = false;
      reconcile();
    });
  };

  const observer = new MutationObserver(schedule);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  schedule();
}

start();