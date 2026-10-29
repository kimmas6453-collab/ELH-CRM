import './kanban-desktop.css';
import {rpc,mutate} from './api.js';
import {statuses} from './domain.js';

const TXT = {
  list:'Danh s\u00e1ch',
  board:'Kanban',
  call:'G\u1ecdi Callio',
  view:'Xem h\u1ed3 s\u01a1',
  more:'T\u1ea3i th\u00eam',
  empty:'Ch\u01b0a c\u00f3 kh\u00e1ch',
  due:'H\u1eb9n ti\u1ebfp',
  noDue:'Ch\u01b0a \u0111\u1eb7t l\u1ecbch',
  loading:'\u0110ang t\u1ea3i...',
  updated:'\u0110\u00e3 c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i',
  changed:'Kh\u00e1ch \u0111\u00e3 \u0111\u01b0\u1ee3c thay \u0111\u1ed5i. H\u00e3y t\u1ea3i l\u1ea1i.',
  confirm:'X\u00e1c nh\u1eadn chuy\u1ec3n sang tr\u1ea1ng th\u00e1i k\u1ebft th\u00fac?',
  error:'Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt.'
};

const mobile = () =>
  matchMedia('(max-width:767px)').matches;

const escapeHTML = value =>
  String(value ?? '').replace(/[&<>"']/g,ch=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[ch]));

const state = {
  workspace:null,
  profile:null,
  profilePromise:null,
  board:null,
  track:null,
  showing:false,
  generation:0,
  lanes:new Map(),
  observer:null,
  counts:new Map(),
  busyMove:false,
  dirtyList:false,
  filterTimer:null
};

const validStatuses = Array.isArray(statuses)
  ? [...new Set(statuses)] : [];

function notify(text) {
  const el = state.board?.querySelector('.eh-kb-message');
  if(el)el.textContent=text||'';
}

function getFilters() {
  const get = id =>
    document.getElementById(id)?.value || '';

  const activeQuick = document.querySelector(
    '.eh3-controls [data-quick].active'
  )?.dataset.quick || 'all';

  return {
    query:get('search').trim(),
    selectedStatus:get('status'),
    quick:activeQuick,
    project:get('eh3-project').trim(),
    source:get('eh3-source').trim(),
    sort:get('eh3-sort') || 'priority',
    createdFrom:get('eh3-created-from') || null,
    createdTo:get('eh3-created-to') || null,
    dueFrom:get('eh3-due-from') || null,
    dueTo:get('eh3-due-to') || null,
    followup:get('eh3-followup') || 'any'
  };
}

function createCard(lead) {
  const card=document.createElement('article');
  card.className='eh-kb-card';
  card.draggable=true;

  card.dataset.id=String(lead.id);
  card.dataset.status=String(lead.status||'');

  const name=document.createElement('strong');
  name.textContent=lead.name||'';

  const phone=document.createElement('div');
  phone.className='eh-kb-muted';
  phone.textContent=lead.phone||'';

  const project=document.createElement('div');
  project.className='eh-kb-muted';
  project.textContent=lead.project||'';

  const due=document.createElement('small');
  due.className='eh-kb-due';
  due.textContent=lead.next_followup
    ? TXT.due+': '+lead.next_followup
    : TXT.noDue;

  const actions=document.createElement('div');
  actions.className='eh-kb-actions';

  const view=document.createElement('button');
  view.type='button';
  view.dataset.action='view';
  view.textContent=TXT.view;

  const call=document.createElement('button');
  call.type='button';
  call.dataset.action='call';
  call.textContent=TXT.call;

  actions.append(view,call);
  card.append(name,phone,project,due,actions);

  return card;
}

function clearObservers() {
  state.observer?.disconnect();
  state.observer=null;

  for(const lane of state.lanes.values()) {
    lane.observer?.disconnect();
  }

  state.lanes.clear();
}

function buildLanes() {
  clearObservers();

  const track=state.track;
  track.replaceChildren();

  const f=getFilters();

  const columns=f.selectedStatus
    ? validStatuses.filter(x=>x===f.selectedStatus)
    : validStatuses;

  for(const status of columns) {
    const laneEl=document.createElement('section');
    laneEl.className='eh-kb-lane';
    laneEl.dataset.status=status;

    const header=document.createElement('header');
    header.className='eh-kb-lane-head';

    const title=document.createElement('strong');
    title.textContent=status;

    const count=document.createElement('span');
    count.className='eh-kb-count';
    count.textContent='\u2014';

    header.append(title,count);

    const cards=document.createElement('div');
    cards.className='eh-kb-cards';

    const sentinel=document.createElement('div');
    sentinel.className='eh-kb-sentinel';

    cards.append(sentinel);
    laneEl.append(header,cards);
    track.append(laneEl);

    state.lanes.set(status,{
      element:laneEl,
      cards,
      sentinel,
      count,
      cursor:null,
      hasMore:true,
      loaded:false,
      busy:false,
      observer:null
    });
  }

  if(!('IntersectionObserver' in window)) {
    for(const status of columns)loadLane(status);
    return;
  }

  state.observer=new IntersectionObserver(entries=>{
    for(const entry of entries) {
      if(entry.isIntersecting) {
        loadLane(entry.target.dataset.status);
      }
    }
  },{
    root:track,
    rootMargin:'0px 240px 0px 240px',
    threshold:0.01
  });

  for(const lane of state.lanes.values()) {
    state.observer.observe(lane.element);
  }
}

async function loadCounts() {
  const generation=state.generation;
  const f=getFilters();

  try {
    const result=await rpc('crm_staff_kanban_counts_v1',{
      p_query:f.query,
      p_project:f.project,
      p_source:f.source,
      p_quick:f.quick,
      p_created_from:f.createdFrom,
      p_created_to:f.createdTo,
      p_due_from:f.dueFrom,
      p_due_to:f.dueTo,
      p_followup:f.followup
    });

    if(generation!==state.generation)return;

    const rows=Array.isArray(result)?result:[];

    state.counts=new Map(
      rows.map(x=>[x.status,Number(x.total)])
    );

    for(const [status,lane] of state.lanes) {
      lane.count.textContent=String(
        state.counts.get(status)??0
      );
    }
  } catch(err) {
    if(generation!==state.generation)return;
    notify('Kanban counts RPC unavailable: '+err.message);
  }
}

async function loadLane(status) {
  const lane=state.lanes.get(status);
  if(!lane||!state.showing)return;
  if(lane.busy||!lane.hasMore)return;

  const generation=state.generation;
  const f=getFilters();

  lane.busy=true;

  try {
    const result=await rpc('crm_staff_leads_v3',{
      p_query:f.query,
      p_status:status,
      p_quick:f.quick,
      p_project:f.project,
      p_source:f.source,
      p_sort:f.sort,
      p_created_from:f.createdFrom,
      p_created_to:f.createdTo,
      p_due_from:f.dueFrom,
      p_due_to:f.dueTo,
      p_followup:f.followup,
      p_cursor_rank:lane.cursor?.rank??null,
      p_cursor_sortkey:lane.cursor?.key??null,
      p_cursor_id:lane.cursor?.id??null,
      p_limit:20
    });

    if(generation!==state.generation)return;

    const batch=Array.isArray(result?.items)
      ? result.items:[];

    const existing=new Set(
      [...lane.cards.querySelectorAll('.eh-kb-card')]
        .map(x=>x.dataset.id)
    );

    for(const lead of batch) {
      const id=String(lead.id);
      if(existing.has(id))continue;

      lane.sentinel.before(createCard(lead));
      existing.add(id);
    }

    const priorCursor=JSON.stringify(lane.cursor);
    lane.cursor=result?.nextCursor??null;
    lane.hasMore=Boolean(result?.hasMore);

    if(!batch.length ||
       (lane.hasMore &&
        JSON.stringify(lane.cursor)===priorCursor)) {
      lane.hasMore=false;
    }

    lane.loaded=true;

    if(lane.hasMore && !lane.observer &&
       'IntersectionObserver' in window) {
      lane.observer=new IntersectionObserver(entries=>{
        if(entries.some(e=>e.isIntersecting)) {
          loadLane(status);
        }
      },{
        root:lane.cards,
        rootMargin:'0px 0px 180px 0px'
      });

      lane.observer.observe(lane.sentinel);
    }

  } catch(err) {
    notify(err.message);
  } finally {
    if(generation===state.generation) {
      lane.busy=false;
    }
  }
}

function refreshBoard() {
  if(!state.showing)return;

  state.generation++;
  state.counts.clear();

  buildLanes();
  loadCounts();
}

function showList() {
  state.showing=false;
  state.generation++;
  clearObservers();

  state.board.hidden=true;

  const table=state.workspace.querySelector('.table-scroll');
  const footer=state.workspace.querySelector('.table-card footer');

  table?.classList.remove('eh-kb-hidden');
  footer?.classList.remove('eh-kb-hidden');

  state.workspace.querySelector(
    '.eh-kb-switch [data-view="list"]'
  )?.classList.add('active');

  state.workspace.querySelector(
    '.eh-kb-switch [data-view="board"]'
  )?.classList.remove('active');

  sessionStorage.setItem(
    'elh-view-'+state.profile.id,'list'
  );

  if(state.dirtyList) {
    document.getElementById('refresh')?.click();
    state.dirtyList=false;
  }
}

function showBoard() {
  /* Mobile Kanban enabled by UX Consolidation */

  state.showing=true;
  state.board.hidden=false;

  state.workspace.querySelector(
    '.table-scroll'
  )?.classList.add('eh-kb-hidden');

  state.workspace.querySelector(
    '.table-card footer'
  )?.classList.add('eh-kb-hidden');

  state.workspace.querySelector(
    '.eh-kb-switch [data-view="board"]'
  )?.classList.add('active');

  state.workspace.querySelector(
    '.eh-kb-switch [data-view="list"]'
  )?.classList.remove('active');

  sessionStorage.setItem(
    'elh-view-'+state.profile.id,'board'
  );

  refreshBoard();
}

async function moveLead(id,from,to) {
  if(!id||from===to||state.busyMove)return;
  if(!validStatuses.includes(to))return;

  const isFinal=[
    'Booking',
    'Kh\u00f4ng ph\u00f9 h\u1ee3p'
  ].includes(to);

  if(isFinal && !confirm(TXT.confirm))return;

  state.busyMove=true;
  notify(TXT.loading);

  try {
    // Re-read current version immediately before writing.
    const detail=await rpc('crm_detail',{p_id:id});
    const lead=detail?.lead;

    if(!lead)throw Error('Customer unavailable');

    if(lead.status!==from) {
      throw Error(TXT.changed);
    }

    // Reuse existing authorized, version-checked mutation.
    await mutate('crm_update',{
      p_id:id,
      p_version:lead.version,
      p_status:to,
      p_next:lead.next_followup||null,
      p_note:lead.notes||''
    });

    state.dirtyList=true;
    notify(TXT.updated);
    refreshBoard();
  } catch(err) {
    notify(err.message||TXT.error);
    refreshBoard();
  } finally {
    state.busyMove=false;
  }
}

async function handleAction(action,id) {
  if(!id)return;

  try {
    if(action==='call') {
      const callio=await import('./callio.js');
      if(typeof callio.callLead!=='function') {
        throw Error('Callio unavailable');
      }

      notify(await callio.callLead(id));
      return;
    }

    if(action==='view') {
      const module=await import('./customer-detail-page.js');

      await module.openCustomerDetailPage({
        id,
        rpc,
        mutate,
        statuses:validStatuses,
        profile:state.profile,
        onSaved:async()=>{
          state.dirtyList=true;
          refreshBoard();
        }
      });
    }
  } catch(err) {
    notify(err.message);
  }
}

function setupBoardEvents(board) {
  board.addEventListener('click',event=>{
    const button=event.target.closest('button[data-action]');
    if(!button)return;

    const card=button.closest('.eh-kb-card');
    if(!card)return;

    handleAction(button.dataset.action,card.dataset.id);
  });

  board.addEventListener('dragstart',event=>{
    const card=event.target.closest('.eh-kb-card');
    if(!card)return;

    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData(
      'application/x-elh-lead',
      JSON.stringify({
        id:card.dataset.id,
        from:card.dataset.status
      })
    );
  });

  board.addEventListener('dragover',event=>{
    if(!event.target.closest('.eh-kb-lane'))return;
    event.preventDefault();
    event.dataTransfer.dropEffect='move';
  });

  board.addEventListener('drop',event=>{
    const lane=event.target.closest('.eh-kb-lane');
    if(!lane)return;

    event.preventDefault();

    const raw=event.dataTransfer.getData(
      'application/x-elh-lead'
    );

    if(!raw)return;

    try {
      const payload=JSON.parse(raw);
      moveLead(
        payload.id,
        payload.from,
        lane.dataset.status
      );
    } catch(err) {
      notify(err.message);
    }
  });
}

async function mount() {
  const workspace=document.querySelector('#app .workspace');

  if(!workspace||!workspace.classList.contains('eh3-staff')) {
    return;
  }

  if(state.workspace===workspace && state.board?.isConnected) {
    return;
  }

  if(state.profilePromise)return;

  state.profilePromise=rpc('crm_profile');

  try {
    const profile=await state.profilePromise;

    if(profile?.role!=='TELESALES' ||
       !workspace.isConnected)return;

    const toolbar=workspace.querySelector('.table-card .toolbar');
    if(!toolbar)return;

    state.workspace=workspace;
    state.profile=profile;

    const switcher=document.createElement('div');
    switcher.className='eh-kb-switch';

    switcher.innerHTML=`
      <button type="button" data-view="list">
        ${TXT.list}
      </button>
      <button type="button" data-view="board">
        ${TXT.board}
      </button>
    `;

    toolbar.append(switcher);

    const board=document.createElement('section');
    board.className='eh-kb-board';
    board.hidden=true;

    board.innerHTML=`
      <div class="eh-kb-message" role="status"></div>
      <div class="eh-kb-scroll"></div>
    `;

    const anchor=workspace.querySelector('.eh3-controls')||toolbar;
    anchor.after(board);

    state.board=board;
    state.track=board.querySelector('.eh-kb-scroll');

    setupBoardEvents(board);

    switcher.onclick=event=>{
      const button=event.target.closest('[data-view]');
      if(!button)return;

      button.dataset.view==='board'
        ? showBoard()
        : showList();
    };

    const previous=sessionStorage.getItem(
      'elh-view-'+profile.id
    );

    if(previous==='board')showBoard();
    else showList();

  } finally {
    state.profilePromise=null;
  }
}

document.addEventListener('input',event=>{
  if(!state.showing)return;

  if(event.target.matches(
    '#search,#eh3-project,#eh3-source'
  )) {
    clearTimeout(state.filterTimer);
    state.filterTimer=setTimeout(refreshBoard,350);
  }
});

document.addEventListener('change',event=>{
  if(!state.showing)return;

  if(event.target.matches(
    '#status,#eh3-sort,#eh3-followup,'+
    '#eh3-created-from,#eh3-created-to,'+
    '#eh3-due-from,#eh3-due-to'
  )) {
    refreshBoard();
  }
});

document.addEventListener('click',event=>{
  if(!state.showing)return;

  if(event.target.closest(
    '[data-quick],.eh3-clear'
  )) {
    setTimeout(refreshBoard,0);
  }
});

window.addEventListener('resize',()=>{
  if(mobile()&&state.showing)showList();
});

function start() {
  let pending=false;

  const observer=new MutationObserver(()=>{
    if(pending)return;
    pending=true;

    queueMicrotask(()=>{
      pending=false;
      mount().catch(console.error);
    });
  });

  observer.observe(document.body,{
    childList:true,
    subtree:true
  });

  mount().catch(console.error);
}

if(document.body)start();
else document.addEventListener('DOMContentLoaded',start,{once:true});