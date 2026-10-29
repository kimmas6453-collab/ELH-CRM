import './telesales-workspace-v4.css';
import {rpc,mutate} from './api.js';
import {statuses} from './domain.js';

const LABEL = {
  title:'Data c\u1ee7a t\u00f4i',
  subtitle:'Kh\u00e1ch h\u00e0ng \u0111\u01b0\u1ee3c ph\u00e2n c\u00f4ng',
  list:'Danh s\u00e1ch',
  board:'Kanban',
  search:'T\u00ecm t\u00ean, s\u1ed1 \u0111i\u1ec7n tho\u1ea1i, d\u1ef1 \u00e1n...',
  filter:'B\u1ed9 l\u1ecdc',
  sort:'S\u1eafp x\u1ebfp',
  refresh:'L\u00e0m m\u1edbi',
  notification:'Th\u00f4ng b\u00e1o',
  all:'T\u1ea5t c\u1ea3',
  urgent:'C\u1ea7n x\u1eed l\u00fd',
  overdue:'Qu\u00e1 h\u1ea1n',
  new:'Ch\u01b0a li\u00ean h\u1ec7',
  noAnswer:'Kh\u00f4ng nghe m\u00e1y',
  interested:'C\u00f3 nhu c\u1ea7u',
  meeting:'H\u1eb9n g\u1eb7p',
  booking:'Booking',
  notFit:'Kh\u00f4ng ph\u00f9 h\u1ee3p',
  closed:'\u0110\u00e3 k\u1ebft th\u00fac',
  showClosed:'Hi\u1ec7n \u0110\u00e3 k\u1ebft th\u00fac',
  hideClosed:'\u1ea8n \u0110\u00e3 k\u1ebft th\u00fac',
  view:'Xem h\u1ed3 s\u01a1',
  call:'G\u1ecdi Callio',
  change:'\u0110\u1ed5i tr\u1ea1ng th\u00e1i',
  cancel:'H\u1ee7y',
  confirm:'X\u00e1c nh\u1eadn',
  noDue:'Ch\u01b0a \u0111\u1eb7t l\u1ecbch',
  more:'T\u1ea3i th\u00eam',
  empty:'Ch\u01b0a c\u00f3 kh\u00e1ch',
  saving:'\u0110ang l\u01b0u...',
  saved:'\u0110\u00e3 c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i.',
  changed:'Kh\u00e1ch \u0111\u00e3 thay \u0111\u1ed5i. Vui l\u00f2ng t\u1ea3i l\u1ea1i.',
  final:'X\u00e1c nh\u1eadn chuy\u1ec3n sang tr\u1ea1ng th\u00e1i k\u1ebft th\u00fac?',
  checkCallio:'K\u1ebft qu\u1ea3 Callio xem trong l\u1ecbch s\u1eed kh\u00e1ch.'
};

const GROUPS = [
  {
    id:'new',
    title:'Chưa kết nối',
    statuses:[
      'Chưa liên hệ',
      'Không nghe máy'
    ]
  },
  {
    id:'care',
    title:'Đang chăm sóc',
    statuses:[
      'Đã liên hệ'
    ]
  },
  {
    id:'interest',
    title:'Có tiềm năng',
    statuses:[
      'Có nhu cầu'
    ]
  },
  {
    id:'closed',
    title:'Đã kết thúc',
    statuses:[
      'Booking',
      'Không phù hợp'
    ]
  }
];

const mobile = () =>
  matchMedia('(max-width:767px)').matches;

const $ = (selector,scope=document) =>
  scope.querySelector(selector);

const state = {
  workspace:null,
  profile:null,
  panel:null,
  board:null,
  view:'list',
  quick:'all',
  exactStatus:'',
  query:'',
  activeGroup:'new',
  showClosed:true,
  generation:0,
  lanes:new Map(),
  counts:new Map(),
  boardObserver:null,
  moving:false,
  timer:null,
  mounting:false
};

function escapeHTML(value) {
  return String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[ch]));
}

function notify(text) {
  const message=$('.ehv4-message',state.panel);
  if(message)message.textContent=text||'';
}

function getNativeFilters() {
  const val=id=>document.getElementById(id)?.value||'';

  return {
    project:val('eh3-project'),
    source:val('eh3-source'),
    sort:val('eh3-sort')||'priority',
    createdFrom:val('eh3-created-from')||null,
    createdTo:val('eh3-created-to')||null,
    dueFrom:val('eh3-due-from')||null,
    dueTo:val('eh3-due-to')||null,
    followup:val('eh3-followup')||'any'
  };
}

function filterParams() {
  const f=getNativeFilters();

  return {
    p_query:state.query,
    p_quick:state.quick,
    p_project:f.project,
    p_source:f.source,
    p_sort:f.sort,
    p_created_from:f.createdFrom,
    p_created_to:f.createdTo,
    p_due_from:f.dueFrom,
    p_due_to:f.dueTo,
    p_followup:f.followup
  };
}

function syncOriginal(id,value,event='change') {
  const element=document.getElementById(id);
  if(!element)return;

  element.value=value;
  element.dispatchEvent(new Event(event,{bubbles:true}));
}

function syncQuickFilter(quick,exactStatus='') {
  const old=$(
    '.eh3-controls [data-quick="'+quick+'"]'
  );

  old?.click();

  syncOriginal('status',exactStatus);
}

function updateActiveControls() {
  if(!state.panel)return;

  state.panel.querySelectorAll('[data-quick]').forEach(button=>{
    const selected=
      button.dataset.quick===state.quick &&
      (button.dataset.status||'')===state.exactStatus;

    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',String(selected));
  });

  state.panel.querySelectorAll('[data-view]').forEach(button=>{
    button.classList.toggle(
      'active',button.dataset.view===state.view
    );
  });
}

function setupHeader(root) {
  const header=$('main.content > header',root);
  const actions=$('.header-actions',header);

  if(!header||!actions)return;

  for(const id of ['callio','daily','new']){
    const element=document.getElementById(id);
    element?.remove();
  }

  const notif=document.getElementById('notifications');
  const refresh=document.getElementById('refresh');

  if(refresh && refresh.parentElement!==actions){
    actions.append(refresh);
  }

  const makeIcon=(button,label,svg)=>{
    if(!button)return;
    button.classList.add('ehv4-icon-button');
    button.setAttribute('aria-label',label);
    button.title=label;
    button.innerHTML=svg;
  };

  makeIcon(refresh,LABEL.refresh,`
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2 6"/>
      <path d="M20 4v7h-7"/>
    </svg>
  `);

  makeIcon(notif,LABEL.notification,`
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
      <path d="M10 21h4"/>
    </svg>
  `);

  const updateHeight=()=>{
    root.style.setProperty(
      '--ehv4-header-height',
      Math.ceil(header.getBoundingClientRect().height)+'px'
    );
  };

  updateHeight();

  if(typeof ResizeObserver!=='undefined'){
    const observer=new ResizeObserver(updateHeight);
    observer.observe(header);
  }
}

function makePanel() {
  const panel=document.createElement('section');
  panel.className='ehv4-panel';

  panel.innerHTML=`
    <div class="ehv4-search-row">
      <label class="ehv4-search">
        <span aria-hidden="true">&#8981;</span>
        <input id="ehv4-search" type="search"
          placeholder="${LABEL.search}"
          aria-label="${LABEL.search}">
      </label>
    </div>

    <div class="ehv4-actions-row">
      <div class="ehv4-view-switch">
        <button type="button" data-view="list">${LABEL.list}</button>
        <button type="button" data-view="board">${LABEL.board}</button>
      </div>

      <div class="ehv4-right-actions">
        <select id="ehv4-sort" aria-label="${LABEL.sort}">
          <option value="priority">Ưu tiên xử lý</option>
          <option value="followup">Lịch gần nhất</option>
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
        </select>

        <button type="button" id="ehv4-filter-toggle"
          aria-expanded="false">
          ${LABEL.filter}
        </button>
      </div>
    </div>

    <div class="ehv4-quick-row"></div>

    <div class="ehv4-advanced" hidden>
      <label>Dự án
        <input data-sync="eh3-project" type="text">
      </label>

      <label>Nguồn
        <input data-sync="eh3-source" type="text">
      </label>

      <label>Trạng thái
        <select id="ehv4-status"></select>
      </label>

      <label>Ngày nhận từ
        <input data-sync="eh3-created-from" type="date">
      </label>

      <label>Ngày nhận đến
        <input data-sync="eh3-created-to" type="date">
      </label>

      <label>Lịch từ ngày
        <input data-sync="eh3-due-from" type="date">
      </label>

      <label>Lịch đến ngày
        <input data-sync="eh3-due-to" type="date">
      </label>

      <label>Lịch chăm sóc
        <select data-sync="eh3-followup">
          <option value="any">Tất cả</option>
          <option value="scheduled">Đã đặt lịch</option>
          <option value="none">Chưa đặt lịch</option>
        </select>
      </label>
    </div>

    <p class="ehv4-message" role="status"></p>
  `;

  const quicks=[
    ['all',LABEL.all,''],
    ['urgent',LABEL.urgent,''],
    ['overdue',LABEL.overdue,''],
    ['new',LABEL.new,''],
    ['appointment',LABEL.meeting,'']
  ];

  const quickRow=$('.ehv4-quick-row',panel);

  for(const [quick,label,status] of quicks){
    const button=document.createElement('button');
    button.type='button';
    button.dataset.quick=quick;
    button.dataset.status=status;
    button.textContent=label;
    quickRow.append(button);
  }

  const statusSelect=$('#ehv4-status',panel);

  statusSelect.add(new Option(LABEL.all,''));

  for(const status of statuses){
    statusSelect.add(new Option(status,status));
  }

  panel.addEventListener('click',event=>{
    const quick=event.target.closest('.ehv4-quick-row button');

    if(quick){
      state.quick=quick.dataset.quick;
      state.exactStatus=quick.dataset.status||'';

      syncQuickFilter(state.quick,state.exactStatus);
      updateActiveControls();
      refreshBoard();
      return;
    }

    const view=event.target.closest('[data-view]');
    if(view){
      setView(view.dataset.view);
      return;
    }

    if(event.target.closest('#ehv4-filter-toggle')){
      const advanced=$('.ehv4-advanced',panel);
      advanced.hidden=!advanced.hidden;

      $('#ehv4-filter-toggle',panel).setAttribute(
        'aria-expanded',String(!advanced.hidden)
      );
    }
  });

  $('#ehv4-search',panel).addEventListener('input',event=>{
    state.query=event.target.value;

    syncOriginal('search',state.query,'input');

    clearTimeout(state.timer);
    state.timer=setTimeout(refreshBoard,350);
  });

  $('#ehv4-sort',panel).addEventListener('change',event=>{
    syncOriginal('eh3-sort',event.target.value);
    refreshBoard();
  });

  statusSelect.addEventListener('change',event=>{
    state.quick='all';
    state.exactStatus=event.target.value;

    syncQuickFilter('all',state.exactStatus);
    updateActiveControls();
    refreshBoard();
  });

  panel.querySelectorAll('[data-sync]').forEach(input=>{
    const original=document.getElementById(input.dataset.sync);

    if(original)input.value=original.value;

    const eventName=input.type==='text'?'input':'change';

    input.addEventListener(eventName,()=>{
      syncOriginal(
        input.dataset.sync,input.value,eventName
      );

      clearTimeout(state.timer);
      state.timer=setTimeout(refreshBoard,350);
    });
  });

  return panel;
}

function groupForStatus(status) {
  return GROUPS.find(g=>g.statuses.includes(status));
}

function currentStatuses() {
  return new Set(statuses);
}

function resetBoardObservers() {
  state.boardObserver?.disconnect();
  state.boardObserver=null;

  for(const lane of state.lanes.values()){
    lane.element?.replaceChildren();
  }

  state.lanes.clear();
}

function createCard(lead) {
  const card=document.createElement('article');
  card.className='ehv4-card';
  card.dataset.id=String(lead.id);
  card.dataset.status=lead.status||'';
  card.draggable=!mobile();
  card.tabIndex=0;

  const title=document.createElement('strong');
  title.textContent=lead.name||'';

  const project=document.createElement('div');
  project.className='ehv4-secondary';
  project.textContent=lead.project||'';

  const phone=document.createElement('div');
  phone.className='ehv4-secondary ehv4-phone';
  phone.textContent=lead.phone||'';
  phone.hidden=!lead.phone;

  const status=document.createElement('small');
  status.className='ehv4-status';
  status.textContent=lead.status||'';

  const callio=document.createElement('div');
  callio.className='ehv4-callio';
  callio.textContent='Callio: \u0110ang ki\u1ec3m tra...';

  const due=document.createElement('div');
  due.className='ehv4-secondary';
  due.textContent=lead.next_followup
    ? 'Chăm sóc tiếp: '+lead.next_followup
    : LABEL.noDue;

  const actions=document.createElement('div');
  actions.className='ehv4-card-actions';

  const view=document.createElement('button');
  view.type='button';
  view.dataset.action='view';
  view.textContent=LABEL.view;

  const call=document.createElement('button');
  call.type='button';
  call.dataset.action='call';
  call.className='primary';
  call.textContent=LABEL.call;

  actions.append(view,call);

  if(mobile()){
    const change=document.createElement('button');
    change.type='button';
    change.dataset.action='change';
    change.textContent=LABEL.change;
    actions.prepend(change);
  }

  card.append(title,project,phone,status,callio,due,actions);
  return card;
}

/* Sprint 11A: RPC returns { [leadId]: {at,outcome,talk_seconds} }.
   Never infer "not called" from an empty verified match. */
async function hydrateCardCallio(leads,generation) {
  if(!leads.length)return;
  const ids=leads.map(lead=>String(lead.id));
  const put=(id,text)=>{
    for(const card of state.board?.querySelectorAll('.ehv4-card')||[]) {
      if(card.dataset.id!==id)continue;
      const label=card.querySelector('.ehv4-callio');
      if(label)label.textContent='Callio: '+text;
    }
  };
  try {
    const result=await rpc('crm_staff_callio_recent',{p_ids:ids});
    if(generation!==state.generation)return;
    const entries=(result&&typeof result==='object'&&!Array.isArray(result))
      ? result:{};
    const {formatRecentCallio}=await import('./callio-recent-display.js');
    if(generation!==state.generation)return;
    for(const id of ids){
      put(id,formatRecentCallio(entries[id]));
    }
  }catch(error){
    console.warn('Unable to read Callio recent for Kanban',error);
    if(generation!==state.generation)return;
    for(const id of ids)put(id,'Không thể tải, xem lịch sử hồ sơ');
  }
}
/* ELH_S11B_VISIBLE_CALLIO_REFRESH */
let ehCallioLastRefresh = 0;
let ehCallioRefreshing = false;
async function ehRefreshVisibleCallio(){
  if(ehCallioRefreshing || state.view!=='board' ||
     !state.board || state.board.hidden || document.hidden) return;
  const now=Date.now();
  if(now-ehCallioLastRefresh < 30000)return;
  ehCallioRefreshing=true;
  ehCallioLastRefresh=now;
  try{
    const cards=[...state.board.querySelectorAll('.ehv4-card[data-id]')];
    if(!cards.length)return;
    const ids=[...new Set(cards.map(card=>card.dataset.id).filter(Boolean))];
    const generation=state.generation;
    const {formatRecentCallio}=await import('./callio-recent-display.js');
    for(let i=0;i<ids.length;i+=50){
      const chunk=ids.slice(i,i+50);
      const rows=await rpc('crm_staff_callio_recent',{p_ids:chunk});
      if(generation!==state.generation || state.view!=='board')return;
      const data=rows&&typeof rows==='object'&&!Array.isArray(rows)?rows:{};
      for(const card of cards){
        if(!chunk.includes(card.dataset.id))continue;
        const line=card.querySelector('.ehv4-callio');
        if(line)line.textContent='Callio: '+formatRecentCallio(data[card.dataset.id]);
      }
    }
  }catch(error){
    // Never change statuses, wipe existing call labels, or block staff workflow.
    console.warn('Callio refresh deferred',error);
  }finally{ehCallioRefreshing=false;}
}
window.addEventListener('focus',()=>{void ehRefreshVisibleCallio();});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)void ehRefreshVisibleCallio();
});
function makeLane(group) {
  const section=document.createElement('section');
  section.className='ehv4-lane';
  section.dataset.group=group.id;

  const header=document.createElement('div');
  header.className='ehv4-lane-title';

  const title=document.createElement('strong');
  title.textContent=group.title;

  const count=document.createElement('span');
  count.className='ehv4-count';
  count.textContent='—';

  header.append(title,count);

  if(group.id==='closed'){
    const targets=document.createElement('div');
    targets.className='eh-swipe-closed-targets';
    for(const status of ['Booking','Không phù hợp']){
      if(!statuses.includes(status))continue;
      const target=document.createElement('div');
      target.dataset.dropStatus=status;
      target.textContent=status;
      target.setAttribute('aria-label','Thả vào '+status);
      targets.append(target);
    }
    section.append(targets);
  }

  const cards=document.createElement('div');
  cards.className='ehv4-lane-scroll';

  const more=document.createElement('button');
  more.type='button';
  more.className='ehv4-more';
  more.textContent=LABEL.more;

  more.onclick=()=>loadGroup(group.id);

  cards.addEventListener('scroll',()=>{
    if(cards.scrollTop+cards.clientHeight >=
       cards.scrollHeight-130){
      loadGroup(group.id);
    }
  });

  section.prepend(header);
  section.append(cards,more);

  state.lanes.set(group.id,{
    element:section,
    cards,
    more,
    count,
    busy:false,
    loaded:false,
    feeds:new Map(
      group.statuses.map(status=>[
        status,{
          cursor:null,
          hasMore:true
        }
      ])
    )
  });

  return section;
}

async function loadCounts() {
  const generation=state.generation;
  const params=filterParams();

  try {
    const rows=await rpc('crm_staff_kanban_counts_v1',{
      p_query:params.p_query,
      p_project:params.p_project,
      p_source:params.p_source,
      p_quick:params.p_quick,
      p_created_from:params.p_created_from,
      p_created_to:params.p_created_to,
      p_due_from:params.p_due_from,
      p_due_to:params.p_due_to,
      p_followup:params.p_followup
    });

    if(generation!==state.generation)return;

    state.counts=new Map(
      (Array.isArray(rows)?rows:[])
        .map(row=>[row.status,Number(row.total)])
    );

    for(const group of GROUPS){
      const lane=state.lanes.get(group.id);
      if(!lane)continue;

      const total=group.statuses.reduce(
        (sum,s)=>sum+(state.counts.get(s)||0),0
      );

      lane.count.textContent=String(total);
    }

    updateTabs();
  } catch(err) {
    notify(err.message);
  }
}

async function loadGroup(groupId) {
  const lane=state.lanes.get(groupId);

  if(!lane||lane.busy||state.view!=='board')return;

  const feeds=[...lane.feeds.entries()]
    .filter(([,f])=>f.hasMore);

  if(!feeds.length){
    lane.more.hidden=true;
    return;
  }

  lane.busy=true;
  lane.more.disabled=true;

  const generation=state.generation;
  const params=filterParams();

  try {
    const batches=await Promise.all(
      feeds.map(async ([status,feed])=>{
        const previous=JSON.stringify(feed.cursor);

        const result=await rpc('crm_staff_leads_v3',{
          ...params,
          p_status:status,
          p_cursor_rank:feed.cursor?.rank??null,
          p_cursor_sortkey:feed.cursor?.key??null,
          p_cursor_id:feed.cursor?.id??null,
          p_limit:10
        });

        return {
          status,
          items:Array.isArray(result?.items)?result.items:[],
          next:result?.nextCursor??null,
          hasMore:Boolean(result?.hasMore),
          previous
        };
      })
    );

    if(generation!==state.generation)return;

    const existing=new Set(
      [...lane.cards.querySelectorAll('.ehv4-card')]
        .map(card=>card.dataset.id)
    );

    const items=[];

    for(const batch of batches){
      const feed=lane.feeds.get(batch.status);

      feed.cursor=batch.next;
      feed.hasMore=batch.hasMore &&
        JSON.stringify(batch.next)!==batch.previous &&
        batch.items.length>0;

      for(const lead of batch.items){
        if(existing.has(String(lead.id)))continue;

        existing.add(String(lead.id));
        items.push(lead);
      }
    }

    items.sort((a,b)=>
      new Date(b.created_at||0)-
      new Date(a.created_at||0)
    );

    for(const lead of items){
      lane.cards.append(createCard(lead));
    }

    hydrateCardCallio(items,generation);

    lane.loaded=true;
    lane.more.hidden=![...lane.feeds.values()]
      .some(f=>f.hasMore);

    if(!lane.cards.children.length){
      const empty=document.createElement('p');
      empty.className='ehv4-empty';
      empty.textContent=LABEL.empty;
      lane.cards.append(empty);
    }
  } catch(err) {
    notify(err.message);
  } finally {
    if(generation===state.generation){
      lane.busy=false;
      lane.more.disabled=false;
    }
  }
}

function updateTabs() {
  const tabs=$('.ehv4-mobile-tabs',state.board);
  if(!tabs)return;

  tabs.replaceChildren();

  for(const group of GROUPS){
    if(group.id==='closed'&&!state.showClosed)continue;

    const button=document.createElement('button');
    button.type='button';
    button.textContent=group.title;

    const total=group.statuses.reduce(
      (sum,s)=>sum+(state.counts.get(s)||0),0
    );

    if(state.counts.size){
      button.textContent+=' ('+total+')';
    }

    button.classList.toggle(
      'active',group.id===state.activeGroup
    );

    button.onclick=()=>{
      state.activeGroup=group.id;
      updateMobileLanes();
      updateTabs();
      loadGroup(group.id);
    };

    tabs.append(button);
  }
}

function updateMobileLanes() {
  if(!mobile())return;

  for(const [id,lane] of state.lanes){
    lane.element.hidden=id!==state.activeGroup;
  }
}

function refreshBoard() {
  if(state.view!=='board'||!state.board)return;

  state.generation++;
  resetBoardObservers();

  const track=$('.ehv4-board-track',state.board);
  track.replaceChildren();

  const groups=GROUPS.filter(
    g=>g.id!=='closed'||state.showClosed
  );

  for(const group of groups){
    if(state.exactStatus &&
       !group.statuses.includes(state.exactStatus)){
      continue;
    }

    track.append(makeLane(group));
  }

  if(!state.lanes.has(state.activeGroup)){
    state.activeGroup=[...state.lanes.keys()][0]||'new';
  }

  updateMobileLanes();
  updateTabs();
  loadCounts();

  if(mobile()){
    loadGroup(state.activeGroup);
    return;
  }

  if('IntersectionObserver' in window){
    state.boardObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(entry.isIntersecting){
          loadGroup(entry.target.dataset.group);
        }
      }
    },{
      root:track,
      rootMargin:'0px 180px',
      threshold:0.01
    });

    for(const lane of state.lanes.values()){
      state.boardObserver.observe(lane.element);
    }
  } else {
    for(const id of state.lanes.keys()){
      loadGroup(id);
    }
  }
}

function setView(view) {
  if(!['list','board'].includes(view))return;

  state.view=view;
  state.board.hidden=view!=='board';

  const table=$('.table-scroll',state.workspace);
  const footer=$('.table-card footer',state.workspace);

  table?.classList.toggle('ehv4-hidden',view==='board');
  footer?.classList.toggle('ehv4-hidden',view==='board');

  updateActiveControls();

  sessionStorage.setItem(
    'elh-v4-view-'+state.profile.id,view
  );

  if(view==='board'){
    refreshBoard();
  } else {
    state.generation++;
    resetBoardObservers();
    document.getElementById('refresh')?.click();
  }
}

/* ELH_SPRINT10B_SWIPE_V1 */
const ehSwipeDelay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function ehSwipeDestination(groupId,oldStatus){
  const group=GROUPS.find(item=>item.id===groupId);
  if(!group)return null;
  // Preserve an existing status when a card is dropped in its own group.
  if(group.statuses.includes(oldStatus))return oldStatus;
  if(groupId==='closed')return null; // two explicit drop targets; no guessing.
  const preferred={
    new:['Chưa liên hệ','Mới'],
    care:['Đã liên hệ'],
    interest:['Có nhu cầu','Đang tư vấn'],
    meeting:['Hẹn gặp']
  }[groupId]||[];
  return preferred.find(item=>group.statuses.includes(item)&&statuses.includes(item))
    ||group.statuses.find(item=>statuses.includes(item))||null;
}

function ehSwipeClearDrag(){
  state.board?.querySelectorAll('.eh-swipe-dragging,.eh-swipe-target,.eh-swipe-target-exact')
    .forEach(element=>element.classList.remove('eh-swipe-dragging','eh-swipe-target','eh-swipe-target-exact'));
}

function ehSwipeAnimate(card){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  card.animate([
    {opacity:.72,transform:'translateY(-10px) scale(.96) rotate(-2deg)'},
    {opacity:1,transform:'translateY(0) scale(1) rotate(0deg)'}
  ],{duration:320,easing:'cubic-bezier(.2,.85,.25,1)'});
}

function ehSwipeSetCount(groupId){
  const lane=state.lanes.get(groupId);
  if(!lane)return;
  const group=GROUPS.find(item=>item.id===groupId);
  if(!group)return;
  lane.count.textContent=String(group.statuses.reduce(
    (total,item)=>total+(state.counts.get(item)||0),0
  ));
}

async function ehSwipeMove(card,targetStatus){
  if(!card||state.moving||!statuses.includes(targetStatus))return;
  const id=card.dataset.id;
  const previousStatus=card.dataset.status;
  const from=groupForStatus(previousStatus);
  const to=groupForStatus(targetStatus);
  if(!from||!to||!id||previousStatus===targetStatus)return;
  const originLane=state.lanes.get(from.id);
  let destinationLane=state.lanes.get(to.id);
  if(!destinationLane){
    // Opening a collapsed terminal group does not require a second click.
    state.showClosed=state.showClosed||to.id==='closed';
    const track=state.board?.querySelector('.ehv4-board-track');
    if(!track){notify('Không thể mở cột đích.');return;}
    track.append(makeLane(to));
    destinationLane=state.lanes.get(to.id);
    const closedButton=state.board?.querySelector('.ehv4-closed');
    if(closedButton&&to.id==='closed')closedButton.textContent=LABEL.hideClosed;
    updateTabs();
  }
  if(mobile()){
    state.activeGroup=to.id;
    updateMobileLanes();
    updateTabs();
  }
  // Optimistic visual move, then authoritative versioned RPC mutation.
  const oldParent=card.parentNode;
  const next=card.nextSibling;
  state.moving=true;
  card.classList.add('eh-swipe-saving');
  const oldLabel=card.querySelector('.ehv4-status')?.textContent||previousStatus;
  destinationLane.cards.prepend(card);
  card.dataset.status=targetStatus;
  const statusLabel=card.querySelector('.ehv4-status');
  if(statusLabel)statusLabel.textContent=targetStatus;
  ehSwipeAnimate(card);
  notify('Đang chuyển khách...');
  try{
    const data=await rpc('crm_detail',{p_id:id});
    const lead=data?.lead;
    if(!lead||lead.status!==previousStatus)throw Error(LABEL.changed);
    await mutate('crm_update',{
      p_id:id,
      p_version:lead.version,
      p_status:targetStatus,
      p_next:lead.next_followup||null,
      p_note:lead.notes??lead.note??''
    });
    state.counts.set(previousStatus,Math.max(0,(state.counts.get(previousStatus)||0)-1));
    state.counts.set(targetStatus,(state.counts.get(targetStatus)||0)+1);
    ehSwipeSetCount(from.id);
    ehSwipeSetCount(to.id);
    updateTabs();
    notify('Đã chuyển sang '+targetStatus+'.');
    // Keep the card in its new lane. No board reload or page jump.
    // List will read authoritative data on the next List switch.
    card.classList.remove('eh-swipe-saving');
  }catch(error){
    card.dataset.status=previousStatus;
    if(statusLabel)statusLabel.textContent=oldLabel;
    if(oldParent?.isConnected){
      if(next?.parentNode===oldParent)oldParent.insertBefore(card,next);
      else oldParent.appendChild(card);
    }
    ehSwipeAnimate(card);
    notify((error?.message||'Không thể cập nhật')+' · Đã hoàn tác.');
  }finally{
    card.classList.remove('eh-swipe-saving');
    state.moving=false;
    ehSwipeClearDrag();
  }
}

// On mobile: tapping the requested destination applies instantly (no Save step).
function ehSwipeMobileSheet(card){
  if(document.querySelector('.eh-swipe-sheet'))return;
  const overlay=document.createElement('div');
  overlay.className='eh-swipe-sheet';
  const sheet=document.createElement('section');
  sheet.className='eh-swipe-sheet-content';
  sheet.setAttribute('role','dialog');
  sheet.setAttribute('aria-modal','true');
  sheet.setAttribute('aria-label','Chuyển khách sang nhóm');
  const title=document.createElement('strong');
  title.textContent='Chuyển khách sang';
  sheet.append(title);
  const entries=GROUPS.flatMap(group=>{
    if(group.id==='closed')return group.statuses.map(status=>({label:status,status}));
    const status=ehSwipeDestination(group.id,card.dataset.status);
    return status?[{label:group.title,status}]:[];
  });
  const seen=new Set();
  for(const entry of entries){
    if(entry.status===card.dataset.status||seen.has(entry.status))continue;
    seen.add(entry.status);
    const button=document.createElement('button');
    button.type='button';
    button.textContent=entry.label;
    button.onclick=()=>{overlay.remove(); void ehSwipeMove(card,entry.status);};
    sheet.append(button);
  }
  const cancel=document.createElement('button');
  cancel.type='button';
  cancel.textContent='Đóng';
  cancel.className='eh-swipe-cancel';
  cancel.onclick=()=>overlay.remove();
  sheet.append(cancel);
  overlay.append(sheet);
  overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.remove();});
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape')overlay.remove();});
  document.body.append(overlay);
  sheet.querySelector('button')?.focus();
}


async function openDetail(id) {
  const module=await import('./customer-detail-page.js');

  await module.openCustomerDetailPage({
    id,
    rpc,
    mutate,
    statuses,
    profile:state.profile,
    onSaved:async()=>{
      refreshBoard();
      document.getElementById('refresh')?.click();
    }
  });
}

async function callLead(id) {
  const module=await import('./callio.js');

  if(typeof module.callLead!=='function'){
    throw Error('Callio unavailable');
  }

  const result=await module.callLead(id);
  if(result)notify(String(result));
}

function bindBoardEvents() {
  const board=state.board;
  board.addEventListener('click',async event=>{
    const button=event.target.closest('button[data-action]');
    const card=event.target.closest('.ehv4-card');
    if(!card)return;
    if(button){
      try{
        if(button.dataset.action==='call')await callLead(card.dataset.id);
        else if(button.dataset.action==='view')await openDetail(card.dataset.id);
        else if(button.dataset.action==='change')ehSwipeMobileSheet(card);
      }catch(error){notify(error?.message||'Không thể thực hiện thao tác.');}
      return;
    }
    if(mobile()){
      try{await openDetail(card.dataset.id);}catch(error){notify(error?.message);}
    }
  });

  board.addEventListener('dragstart',event=>{
    if(mobile()||state.moving)return;
    const card=event.target.closest('.ehv4-card');
    if(!card)return;
    card.classList.add('eh-swipe-dragging');
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('application/x-elh-customer',JSON.stringify({
      id:card.dataset.id,status:card.dataset.status
    }));
  });
  board.addEventListener('dragend',ehSwipeClearDrag);
  board.addEventListener('dragover',event=>{
    if(mobile()||state.moving)return;
    const target=event.target.closest('[data-drop-status]');
    const lane=event.target.closest('.ehv4-lane');
    if(!lane)return;
    if(lane.dataset.group==='closed'&&!target)return;
    event.preventDefault();
    event.dataTransfer.dropEffect='move';
    ehSwipeClearDrag();
    lane.classList.add('eh-swipe-target');
    target?.classList.add('eh-swipe-target-exact');
  });
  board.addEventListener('drop',event=>{
    if(mobile()||state.moving)return;
    const target=event.target.closest('[data-drop-status]');
    const lane=event.target.closest('.ehv4-lane');
    if(!lane)return;
    event.preventDefault();
    ehSwipeClearDrag();
    try{
      const payload=JSON.parse(event.dataTransfer.getData('application/x-elh-customer'));
      const card=[...board.querySelectorAll('.ehv4-card')]
        .find(item=>item.dataset.id===payload.id);
      if(!card||card.dataset.status!==payload.status)return;
      if(lane.dataset.group==='closed'&&!target){
        notify('Thả vào Booking hoặc Không phù hợp.');return;
      }
      const status=target?.dataset.dropStatus
        ||ehSwipeDestination(lane.dataset.group,card.dataset.status);
      if(status)void ehSwipeMove(card,status);
    }catch(error){notify(error?.message||'Không thể di chuyển.');}
  });

  // Preserve existing lazy-loading behaviour on mobile.
  board.addEventListener('scroll',()=>{
    if(!mobile())return;
    const lane=state.lanes.get(state.activeGroup);
    if(!lane)return;
    if(lane.element.getBoundingClientRect().bottom<innerHeight+150)
      loadGroup(state.activeGroup);
  },{passive:true});
}


function checkKanbanPageScroll(){
  if(state.view!=='board')return;
  if(!state.board||state.board.hidden)return;

  for(const [id,lane] of state.lanes){
    if(lane.busy||lane.more.hidden)continue;

    const rect=lane.more.getBoundingClientRect();

    if(rect.top<window.innerHeight+300 &&
       rect.bottom>-100){
      loadGroup(id);
    }
  }
}

let kanbanScrollScheduled=false;

function scheduleKanbanScroll(){
  if(kanbanScrollScheduled)return;

  kanbanScrollScheduled=true;

  requestAnimationFrame(()=>{
    kanbanScrollScheduled=false;
    checkKanbanPageScroll();
  });
}

document.addEventListener(
  'scroll',
  scheduleKanbanScroll,
  {capture:true,passive:true}
);

window.addEventListener(
  'scroll',
  scheduleKanbanScroll,
  {passive:true}
);
function mount() {
  const workspace=document.querySelector(
    '#app .workspace.eh3-staff'
  );

  if(!workspace)return;
  if(workspace===state.workspace&&state.panel?.isConnected)return;

  if(state.mounting)return;
  state.mounting=true;

  rpc('crm_profile').then(profile=>{
    if(profile?.role!=='TELESALES')return;
    if(!workspace.isConnected)return;

    const table=$('.table-card',workspace);
    const tableScroll=$('.table-scroll',table);
    const oldControls=$('.eh3-controls',workspace);

    if(!table||!tableScroll||!oldControls)return;

    state.workspace=workspace;
    state.profile=profile;

    workspace.classList.add('ehv4-active');

    $('#page-title',workspace).textContent=LABEL.title;

    workspace.querySelectorAll(
      '.sidebar [data-mode="today"],' +
      '.sidebar [data-mode="overdue"],' +
      '.mobile-nav [data-mode="today"],' +
      '.mobile-nav [data-mode="overdue"]'
    ).forEach(node=>node.remove());

    setupHeader(workspace);

    state.panel=makePanel();
    table.insertBefore(state.panel,tableScroll);

    state.board=document.createElement('section');
    state.board.className='ehv4-board';
    state.board.hidden=true;

    state.board.innerHTML=`
      <div class="ehv4-board-top">
        
        <button type="button" class="ehv4-closed">
          ${LABEL.hideClosed}
        </button>
      </div>
      <div class="ehv4-mobile-tabs"></div>
      <div class="ehv4-board-track"></div>
    `;

    state.panel.after(state.board);

    $('.ehv4-closed',state.board).onclick=()=>{
      state.showClosed=!state.showClosed;

      $('.ehv4-closed',state.board).textContent=
        state.showClosed
          ? LABEL.hideClosed
          : LABEL.showClosed;

      refreshBoard();
    };

    bindBoardEvents();

    state.view=sessionStorage.getItem(
      'elh-v4-view-'+profile.id
    )||'list';

    setView(state.view);
    updateActiveControls();

  }).catch(console.error).finally(()=>{
    state.mounting=false;
  });
}

function start() {
  let scheduled=false;

  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;

    queueMicrotask(()=>{
      scheduled=false;
      mount();
    });
  });

  observer.observe(document.querySelector('#app'),{
    childList:true,
    subtree:true
  });

  mount();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',start,{once:true});
}else{
  start();
}