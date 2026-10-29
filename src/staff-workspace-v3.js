import './staff-workspace-v3.css';
import {callioOutcomeLabel} from './callio-outcome.js';
import './staff-workspace-v7.css';

const L = {
  mine:'Data c\u1ee7a t\u00f4i',
  all:'T\u1ea5t c\u1ea3',
  urgent:'C\u1ea7n x\u1eed l\u00fd',
  overdue:'Qu\u00e1 h\u1ea1n ch\u0103m s\u00f3c',
  newLead:'Ch\u01b0a li\u00ean h\u1ec7',
  noAnswer:'Kh\u00f4ng nghe m\u00e1y',
  interested:'C\u00f3 nhu c\u1ea7u',
  meeting:'H\u1eb9n g\u1eb7p',
  filter:'B\u1ed9 l\u1ecdc n\u00e2ng cao',
  project:'D\u1ef1 \u00e1n quan t\u00e2m',
  source:'Ngu\u1ed3n kh\u00e1ch h\u00e0ng',
  createdFrom:'Ng\u00e0y nh\u1eadn t\u1eeb',
  createdTo:'Ng\u00e0y nh\u1eadn \u0111\u1ebfn',
  dueFrom:'Ch\u0103m s\u00f3c t\u1eeb ng\u00e0y',
  dueTo:'Ch\u0103m s\u00f3c \u0111\u1ebfn ng\u00e0y',
  followup:'L\u1ecbch ch\u0103m s\u00f3c',
  any:'T\u1ea5t c\u1ea3',
  scheduled:'\u0110\u00e3 c\u00f3 l\u1ecbch',
  noSchedule:'Ch\u01b0a c\u00f3 l\u1ecbch',
  sort:'S\u1eafp x\u1ebfp',
  priority:'\u01afu ti\u00ean x\u1eed l\u00fd',
  newest:'M\u1edbi nh\u1ea5t',
  oldest:'C\u0169 nh\u1ea5t',
  nearest:'L\u1ecbch g\u1ea7n nh\u1ea5t',
  clear:'X\u00f3a b\u1ed9 l\u1ecdc',
  view:'Xem h\u1ed3 s\u01a1',
  call:'G\u1ecdi Callio',
  projectEmpty:'Ch\u01b0a c\u1eadp nh\u1eadt d\u1ef1 \u00e1n',
  noDue:'Ch\u01b0a \u0111\u1eb7t l\u1ecbch',
  noResults:'Kh\u00f4ng c\u00f3 kh\u00e1ch ph\u00f9 h\u1ee3p v\u1edbi b\u1ed9 l\u1ecdc.',
  loading:'\u0110ang t\u1ea3i kh\u00e1ch h\u00e0ng...',
  failed:'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c danh s\u00e1ch.',
  loaded:'\u0110\u00e3 t\u1ea3i',
  customers:'kh\u00e1ch',
  finished:'\u0110\u00e3 hi\u1ec3n th\u1ecb h\u1ebft'
};

const esc = value => String(value ?? '').replace(
  /[&<>"']/g,
  ch => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[ch])
);

const toneMap = new Map([
  ['M\u1edbi','blue'],
  ['Ch\u01b0a li\u00ean h\u1ec7','blue'],
  ['Kh\u00f4ng nghe m\u00e1y','amber'],
  ['\u0110\u00e3 li\u00ean h\u1ec7','blue'],
  ['\u0110ang ch\u0103m s\u00f3c','blue'],
  ['C\u00f3 nhu c\u1ea7u','green'],
  ['H\u1eb9n g\u1eb7p','orange'],
  ['\u0110ang t\u01b0 v\u1ea5n','purple'],
  ['Kh\u00f4ng ph\u00f9 h\u1ee3p','red'],
  ['Booking','green']
]);

const initialFilters = () => ({
  quick:'all',
  project:'',
  source:'',
  sort:'priority',
  createdFrom:'',
  createdTo:'',
  dueFrom:'',
  dueTo:'',
  followup:'any'
});

const state = {
  owner:null,
  workspace:null,
  filters:initialFilters(),
  signature:'',
  generation:0,
  busy:false,
  hasMore:true,
  cursor:null,
  seen:new Set(),
  items:[],
  observers:[],
  reload:null,
  context:null,
  projectTimer:null
};

function resetOwner(owner) {
  state.observers.forEach(x=>x.disconnect());
  state.observers=[];

  state.owner=owner;
  state.workspace=null;
  state.filters=initialFilters();
  state.signature='';
  state.generation++;
  state.busy=false;
  state.hasMore=true;
  state.cursor=null;
  state.seen.clear();
  state.items=[];
}

function dueLabel(value) {
  if(!value)return L.noDue;

  const parts=String(value).slice(0,10).split('-');

  if(parts.length===3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}

function currentSignature(context) {
  return JSON.stringify({
    query:context.query,
    status:context.status,
    ...state.filters
  });
}

function renderCards(reset,items) {
  const rows=document.getElementById('rows');

  if(!rows)return;

  if(reset)rows.replaceChildren();

  const markup=items.map(item=>{
    const id=esc(item.id);
    const name=esc(item.name||'');
    const phone=esc(item.phone||'');
    const project=esc(item.project||L.projectEmpty);
    const status=esc(item.status||'');
    const due=esc(dueLabel(item.next_followup));
    const recent='<small class="eh7-recent-call" data-callio-lead="'+id+'" hidden></small>';

    const tone=toneMap.get(item.status)||'neutral';
    const avatar=esc((item.name||'?').charAt(0));

    return `
      <tr class="lead-row eh3-row"
          tabindex="0"
          data-lead-id="${id}">
        <td class="lead-avatar">
          <span class="avatar">${avatar}</span>
        </td>

        <td class="lead-name">
          <button class="text-button"
            data-action="detail"
            data-id="${id}">
            ${name}
          </button>
          <small>${phone}</small>
        </td>

        <td class="lead-project">${project}</td>

        <td class="lead-status">
          <span class="badge eh3-badge eh3-${tone}">
            ${status}
          </span>
        </td>

        <td class="lead-followup">
          ${due}
          ${recent}
        </td>

        <td class="lead-actions">
          <button type="button"
            class="eh3-view"
            data-action="detail"
            data-id="${id}"
            aria-label="${L.view}"
            title="${L.view}">
            <svg width="19" height="19"
              viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>

          <button type="button"
            class="call-button eh3-call"
            data-action="call"
            data-id="${id}">
            ${L.call}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  rows.insertAdjacentHTML('beforeend',markup);
}

function updateFooter() {
  const count=document.getElementById('count');
  const more=document.getElementById('more');

  if(count) {
    count.textContent=
      `${L.loaded} ${state.items.length} ${L.customers}`+
      (state.hasMore?'':` - ${L.finished}`);
  }

  if(more)more.hidden=true;
}

// At most ONE scoped RPC per page, not one request per customer.
async function annotateRecentCalls(context, batch, generation) {
  if(!batch.length || !context?.profile?.id)return;
  try {
    const summaries=await context.rpc('crm_staff_callio_recent',{
      p_ids:batch.map(item=>item.id)
    });
    if(state.generation!==generation || state.owner!==context.profile.id)return;
    for(const item of batch){
      const call=summaries?.[item.id];
      if(!call)continue;
      const row=[...document.querySelectorAll('#rows .eh3-row')]
        .find(node=>node.dataset.leadId===String(item.id));
      const element=row?.querySelector('.eh7-recent-call');
      if(!element)continue;
      const day=String(call.at||'').slice(0,10);
      const outcome=callioOutcomeLabel(call.outcome,call.talk_seconds);
      element.textContent='Callio '+day+' · '+outcome;
      element.hidden=false;
    }
  }catch(err){
    // CRM list still works if optional Callio summary RPC is not installed.
    console.warn('Callio recent summary unavailable',err);
  }
}

function mountControls(context) {
  const workspace=context.root.querySelector('.workspace');
  if(!workspace)return;

  if(state.workspace===workspace)return;

  state.observers.forEach(x=>x.disconnect());
  state.observers=[];

  state.workspace=workspace;
  workspace.classList.add('eh3-staff');

  // Only staff has this navigation.
  workspace.querySelectorAll(
    '.sidebar [data-mode],.mobile-nav [data-mode]'
  ).forEach(btn=>{
    if(btn.dataset.mode==='all'){
      btn.textContent=L.mine;
    } else {
      btn.hidden=true;
    }
  });

  const title=workspace.querySelector('#page-title');
  if(title)title.textContent=L.mine;

  const toolbar=workspace.querySelector('.toolbar');

  if(!toolbar)return;

  const panel=document.createElement('section');
  panel.className='eh3-controls';

  const quicks=[
    ['all',L.all],
    ['urgent',L.urgent],
    ['overdue',L.overdue],
    ['new',L.newLead],
    ['no_answer',L.noAnswer],
    ['interested',L.interested],
    ['appointment',L.meeting]
  ];

  panel.innerHTML=`
    <div class="eh3-quicks">
      ${quicks.map(([id,label])=>`
        <button type="button"
          data-quick="${id}"
          class="${id===state.filters.quick?'active':''}">
          ${label}
        </button>
      `).join('')}
    </div>

    <div class="eh3-main-filters">
      <label>${L.sort}
        <select id="eh3-sort">
          <option value="priority">${L.priority}</option>
          <option value="followup">${L.nearest}</option>
          <option value="newest">${L.newest}</option>
          <option value="oldest">${L.oldest}</option>
        </select>
      </label>

      <button type="button"
        class="eh3-toggle"
        aria-expanded="false">
        ${L.filter}
      </button>
    </div>

    <div class="eh3-advanced" hidden>
      <label>${L.project}
        <input id="eh3-project"
          maxlength="200">
      </label>

      <label>${L.source}
        <input id="eh3-source"
          maxlength="200">
      </label>

      <label>${L.createdFrom}
        <input id="eh3-created-from" type="date">
      </label>

      <label>${L.createdTo}
        <input id="eh3-created-to" type="date">
      </label>

      <label>${L.dueFrom}
        <input id="eh3-due-from" type="date">
      </label>

      <label>${L.dueTo}
        <input id="eh3-due-to" type="date">
      </label>

      <label>${L.followup}
        <select id="eh3-followup">
          <option value="any">${L.any}</option>
          <option value="scheduled">${L.scheduled}</option>
          <option value="none">${L.noSchedule}</option>
        </select>
      </label>

      <button type="button" class="eh3-clear">
        ${L.clear}
      </button>
    </div>
  `;

  toolbar.after(panel);

  const f=state.filters;

  const bindField=(selector,key,eventName='change')=>{
    const el=panel.querySelector(selector);
    el.value=f[key];

    el.addEventListener(eventName,()=>{
      f[key]=el.value;
      context.onReload();
    });
  };

  bindField('#eh3-sort','sort');
  bindField('#eh3-followup','followup');

  for(const [selector,key] of [
    ['#eh3-created-from','createdFrom'],
    ['#eh3-created-to','createdTo'],
    ['#eh3-due-from','dueFrom'],
    ['#eh3-due-to','dueTo']
  ])bindField(selector,key);

  for(const [selector,key] of [
    ['#eh3-project','project'],
    ['#eh3-source','source']
  ]){
    const el=panel.querySelector(selector);
    el.value=f[key];

    el.addEventListener('input',()=>{
      clearTimeout(state.projectTimer);
      state.projectTimer=setTimeout(()=>{
        f[key]=el.value.trim();
        context.onReload();
      },320);
    });
  }

  panel.querySelectorAll('[data-quick]').forEach(btn=>{
    btn.onclick=()=>{
      f.quick=btn.dataset.quick;

      panel.querySelectorAll('[data-quick]')
        .forEach(x=>x.classList.toggle(
          'active',x===btn
        ));

      context.onReload();
    };
  });

  const toggle=panel.querySelector('.eh3-toggle');
  const advanced=panel.querySelector('.eh3-advanced');

  toggle.onclick=()=>{
    advanced.hidden=!advanced.hidden;
    toggle.setAttribute(
      'aria-expanded',
      String(!advanced.hidden)
    );
  };

  panel.querySelector('.eh3-clear').onclick=()=>{
    state.filters=initialFilters();
    state.workspace=null;
    panel.remove();
    mountControls(context);
    context.onReload();
  };

  // Existing tbody event delegation handles both actions.
  const rows=document.getElementById('rows');

  if(rows && !rows.dataset.eh3MobileHandler){
    rows.dataset.eh3MobileHandler='1';

    rows.addEventListener('click',event=>{
      if(!window.matchMedia('(max-width:767px)').matches)return;
      if(workspace.classList.contains('eh-ux-staff'))return;

      if(event.target.closest(
        'button,a,input,select,textarea,label'
      ))return;

      const row=event.target.closest('.eh3-row');

      row?.querySelector(
        'button[data-action="detail"]'
      )?.click();
    });

    rows.addEventListener('keydown',event=>{
      if(!window.matchMedia('(max-width:767px)').matches)return;
      if(event.target!==event.target.closest('.eh3-row'))return;
      if(event.key!=='Enter' && event.key!==' ')return;

      event.preventDefault();
      event.target.querySelector(
        'button[data-action="detail"]'
      )?.click();
    });
  }

  const footer=workspace.querySelector('.table-card footer');

  if(footer && !footer.querySelector('.eh3-sentinel')){
    const sentinel=document.createElement('div');
    sentinel.className='eh3-sentinel';
    sentinel.setAttribute('aria-hidden','true');
    footer.append(sentinel);
  }

  const sentinel=workspace.querySelector('.eh3-sentinel');

  if(sentinel && typeof IntersectionObserver!=='undefined'){
    const load=()=>{
      if(state.hasMore && !state.busy &&
         !workspace.querySelector(
           '.eh4-page,.eh-v3-page,.eh-vn-detail-page'
         )){
        loadStaffWorkspace({
          ...state.context,
          reset:false
        });
      }
    };

    const viewportObserver=new IntersectionObserver(
      entries=>{
        if(entries.some(x=>x.isIntersecting))load();
      },
      {root:null,rootMargin:'320px'}
    );

    viewportObserver.observe(sentinel);
    state.observers.push(viewportObserver);

  }
}

export async function loadStaffWorkspace(context){
  if(!context?.profile?.id)return;

  if(state.owner!==context.profile.id){
    resetOwner(context.profile.id);
  }

  state.context=context;
  mountControls(context);

  const signature=currentSignature(context);
  const reset=context.reset || signature!==state.signature;

  if(reset){
    state.generation++;
    state.signature=signature;
    state.items=[];
    state.seen.clear();
    state.cursor=null;
    state.hasMore=true;
    state.busy=false;

    const rows=document.getElementById('rows');
    if(rows)rows.innerHTML='';

    updateFooter();
  }

  if(state.busy || !state.hasMore)return;

  const generation=state.generation;
  state.busy=true;

  const f=state.filters;

  const params={
    p_query:context.query||'',
    p_status:context.status||'',
    p_quick:f.quick,
    p_project:f.project,
    p_source:f.source,
    p_sort:f.sort,
    p_created_from:f.createdFrom||null,
    p_created_to:f.createdTo||null,
    p_due_from:f.dueFrom||null,
    p_due_to:f.dueTo||null,
    p_followup:f.followup,
    p_cursor_rank:state.cursor?.rank??null,
    p_cursor_sortkey:state.cursor?.key??null,
    p_cursor_id:state.cursor?.id??null,
    p_limit:window.matchMedia('(max-width:767px)').matches
      ? 15:30
  };

  try{
    const result=await context.rpc(
      'crm_staff_leads_v3',params
    );

    if(generation!==state.generation)return;

    const batch=Array.isArray(result?.items)
      ? result.items:[];

    const unique=batch.filter(item=>{
      if(state.seen.has(item.id))return false;
      state.seen.add(item.id);
      return true;
    });

    state.items.push(...unique);
    state.cursor=result?.nextCursor||null;
    state.hasMore=Boolean(result?.hasMore);

    renderCards(reset,unique);
    updateFooter();
    // Opportunistic, permission-scoped enrichment only.
    void annotateRecentCalls(context, unique, generation);

    if(!state.items.length){
      const rows=document.getElementById('rows');

      if(rows){
        rows.innerHTML=`
          <tr><td colspan="6" class="empty">
            ${L.noResults}
          </td></tr>
        `;
      }
    }
  }catch(err){
    if(generation!==state.generation)return;

    // Stop intersection-triggered retry storms. Refresh retries explicitly.
    state.hasMore=false;
    context.onError?.(err);

    if(!state.items.length){
      const rows=document.getElementById('rows');
      if(rows){
        rows.innerHTML=`
          <tr><td colspan="6" class="empty">
            ${L.failed}
          </td></tr>
        `;
      }
    }
  }finally{
    if(generation===state.generation){
      state.busy=false;
      updateFooter();
    }
  }
}