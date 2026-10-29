import './customer-detail-page.css';
import { mapCallioToActivities, mergeHistoryEvents, summarizeCallio } from './callio-history-adapter.js';

const T = {
  list:'Danh s\u00e1ch kh\u00e1ch h\u00e0ng',
  detail:'Chi ti\u1ebft kh\u00e1ch h\u00e0ng',
  current:'Th\u00f4ng tin kh\u00e1ch h\u00e0ng',
  history:'L\u1ecbch s\u1eed t\u01b0\u01a1ng t\u00e1c',
  phone:'S\u1ed1 \u0111i\u1ec7n tho\u1ea1i',
  project:'D\u1ef1 \u00e1n quan t\u00e2m',
  source:'Ngu\u1ed3n kh\u00e1ch h\u00e0ng',
  unit:'M\u00e3 c\u0103n',
  quality:'Ch\u1ea5t l\u01b0\u1ee3ng s\u1ed1',
  need:'Nhu c\u1ea7u kh\u00e1ch h\u00e0ng',
  sourceNote:'Ghi ch\u00fa ngu\u1ed3n',
  sourceData:'Ngu\u1ed3n d\u1eef li\u1ec7u',
  sourceRating:'\u0110\u00e1nh gi\u00e1 ngu\u1ed3n',
  status:'Tr\u1ea1ng th\u00e1i',
  next:'L\u1ea7n ch\u0103m s\u00f3c ti\u1ebfp theo',
  note:'Ghi ch\u00fa hi\u1ec7n t\u1ea1i',
  save:'L\u01b0u c\u1eadp nh\u1eadt',
  saving:'\u0110ang l\u01b0u...',
  saved:'\u0110\u00e3 l\u01b0u c\u1eadp nh\u1eadt.',
  all:'T\u1ea5t c\u1ea3 t\u01b0\u01a1ng t\u00e1c',
  care:'Ch\u0103m s\u00f3c',
  assigned:'Ph\u00e2n b\u1ed5',
  created:'T\u1ea1o m\u1edbi',
  call:'Cu\u1ed9c g\u1ecdi',
  more:'Xem l\u1ecbch s\u1eed tr\u01b0\u1edbc',
  empty:'Ch\u01b0a c\u00f3 l\u1ecbch s\u1eed ghi nh\u1eadn',
  actor:'Ng\u01b0\u1eddi th\u1ef1c hi\u1ec7n',
  unknown:'Ch\u01b0a x\u00e1c \u0111\u1ecbnh',
  discard:'B\u1ecf thay \u0111\u1ed5i ch\u01b0a l\u01b0u?',
  loading:'\u0110ang t\u1ea3i...',
  loadError:'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c l\u1ecbch s\u1eed.'
};

const STATUS = new Map([
  ['M\u1edbi',['#eff4ff','#245fe5']],
  ['Ch\u01b0a li\u00ean h\u1ec7',['#eff4ff','#325dff']],
  ['Kh\u00f4ng nghe m\u00e1y',['#fff4df','#a96700']],
  ['\u0110\u00e3 li\u00ean h\u1ec7',['#e9f5ff','#216ba5']],
  ['\u0110ang ch\u0103m s\u00f3c',['#e9f5ff','#216ba5']],
  ['C\u00f3 nhu c\u1ea7u',['#e6f8ed','#16834a']],
  ['H\u1eb9n g\u1eb7p',['#fff0de','#b87013']],
  ['\u0110ang t\u01b0 v\u1ea5n',['#f1edff','#7252bc']],
  ['Kh\u00f4ng ph\u00f9 h\u1ee3p',['#fdebec','#c73546']],
  ['Booking',['#dff7ee','#087d57']]
]);

const hasValue = v =>
  v !== null &&
  v !== undefined &&
  String(v).trim() !== '';

const escapeHTML = value =>
  String(value ?? '').replace(/[&<>"']/g,ch=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[ch]));

function statusTheme(status) {
  return STATUS.get(status) || ['#f1f5f9','#475569'];
}

function statusBadge(status) {
  const [background,color] = statusTheme(status);

  const badge = document.createElement('span');
  badge.className = 'eh4-status';
  badge.textContent = status || T.unknown;
  badge.style.background = background;
  badge.style.color = color;

  return badge;
}

function formatTime(value) {
  if(!hasValue(value)) return '';

  const date = new Date(value);

  if(Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('vi-VN',{
    timeZone:'Asia/Ho_Chi_Minh'
  });
}

function formatDay(value) {
  const date = new Date(value);

  if(Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('vi-VN',{
    timeZone:'Asia/Ho_Chi_Minh'
  });
}

function activityLabel(activity) {
  const kind = String(activity?.kind||'').toUpperCase();

  if(kind==='UPDATE') return T.care;
  if(kind==='ASSIGN') return T.assigned;
  if(kind==='CREATE'||kind==='INTAKE') return T.created;
  if(kind==='CALLIO') return T.call;

  return activity.kind || 'CRM';
}

function activityChannel(activity) {
  const explicit = String(
    activity?.channel ||
    activity?.provider ||
    activity?.source_system ||
    ''
  ).toLowerCase();

  if(explicit==='callio' || activity?.callio_id) {
    return 'Callio';
  }

  return 'CRM';
}

function activityActor(activity,profile) {
  const value =
    activity?.actor_name ||
    activity?.performed_by_name ||
    activity?.performed_by ||
    activity?.user_name;

  if(hasValue(value) &&
     !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(value))) {
    return String(value);
  }

  const id = activity?.actor || activity?.user_id;

  if(id && profile?.id && id===profile.id) {
    return profile.name;
  }

  return '';
}

function makeField(label,value) {
  if(!hasValue(value)) return null;

  const item=document.createElement('div');
  item.className='eh4-field';

  const title=document.createElement('small');
  title.textContent=label;

  const body=document.createElement('div');
  body.className='eh4-field-value';
  body.textContent=String(value);

  item.append(title,body);
  return item;
}

function normalizedSource(lead) {
  if(!hasValue(lead?.source)) return '';

  // Do not mistake an identical project value
  // for an independently verified marketing source.
  if(String(lead.source).trim().toLowerCase()===
     String(lead.project||'').trim().toLowerCase()) {
    return '';
  }

  return lead.source;
}

export async function openCustomerDetailPage({
  id,rpc,mutate,statuses,profile,onSaved
}) {
  const content=document.querySelector(
    '.workspace > main.content'
  );

  if(!content) {
    throw Error('CRM content not found');
  }

  // Existing authorized RPC; never bypass RLS.
  const data=await rpc('crm_detail',{p_id:id});

  if(!data?.lead) {
    throw Error('Customer not found or access denied');
  }

  const lead=data.lead;
  const legacy=lead.legacy_data?.customer||{};
  const source=normalizedSource(lead);

  const scrollY=window.scrollY;
  const contentScroll=content.scrollTop;

  const listScroll=content.querySelector('.table-scroll');
  const listScrollTop=listScroll?.scrollTop||0;

  const previous=[...content.children].map(el=>({
    el,
    hidden:el.hidden,
    display:el.style.display
  }));

  previous.forEach(x=>{
    x.el.hidden=true;
    x.el.style.display='none';
  });

  const page=document.createElement('section');
  page.className='eh4-page';
  content.append(page);

  let closed=false;
  let dirty=false;
  let saving=false;
  let version=lead.version;

  let activities=Array.isArray(data.history)
    ? [...data.history] : [];

  let historyOffset=activities.length;
  let hasMore=activities.length>=50;
  let loadingHistory=false;
  let callioRows=[];
  let callioCursor=null;
  let callioHasMore=false;
  let callioLoading=false;
  const seenCallioIds=new Set();

  const originalUrl=location.href;

  function restore() {
    if(closed) return;
    closed=true;

    window.removeEventListener('popstate',onPopState);
    page.remove();

    previous.forEach(x=>{
      x.el.hidden=x.hidden;
      x.el.style.display=x.display;
    });

    requestAnimationFrame(()=>{
      window.scrollTo(0,scrollY);
      content.scrollTop=contentScroll;

      if(listScroll) {
        listScroll.scrollTop=listScrollTop;
      }
    });
  }

  function onPopState() {
    if(dirty && !confirm(T.discard)) {
      history.pushState(
        {elhDetailId:id},
        '',
        '#khach-hang/'+encodeURIComponent(id)
      );
      return;
    }

    restore();
  }

  history.pushState(
    {elhDetailId:id},
    '',
    '#khach-hang/'+encodeURIComponent(id)
  );

  window.addEventListener('popstate',onPopState);

  page.innerHTML=`
    <nav class="eh4-breadcrumb" aria-label="Breadcrumb">
      <button type="button" class="eh4-back">
        ${T.list}
      </button>
      <span aria-hidden="true">/</span>
      <strong>${T.detail}</strong>
    </nav>

    <header class="eh4-header">
      <div class="eh4-avatar">
        ${escapeHTML((lead.name||'K').slice(0,1))}
      </div>

      <div class="eh4-heading">
        <small>${T.detail}</small>
        <h1>${escapeHTML(lead.name)}</h1>
        <div class="eh4-meta"></div>
      </div>

      <div class="eh4-header-status"></div>
    </header>

    <div class="eh4-grid">
      <section class="eh4-card">
        <h2>${T.current}</h2>
        <div class="eh4-fields"></div>

        <form id="eh4-form">
          <div class="eh4-form-grid">
            <label class="eh4-input">
              <span>${T.status}</span>
              <select name="status" required></select>
            </label>

            <label class="eh4-input">
              <span>${T.next}</span>
              <input name="next" type="date">
            </label>
          </div>

          <label class="eh4-input eh4-note">
            <span>${T.note}</span>
            <textarea name="note" rows="5"
              maxlength="10000"></textarea>
          </label>

          <p class="eh4-message" role="status"></p>

          <button type="submit" class="eh4-save">
            ${T.save}
          </button>
        </form>
      </section>

      <section class="eh4-card eh4-history-card">
        <div class="eh4-history-header">
          <div>
            <h2>${T.history}</h2>
            <small class="eh4-count"></small>
          </div>

          <select class="eh4-filter"
            aria-label="${T.history}">
            <option value="">${T.all}</option>
            <option value="UPDATE">${T.care}</option>
            <option value="ASSIGN">${T.assigned}</option>
            <option value="CREATE">${T.created}</option>
            <option value="CALLIO">Callio</option>
          </select>
        </div>

        <div class="eh4-history"></div>

        <button type="button" class="eh4-more">
          ${T.more}
        </button>
      </section>
    </div>
  `;

  page.querySelector('.eh4-back').onclick=()=>{
    if(dirty && !confirm(T.discard)) return;

    dirty=false;

    if(history.state?.elhDetailId===id) {
      history.back();
    } else {
      history.replaceState(null,'',originalUrl);
      restore();
    }
  };

  // Header: only real and non-empty values.
  const meta=page.querySelector('.eh4-meta');

  const ownerName =
    lead.owner_name ||
    lead.assigned_name ||
    (lead.assigned_to===profile?.id ? profile.name : '');

  for(const value of [
    lead.phone,lead.project,source,ownerName
  ]) {
    if(!hasValue(value)) continue;

    const span=document.createElement('span');
    span.textContent=String(value);
    meta.append(span);
  }

  // Merge useful legacy data into current information.
  // Do not modify original database values.
  const currentFields=[
    [T.phone,lead.phone],
    [T.project,lead.project],
    [T.source,source],
    [T.unit,legacy.Unit_Code],
    [T.quality,legacy.Phone_Status],
    [T.need,legacy.Customer_Need],
    [T.sourceNote,legacy.Followup_Notes],
    [T.sourceData,legacy.Source_Sheet],
    [T.sourceRating,legacy.Quality_Flag]
  ];

  const fields=page.querySelector('.eh4-fields');

  for(const [label,value] of currentFields) {
    if(label===T.sourceNote &&
       String(value||'').trim()===String(lead.notes||'').trim()) {
      continue;
    }

    const node=makeField(label,value);
    if(node)fields.append(node);
  }

  const form=page.querySelector('#eh4-form');
  const statusSelect=form.elements.status;
  const nextInput=form.elements.next;
  const noteInput=form.elements.note;
  const message=page.querySelector('.eh4-message');
  const save=form.querySelector('.eh4-save');

  const validStatuses=new Set(statuses||[]);
  if(hasValue(lead.status)) {
    validStatuses.add(lead.status);
  }

  for(const status of validStatuses) {
    const option=document.createElement('option');
    option.value=status;
    option.textContent=status;
    statusSelect.append(option);
  }

  statusSelect.value=lead.status||'';
  nextInput.value=lead.next_followup||'';
  noteInput.value=lead.notes||'';

  function refreshStatus() {
    const container=page.querySelector(
      '.eh4-header-status'
    );

    container.replaceChildren();

    if(hasValue(statusSelect.value)) {
      container.append(statusBadge(statusSelect.value));
    }

    const [bg,fg]=statusTheme(statusSelect.value);
    statusSelect.style.background=bg;
    statusSelect.style.color=fg;
  }

  refreshStatus();

  statusSelect.onchange=()=>{
    dirty=true;
    refreshStatus();
  };

  nextInput.oninput=()=>{dirty=true;};
  noteInput.oninput=()=>{dirty=true;};

  const timeline=page.querySelector('.eh4-history');
  const historyFilter=page.querySelector('.eh4-filter');
  const more=page.querySelector('.eh4-more');
  const count=page.querySelector('.eh4-count');
  // Callio has its own cursor. No writes to CRM statuses or activities.
  const callioMore=document.createElement('button');
  callioMore.type='button';
  callioMore.className='eh4-more eh6-callio-more';
  callioMore.textContent='Tải thêm cuộc gọi Callio';
  callioMore.hidden=true;
  more.after(callioMore);
  const callioNote=document.createElement('small');
  callioNote.className='eh6-callio-note';
  count.after(callioNote);

  function renderTimeline() {
    timeline.replaceChildren();

    const filtered=mergeHistoryEvents(activities,mapCallioToActivities(callioRows))
      .filter(a=>!historyFilter.value ||
        String(a.kind||'').toUpperCase()===historyFilter.value)
      .sort((a,b)=>
        new Date(b.created_at)-new Date(a.created_at));

    count.textContent=`${activities.length + callioRows.length} hoạt động đã tải`;
    callioMore.hidden=!callioHasMore;

    if(!filtered.length) {
      const empty=document.createElement('p');
      empty.className='eh4-empty';
      empty.textContent=T.empty;
      timeline.append(empty);
    }

    let previousDay='';

    for(const activity of filtered) {
      const day=formatDay(activity.created_at);

      if(day!==previousDay) {
        const heading=document.createElement('h3');
        heading.className='eh4-day';
        heading.textContent=day;
        timeline.append(heading);
        previousDay=day;
      }

      const event=document.createElement('article');
      event.className='eh4-event';

      const top=document.createElement('div');
      top.className='eh4-event-top';

      const date=document.createElement('small');
      date.textContent=formatTime(activity.created_at);

      const type=document.createElement('strong');
      type.textContent=activityLabel(activity);

      top.append(date,type);
      event.append(top);

      if(hasValue(activity.status)) {
        event.append(statusBadge(activity.status));
      }

      if(hasValue(activity.note)) {
        const note=document.createElement('p');
        note.textContent=activity.note;
        event.append(note);
      }

      const actor=activityActor(activity,profile);

      if(hasValue(actor)) {
        const person=document.createElement('small');
        person.className='eh4-event-actor';
        person.textContent=T.actor+': '+actor;
        event.append(person);
      }

      // Callio is shown only if the activity itself
      // explicitly carries a verified Callio origin.
      const channel=activityChannel(activity);

      if(channel==='Callio') {
        const sourceLabel=document.createElement('small');
        sourceLabel.className='eh4-channel';
        sourceLabel.textContent='Callio';
        event.append(sourceLabel);
      }

      timeline.append(event);
    }

    more.hidden=!hasMore;
  }

  async function loadCallioHistory(reset=false) {
    if(closed||callioLoading)return;
    if(!reset&&!callioHasMore)return;
    callioLoading=true;
    callioMore.disabled=true;
    try {
      const response=await rpc('crm_callio_lead_history',{
        p_id:id,
        p_limit:20,
        p_before_at:reset?null:callioCursor?.at??null,
        p_before_id:reset?null:callioCursor?.id??null
      });
      if(closed)return;
      const batch=Array.isArray(response?.items)?response.items:[];
      if(reset){callioRows=[];seenCallioIds.clear();}
      for(const record of batch){
        const rid=String(record.id||'');
        if(!rid||seenCallioIds.has(rid))continue;
        seenCallioIds.add(rid);
        callioRows.push(record);
      }
      callioCursor=response?.nextCursor||null;
      callioHasMore=Boolean(response?.hasMore&&callioCursor);
      callioNote.textContent=summarizeCallio(callioRows);
      renderTimeline();
    }catch(err){
      // CRM continues working even when the read-only Callio RPC is unavailable.
      callioNote.textContent='Callio chưa khả dụng: '+(err?.message||'RPC error');
      callioHasMore=false;
      callioMore.hidden=true;
    }finally{
      callioLoading=false;
      callioMore.disabled=false;
    }
  }

  callioMore.onclick=()=>loadCallioHistory(false);

  async function loadHistory() {
    if(closed||loadingHistory||!hasMore)return;

    loadingHistory=true;
    more.disabled=true;

    try {
      const response=await rpc('crm_activity_page',{
        p_id:id,
        p_offset:historyOffset
      });

      if(closed)return;

      const batch=Array.isArray(response)?response:[];

      activities.push(...batch);
      historyOffset+=batch.length;
      hasMore=batch.length>=50;

      renderTimeline();
    } catch(err) {
      message.textContent=err.message||T.loadError;
    } finally {
      loadingHistory=false;
      more.disabled=false;
    }
  }

  historyFilter.onchange=renderTimeline;
  more.onclick=loadHistory;

  timeline.addEventListener('scroll',()=>{
    if(timeline.scrollTop+timeline.clientHeight >=
       timeline.scrollHeight-140) {
      if(hasMore)loadHistory();
      else if(callioHasMore)loadCallioHistory(false);
    }
  });

  renderTimeline();
  void loadCallioHistory(true);

  form.onsubmit=async event=>{
    event.preventDefault();

    if(saving)return;
    saving=true;
    save.disabled=true;
    message.textContent=T.saving;

    try {
      // Only submit fields supported by current RPC.
      const result=await mutate('crm_update',{
        p_id:id,
        p_version:version,
        p_status:statusSelect.value,
        p_next:nextInput.value||null,
        p_note:noteInput.value
      });

      dirty=false;
      message.textContent=T.saved;

      // Refresh from authoritative data after save.
      try {
        const updated=await rpc('crm_detail',{p_id:id});

        if(updated?.lead) {
          version=updated.lead.version;
        } else {
          version=result?.version??version;
        }

        if(Array.isArray(updated?.history)) {
          activities=[...updated.history];
          historyOffset=activities.length;
          hasMore=activities.length>=50;
          renderTimeline();
        }
      } catch(refreshError) {
        version=result?.version??version;
        console.warn('History refresh failed',refreshError);
      }

      if(typeof onSaved==='function') {
        try {
          await onSaved(id,statusSelect.value);
        } catch(refreshError) {
          console.warn('List summary refresh failed',refreshError);
        }
      }
    } catch(err) {
      message.textContent=err.message||'Update failed';
    } finally {
      saving=false;
      save.disabled=false;
    }
  };
}