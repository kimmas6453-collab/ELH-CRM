import './kanban-magnetic-dnd.css';
import {rpc,mutate} from './api.js';

/* ELH_STATUS_MAPPING_10D */
const GROUPS = {
  new: 'Ch\u01B0a li\u00EAn h\u1EC7',
  care: '\u0110\u00E3 li\u00EAn h\u1EC7',
  interest: 'C\u00F3 nhu c\u1EA7u'
};

const CLOSED = 'closed';
const SNAP_DISTANCE = 72;
const DRAG_THRESHOLD = 8;

let drag = null;
let busy = false;
let suppressClickUntil = 0;

function isDesktop() {
  return window.matchMedia('(min-width:768px)').matches;
}

function board() {
  return document.querySelector(
    '.workspace.ehv4-active .ehv4-board:not([hidden])'
  );
}

function message(text) {
  const target=document.querySelector(
    '.ehv4-message'
  );
  if(target)target.textContent=text||'';
}

function allLanes() {
  const root=board();
  return root
    ? [...root.querySelectorAll('.ehv4-lane')]
    : [];
}

function removeHighlights() {
  document.querySelectorAll(
    '.ehv4-lane.ehmag-target'
  ).forEach(el=>el.classList.remove('ehmag-target'));
}

function enableCards() {
  if(!isDesktop())return;

  document.querySelectorAll(
    '.workspace.ehv4-active .ehv4-card'
  ).forEach(card=>{
    // Disable the previous native HTML5 drag gesture.
    card.draggable=false;
    card.style.touchAction='pan-y';
  });
}

/* ELH_BIDIRECTIONAL_SNAP_V2 */
function findLane(x,y,session=drag) {
  if(!session?.card || !session.active)return null;

  const sourceLane=session.card.closest('.ehv4-lane');
  if(!sourceLane)return null;

  const dx=x-session.startX;
  const dy=y-session.startY;

  // Ignore accidental micro-movements.
  if(Math.abs(dx)<26)return null;

  const movingRight=dx>0;

  const cardRect=session.card.getBoundingClientRect();
  const sourceRect=sourceLane.getBoundingClientRect();

  // Use the leading EDGE of the dragged card,
  // rather than the position of the mouse pointer.
  const leadingEdge=movingRight
    ? cardRect.right+dx
    : cardRect.left+dx;

  const cardCenterY=
    cardRect.top+cardRect.height/2+dy;

  const MAGNET_RADIUS=95;

  let best=null;
  let bestScore=Infinity;

  for(const lane of allLanes()){
    if(lane===sourceLane)continue;

    const r=lane.getBoundingClientRect();

    // Consider only columns in the movement direction.
    if(movingRight &&
       r.left<=sourceRect.left+5)continue;

    if(!movingRight &&
       r.right>=sourceRect.right-5)continue;

    // Allow nearby vertical positioning.
    if(cardCenterY<r.top-130 ||
       cardCenterY>r.bottom+130)continue;

    const boundary=movingRight?r.left:r.right;

    // Once the leading edge approaches the next column,
    // that column becomes a valid magnetic target.
    const reached=movingRight
      ? leadingEdge>=boundary-MAGNET_RADIUS
      : leadingEdge<=boundary+MAGNET_RADIUS;

    if(!reached)continue;

    const score=Math.abs(leadingEdge-boundary);

    if(score<bestScore){
      best=lane;
      bestScore=score;
    }
  }

  return best;
}

function dropStatus(lane,x) {
  if(!lane)return null;

  const group=lane.dataset.group;

  if(group===CLOSED){
    // Explicitly choose one of the two terminal states.
    // Left half: Booking. Right half: Not suitable.
    const rect=lane.getBoundingClientRect();
    return x<rect.left+rect.width/2
      ? 'Booking'
      : 'Không phù hợp';
  }

  return GROUPS[group]||null;
}

function laneForCard(card){
  return card.closest('.ehv4-lane');
}

function changeCount(lane,delta){
  if(!lane)return;

  const node=lane.querySelector('.ehv4-count');
  if(!node)return;

  const count=Number(node.textContent);

  if(Number.isFinite(count)){
    node.textContent=String(Math.max(0,count+delta));
  }
}

function makeGhost(card){
  const rect=card.getBoundingClientRect();

  const ghost=card.cloneNode(true);

  ghost.removeAttribute('id');
  ghost.classList.add('ehmag-ghost');

  ghost.style.width=rect.width+'px';
  ghost.style.height=rect.height+'px';
  ghost.style.left=rect.left+'px';
  ghost.style.top=rect.top+'px';

  document.body.append(ghost);

  return ghost;
}

function moveGhost(x,y){
  if(!drag?.ghost)return;

  const dx=x-drag.startX;
  const dy=y-drag.startY;

  drag.ghost.style.transform=
    `translate3d(${dx}px,${dy}px,0) rotate(3deg) scale(1.015)`;
}

function cleanup(){
  if(!drag)return;

  drag.card.classList.remove('ehmag-source');
  drag.ghost?.remove();

  removeHighlights();

  drag=null;
}

async function commitMove(sourceCard,targetLane,to){
  const sourceLane=laneForCard(sourceCard);

  if(!sourceLane||!targetLane||!to)return;

  const from=sourceCard.dataset.status;
  const id=sourceCard.dataset.id;

  if(!id || from===to)return;

  if(busy)return;
  busy=true;

  const sourceContainer=sourceCard.parentElement;
  const originalNext=sourceCard.nextSibling;

  const targetContainer=targetLane.querySelector(
    '.ehv4-lane-scroll'
  );

  if(!targetContainer){
    busy=false;
    return;
  }

  const label=sourceCard.querySelector('.ehv4-status');

  // Optimistic UI: move immediately, no page reload.
  targetContainer.prepend(sourceCard);

  sourceCard.dataset.status=to;
  sourceCard.classList.add('ehmag-arrived');

  if(label)label.textContent=to;

  if(sourceLane!==targetLane){
    changeCount(sourceLane,-1);
    changeCount(targetLane,1);
  }

  message('Đang đồng bộ trạng thái...');

  try{
    // Re-read the current version before saving.
    const detail=await rpc('crm_detail',{p_id:id});
    const lead=detail?.lead;

    if(!lead)throw Error('Không tìm thấy khách hàng');

    if(lead.status!==from){
      throw Error(
        'Khách đã được cập nhật từ phiên khác.'
      );
    }

    await mutate('crm_update',{
      p_id:id,
      p_version:lead.version,
      p_status:to,
      p_next:lead.next_followup||null,
      p_note:lead.notes||''
    });

    message('Đã chuyển trạng thái');

    // No refreshBoard, location.reload or page navigation.
    // The updated card stays in the destination lane.
    setTimeout(()=>{
      sourceCard.classList.remove('ehmag-arrived');
    },300);

  }catch(error){
    // Roll back only the affected card.
    if(originalNext&&originalNext.parentNode===sourceContainer){
      sourceContainer.insertBefore(sourceCard,originalNext);
    }else{
      sourceContainer.append(sourceCard);
    }

    sourceCard.dataset.status=from;
    if(label)label.textContent=from;

    if(sourceLane!==targetLane){
      changeCount(sourceLane,1);
      changeCount(targetLane,-1);
    }

    sourceCard.classList.remove('ehmag-arrived');
    sourceCard.classList.add('ehmag-rollback');

    setTimeout(()=>{
      sourceCard.classList.remove('ehmag-rollback');
    },350);

    message(error?.message||'Không thể lưu trạng thái.');
  }finally{
    busy=false;
  }
}

document.addEventListener('pointerdown',event=>{
  if(!isDesktop()||busy||drag)return;

  if(event.button!==0 || !event.isPrimary)return;

  const card=event.target.closest?.('.ehv4-card');

  if(!card || !board()?.contains(card))return;

  // Do not interfere with Callio, View and other buttons.
  if(event.target.closest(
    'button,a,input,select,textarea'
  ))return;

  drag={
    card,
    startX:event.clientX,
    startY:event.clientY,
    x:event.clientX,
    y:event.clientY,
    active:false,
    ghost:null,
    target:null
  };
},true);

document.addEventListener('pointermove',event=>{
  if(!drag)return;

  drag.x=event.clientX;
  drag.y=event.clientY;

  const distance=Math.hypot(
    drag.x-drag.startX,
    drag.y-drag.startY
  );

  if(!drag.active&&distance>=DRAG_THRESHOLD){
    drag.active=true;
    drag.ghost=makeGhost(drag.card);
    drag.card.classList.add('ehmag-source');
    document.body.classList.add('ehmag-dragging');
  }

  if(!drag.active)return;

  event.preventDefault();

  moveGhost(drag.x,drag.y);

  const lane=findLane(drag.x,drag.y);
  drag.target=lane;

  removeHighlights();

  if(lane){
    lane.classList.add('ehmag-target');
  }

},{passive:false,capture:true});

document.addEventListener('pointerup',event=>{
  if(!drag)return;

  const session=drag;

  if(!session.active){
    cleanup();
    return;
  }

  suppressClickUntil=performance.now()+450;

  // Determine destination again at release.
  const target=findLane(event.clientX,event.clientY);
  const to=dropStatus(target,event.clientX);

  cleanup();
  document.body.classList.remove('ehmag-dragging');

  if(!target||!to)return;

  commitMove(session.card,target,to);
},true);

document.addEventListener('pointercancel',()=>{
  cleanup();
  document.body.classList.remove('ehmag-dragging');
},true);

document.addEventListener('click',event=>{
  if(performance.now()<suppressClickUntil){
    event.preventDefault();
    event.stopImmediatePropagation();
  }
},true);

// Newly loaded cards also use magnetic dragging.
if(document.body){
  const observer=new MutationObserver(enableCards);

  observer.observe(document.body,{
    childList:true,
    subtree:true
  });

  enableCards();
}