import {supabase,rpc} from './api.js';
import {escapeHtml as e} from './domain.js';
export async function openNotifications(profile){
 const d=document.createElement('dialog');d.setAttribute('aria-label','Thông báo');d.innerHTML='<button class="close" aria-label="Đóng thông báo">×</button><h2>Thông báo của bạn</h2><button class="read-all">Đánh dấu tất cả đã đọc</button><p role="status">Đang tải…</p><section></section><button class="notice-more">Xem thêm thông báo</button>';document.body.append(d);d.showModal();d.querySelector('.close').onclick=()=>d.close();d.onclose=()=>d.remove();
 const listener=supabase.auth.onAuthStateChange((_event,s)=>{if(s?.user.id!==profile.id)d.close();});d.addEventListener('close',()=>listener.data.subscription.unsubscribe());
 let offset=0;const msg=d.querySelector('[role=status]'),section=d.querySelector('section'),more=d.querySelector('.notice-more');
 const load=async()=>{more.disabled=true;try{const {data,error}=await supabase.from('notifications').select('id,title,body,created_at,read_at').order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+49);if(error)throw error;if(!d.isConnected)return;
 section.insertAdjacentHTML('beforeend',data.map(n=>`<article class="call-record"><div><strong>${e(n.title)}</strong><p>${e(n.body)}</p><small>${e(new Date(n.created_at).toLocaleString('vi-VN'))}</small>${n.read_at?'':`<button data-read="${e(n.id)}">Đánh dấu đã đọc</button>`}</div></article>`).join(''));offset+=data.length;more.hidden=data.length<50;msg.textContent=offset?`Đang hiển thị ${offset} thông báo của tài khoản.`:'Bạn chưa có thông báo.';
 }catch(err){if(d.isConnected)msg.textContent=err.message;}finally{more.disabled=false;}};
 section.onclick=async ev=>{const b=ev.target.closest('[data-read]');if(!b)return;b.disabled=true;try{const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',b.dataset.read);if(error)throw error;b.remove();}catch(err){msg.textContent=err.message;b.disabled=false;}};
 d.querySelector('.read-all').onclick=async ev=>{const b=ev.currentTarget;b.disabled=true;try{await rpc('crm_read_notifications');section.querySelectorAll('[data-read]').forEach(x=>x.remove());msg.textContent='Đã đánh dấu tất cả thông báo đã đọc.';}catch(err){msg.textContent=err.message;}finally{b.disabled=false;}};more.onclick=load;await load();
}
