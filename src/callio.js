import {renderLinkRequest} from './callio-requests.js';
// Official widget UI is isolated in a cross-origin iframe. No Callio password is
// collected by CRM, and no company-wide token is shipped to the browser.
// Protocol matches https://client.callio.vn/widget-embed.js (checked 2026-10-19).
import {rpc} from './api.js';
const origin='https://client.callio.vn';
let frame, panel, loaded, resolveLoaded, pending=false, epoch=0;
export function openCallio() {
  if(panel) { panel.hidden=false; return; }
  panel=document.createElement('aside'); panel.className='callio-panel';
  panel.setAttribute('aria-label','Điện thoại Callio');
  const title=document.createElement('strong'); title.textContent='Điện thoại Callio';
  const close=document.createElement('button'); close.textContent='Đóng'; close.onclick=()=>{panel.hidden=true;};
  const note=document.createElement('p'); note.textContent='Đăng nhập tài khoản Callio của bạn tại đây nếu được yêu cầu. Phiên do Callio quản lý.';
  frame=document.createElement('iframe'); frame.title='Đăng nhập và gọi điện qua Callio';
  frame.allow='microphone; autoplay'; frame.referrerPolicy='no-referrer';
  loaded=new Promise(resolve=>{resolveLoaded=resolve;});
  frame.onload=()=>resolveLoaded(); frame.src=origin+'/widget.html';
  const linking=document.createElement('section');
  const fallback=document.createElement('a');fallback.href=origin;fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='Mở ứng dụng web Callio';
  panel.append(title,close,note,fallback,linking,frame); document.body.append(panel);
  renderLinkRequest(linking).catch(()=>{linking.textContent='Không tải được trạng thái ghép tài khoản.';});
}
export async function callLead(id) {
  if(pending) throw Error('Đang chuẩn bị cuộc gọi trước.');
  pending=true;
  const current=epoch;
  try {
    // Fresh authorization on EVERY call, never from the list cache.
    const prepared=await rpc('crm_prepare_call',{p_id:id});
    if(current!==epoch) throw Error('STALE_SESSION');
    openCallio();
    let timeout;
    try { await Promise.race([loaded,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Callio chưa tải xong. Hãy kiểm tra kết nối rồi thử lại.')),15000);})]); }
    finally { clearTimeout(timeout); }
    if(current!==epoch) throw Error('STALE_SESSION');
    frame.contentWindow.postMessage({func:'makeCall',message:prepared.phone},origin);
    return 'Đã gửi yêu cầu đến Callio. Kiểm tra trạng thái cuộc gọi trong cửa sổ điện thoại.';
  } finally {if(current===epoch)pending=false;}
}
export function destroyCallio() {
  epoch++;
  panel?.remove(); frame=null; panel=null; loaded=null; resolveLoaded=null; pending=false;
}
