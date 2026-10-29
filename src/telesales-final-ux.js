import './telesales-final-ux.css';
import {rpc,mutate} from './api.js';
import {statuses} from './domain.js';

const mobile = () =>
  window.matchMedia('(max-width:767px)').matches;

const TEXT = {
  mine:'Data c\u1ee7a t\u00f4i',
  notification:'Th\u00f4ng b\u00e1o',
  refresh:'L\u00e0m m\u1edbi',
  booking:'Booking',
  noFit:'Kh\u00f4ng ph\u00f9 h\u1ee3p',
  change:'\u0110\u1ed5i tr\u1ea1ng th\u00e1i',
  cancel:'H\u1ee7y',
  confirm:'X\u00e1c nh\u1eadn',
  updated:'\u0110\u00e3 c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i.',
  changed:'Kh\u00e1ch \u0111\u00e3 \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt. Vui l\u00f2ng t\u1ea3i l\u1ea1i.',
  final:'\u0110\u00e2y l\u00e0 tr\u1ea1ng th\u00e1i k\u1ebft th\u00fac. Anh/ch\u1ecb x\u00e1c nh\u1eadn chuy\u1ec3n tr\u1ea1ng th\u00e1i?',
  status:'Tr\u1ea1ng th\u00e1i'
};

const eye = `
  <svg width="19" height="19" viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round"
    aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
`;

const bell = `
  <svg width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
    <path d="M10 21h4"/>
  </svg>
`;

const refreshIcon = `
  <svg width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <path d="M20 11a8 8 0 1 0-2 6"/>
    <path d="M20 4v7h-7"/>
  </svg>
`;

let currentRoot = null;
let activeLane = '';
let busy = false;

const isStaff = root =>
  root?.classList.contains('eh3-staff');

function iconize(button,label,markup) {
  if (!button || button.dataset.ehfIcon === '1') return;

  button.dataset.ehfIcon = '1';
  button.classList.add('ehf-icon');
  button.setAttribute('aria-label',label);
  button.title = label;
  button.innerHTML = markup;
}

function removeRedundantNavigation(root) {
  if (!isStaff(root)) return;

  // Staff no longer needs duplicate Today/Care navigation.
  root.querySelectorAll(
    '.sidebar [data-mode="today"],' +
    '.sidebar [data-mode="overdue"],' +
    '.mobile-nav [data-mode="today"],' +
    '.mobile-nav [data-mode="overdue"]'
  ).forEach(element=>element.remove());

  const header = root.querySelector('main.content > header');
  if (!header) return;

  // Keep Callio on each customer, not as a separate staff page CTA.
  for (const id of ['callio','daily','new']) {
    const button = header.querySelector('#'+id);
    button?.remove();
  }

  const actions = header.querySelector('.header-actions');
  if (!actions) return;

  const notification = root.querySelector('#notifications');
  iconize(notification,TEXT.notification,bell);

  const refresh = root.querySelector('#refresh');

  if (refresh) {
    if (refresh.parentElement !== actions) {
      actions.append(refresh);
    }

    iconize(refresh,TEXT.refresh,refreshIcon);
  }

  // Keep the sticky filter below the real header height.
  const top = Math.ceil(header.getBoundingClientRect().height);
  const value = top+'px';

  if (root.style.getPropertyValue('--ehf-header-height') !== value) {
    root.style.setProperty('--ehf-header-height',value);
  }
}

function consolidateFilters(root) {
  const toolbar = root.querySelector('.table-card .toolbar');
  const controls = root.querySelector('.eh3-controls');

  if (!toolbar || !controls) return;

  let dock = root.querySelector('.ehf-dock');

  if (!dock) {
    dock = document.createElement('div');
    dock.className = 'ehf-dock';
    toolbar.before(dock);
    dock.append(toolbar,controls);
  } else {
    if (toolbar.parentElement !== dock) dock.append(toolbar);
    if (controls.parentElement !== dock) dock.append(controls);
  }

  // Move the original status select to Advanced Filters.
  // Existing event listeners are preserved.
  const status = root.querySelector('#status');
  const advanced = controls.querySelector('.eh3-advanced');

  if (status && advanced &&
      !advanced.querySelector('.ehf-status-field')) {
    const label = document.createElement('label');
    label.className = 'ehf-status-field';

    const name = document.createElement('span');
    name.textContent = TEXT.status;

    label.append(name,status);
    advanced.prepend(label);
  }

  const quicks = controls.querySelector('.eh3-quicks');

  if (!quicks) return;

  for (const [key,label] of [
    ['booking',TEXT.booking],
    ['not-fit',TEXT.noFit]
  ]) {
    if (quicks.querySelector('[data-ehf-status="'+key+'"]')) {
      continue;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.ehfStatus = key;
    button.textContent = label;

    button.onclick = () => {
      const statusField = root.querySelector('#status');
      const target = key === 'booking'
        ? TEXT.booking : TEXT.noFit;

      if (!statusField ||
          ![...statusField.options].some(x=>x.value===target)) {
        window.alert('CRM status is not configured: '+target);
        return;
      }

      // Clear the prior quick filter before applying an exact status.
      const all = quicks.querySelector('[data-quick="all"]');

      all?.click();

      statusField.value = target;
      statusField.dispatchEvent(
        new Event('change',{bubbles:true})
      );

      quicks.querySelectorAll('[data-ehf-status]')
        .forEach(x=>x.classList.toggle('active',x===button));
    };

    quicks.append(button);
  }
}

function updateMobileLanes(root) {
  const board = root.querySelector('.eh-kb-board');
  const track = board?.querySelector('.eh-kb-scroll');

  if (!board || !track) return;

  let tabs = board.querySelector('.ehf-mobile-tabs');

  if (!tabs) {
    tabs = document.createElement('nav');
    tabs.className = 'ehf-mobile-tabs';
    tabs.setAttribute('aria-label',TEXT.status);
    track.before(tabs);
  }

  const lanes = [...track.querySelectorAll('.eh-kb-lane')];
  if (!lanes.length) return;

  const signature = lanes
    .map(x=>x.dataset.status)
    .join('|');

  if (tabs.dataset.signature !== signature) {
    tabs.dataset.signature = signature;
    tabs.replaceChildren();

    if (!lanes.some(x=>x.dataset.status===activeLane)) {
      activeLane = lanes[0].dataset.status;
    }

    for (const lane of lanes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = lane.dataset.status;
      button.dataset.lane = lane.dataset.status;

      button.onclick = () => {
        activeLane = lane.dataset.status;
        updateMobileLanes(root);
      };

      tabs.append(button);
    }
  }

  for (const lane of lanes) {
    const selected = lane.dataset.status === activeLane;

    lane.classList.toggle('ehf-lane-hidden',!selected);
  }

  tabs.querySelectorAll('[data-lane]').forEach(button=>{
    const selected=button.dataset.lane===activeLane;

    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}

function openStatusSheet(root,card) {
  if (document.querySelector('.ehf-sheet')) return;

  const overlay = document.createElement('div');
  overlay.className = 'ehf-sheet';

  const dialog = document.createElement('section');
  dialog.className = 'ehf-sheet-panel';
  dialog.setAttribute('role','dialog');
  dialog.setAttribute('aria-modal','true');
  dialog.setAttribute('aria-label',TEXT.change);

  const title = document.createElement('h3');
  title.textContent = TEXT.change;

  const select = document.createElement('select');
  select.setAttribute('aria-label',TEXT.status);

  const options = [...new Set(statuses)];

  for (const status of options) {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    select.append(option);
  }

  select.value = card.dataset.status;

  const actions = document.createElement('div');
  actions.className = 'ehf-sheet-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = TEXT.cancel;

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'primary';
  confirm.textContent = TEXT.confirm;

  actions.append(cancel,confirm);
  dialog.append(title,select,actions);
  overlay.append(dialog);
  document.body.append(overlay);

  const close = () => overlay.remove();

  cancel.onclick = close;

  overlay.onclick = event => {
    if (event.target===overlay)close();
  };

  overlay.onkeydown = event => {
    if (event.key==='Escape')close();
  };

  select.focus();

  confirm.onclick = async () => {
    if (busy) return;

    const id = card.dataset.id;
    const from = card.dataset.status;
    const to = select.value;

    if (!id || from===to) {
      close();
      return;
    }

    if (!options.includes(to)) return;

    if ([TEXT.booking,TEXT.noFit].includes(to)) {
      if (!window.confirm(TEXT.final)) return;
    }

    busy = true;
    confirm.disabled = true;

    try {
      // Re-read before updating to detect stale status/version.
      const data = await rpc('crm_detail',{p_id:id});
      const lead = data?.lead;

      if (!lead || lead.status!==from) {
        throw Error(TEXT.changed);
      }

      await mutate('crm_update',{
        p_id:id,
        p_version:lead.version,
        p_status:to,
        p_next:lead.next_followup||null,
        p_note:lead.notes||''
      });

      close();

      // Reload both List and Kanban through their existing controls.
      root.querySelector('#refresh')?.click();
      root.querySelector(
        '.eh-kb-switch [data-view="board"]'
      )?.click();

    } catch(error) {
      window.alert(error?.message||'Update failed');
    } finally {
      busy = false;
      confirm.disabled = false;
    }
  };
}

function enhanceMobileBoard(root) {
  if (!mobile()) return;

  const board = root.querySelector('.eh-kb-board');
  if (!board) return;

  updateMobileLanes(root);

  board.querySelectorAll('.eh-kb-card').forEach(card=>{
    if (card.dataset.ehfReady==='1') return;

    card.dataset.ehfReady='1';
    card.draggable=false;
    card.tabIndex=0;

    const actions=card.querySelector('.eh-kb-actions');
    if (!actions) return;

    const button=document.createElement('button');
    button.type='button';
    button.className='ehf-change-status';
    button.textContent=TEXT.change;

    button.onclick=event=>{
      event.stopPropagation();
      openStatusSheet(root,card);
    };

    actions.prepend(button);
  });
}

// Mobile tap on card opens detail.
// Existing Callio and status buttons remain independent.
document.addEventListener('click',event=>{
  if (!mobile()) return;

  const card=event.target.closest?.(
    '.eh-kb-card'
  );

  if (!card) return;

  if (event.target.closest(
    'button,a,input,select,textarea'
  )) return;

  card.querySelector(
    '[data-action="view"]'
  )?.click();
},true);

function reconcile() {
  const root=document.querySelector(
    '#app .workspace.eh3-staff'
  );

  if (!isStaff(root)) return;

  if (currentRoot!==root) {
    currentRoot=root;
    activeLane='';
  }

  removeRedundantNavigation(root);
  consolidateFilters(root);
  enhanceMobileBoard(root);
}

function start() {
  let queued=false;

  const schedule=()=>{
    if (queued) return;

    queued=true;

    requestAnimationFrame(()=>{
      queued=false;
      reconcile();
    });
  };

  const observer=new MutationObserver(schedule);

  observer.observe(document.body,{
    childList:true,
    subtree:true
  });

  window.addEventListener('resize',schedule);
  schedule();
}

if (document.body)start();
else document.addEventListener('DOMContentLoaded',start,{once:true});