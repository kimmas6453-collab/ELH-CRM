import {rpc,supabase} from './api.js';
import {escapeHtml as e} from './domain.js';
const minutes=n=>`${Math.floor(n/60).toLocaleString('vi-VN')} phút ${n%60} giây`;
export async function openReports(profile){if(profile?.role!=="ADMIN")throw Error("Không có quyền xem báo cáo.");
 const dialog=document.createElement('dialog');dialog.className='report-dialog';dialog.setAttribute('aria-label','Báo cáo cuộc gọi Callio');
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 dialog.innerHTML=`<button class="close" aria-label="Đóng báo cáo">×</button><span class="eyebrow">CALLIO / BÁO CÁO</span><h2>Hiệu quả cuộc gọi</h2><form class="report-filter"><label>Từ ngày<input type="date" name="from" value="${date.slice(0,7)}-01" required></label><label>Đến ngày<input type="date" name="to" value="${date}" required></label><button class="primary">Xem báo cáo</button></form><p role="status" id="report-status"></p><section class="metrics" id="call-metrics"></section><div class="table-scroll"><table class="team-table"><thead><tr><th>NGÀY</th><th>CUỘC GỌI</th><th>CÓ ĐÀM THOẠI</th><th>ĐÀM THOẠI</th></tr></thead><tbody id="call-days"></tbody></table></div>${profile.role==="ADMIN"?'<h3>Lịch sử gần nhất</h3><div id="call-history"></div><div class="report-actions"><button id="call-more" hidden>Xem thêm cuộc gọi</button><button id="call-export">Xuất CSV toàn bộ khoảng ngày</button></div>':''}`;
 document.body.append(dialog);dialog.showModal();dialog.querySelector('.close').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
 const {data:{session}}=await supabase.auth.getSession();const identity=session?.user.id;
 const alive=async()=>dialog.isConnected&&(await supabase.auth.getSession()).data.session?.user.id===identity;
 const authListener=supabase.auth.onAuthStateChange((_event,s)=>{if(s?.user.id!==identity)dialog.close();});dialog.addEventListener('close',()=>authListener.data.subscription.unsubscribe());
 let rangeFrom,rangeTo,loaded=0,sequence=0,exporting=false;
 const fields='id,started_at,direction,from_number,to_number,outcome,talk_seconds,owner_id';
 const historyQuery=(from=rangeFrom,to=rangeTo)=>supabase.from('callio_calls').select(fields).gte('started_at',from).lt('started_at',to).order('started_at',{ascending:false}).order('id',{ascending:false});
 const renderRows=data=>data.map(x=>`<article class="call-record"><div><strong>${e(x.direction==='outbound'?x.to_number:x.from_number)}</strong><small>${e(new Date(x.started_at).toLocaleString('vi-VN'))} · ${x.direction==='outbound'?'Gọi ra':'Gọi vào'}</small></div><div><span class="badge">${e(x.outcome||'Chưa có kết quả')}</span><small>${e(minutes(x.talk_seconds))}${profile.role==='ADMIN'&&!x.owner_id?' · Chưa ghép tài khoản':''}</small></div></article>`).join('');
 const load=async()=>{
  if(exporting)return;const ticket=++sequence;
  const form=dialog.querySelector('form'),b=form.querySelector('button'),status=dialog.querySelector('#report-status');b.disabled=true;status.textContent='Đang tải số liệu…';
  try{const d=new FormData(form),from=new Date(d.get('from')+'T00:00:00+07:00'),to=new Date(d.get('to')+'T00:00:00+07:00');to.setTime(to.getTime()+86400000);rangeFrom=from.toISOString();rangeTo=to.toISOString();loaded=0;
   const summary=await rpc('crm_call_report',{p_from:from.toISOString(),p_to:to.toISOString()});if(!await alive()||ticket!==sequence)return;
   dialog.querySelector('#call-metrics').innerHTML=[['Cuộc gọi',summary.total.toLocaleString('vi-VN')],['Có đàm thoại',summary.connected.toLocaleString('vi-VN')],['Tỷ lệ có đàm thoại',summary.total?`${Math.round(summary.connected*1000/summary.total)/10}%`:'—'],['Thời gian đàm thoại',minutes(summary.talk_seconds)]].map(([label,n])=>`<article><span>${label}</span><strong>${e(n)}</strong></article>`).join('');
   dialog.querySelector('#call-days').innerHTML=summary.daily.map(x=>`<tr><td>${e(x.day)}</td><td>${x.total}</td><td>${x.connected}</td><td>${e(minutes(x.talk_seconds))}</td></tr>`).join('');
   if(profile.role!=='EXECUTIVE'){
    const {data,error}=await historyQuery().limit(50);if(error)throw error;if(!await alive())return;
    loaded=data.length;dialog.querySelector('#call-history').innerHTML=renderRows(data)||'<p>Chưa có lịch sử thuộc tài khoản này trong khoảng ngày đã chọn.</p>';dialog.querySelector('#call-more').hidden=data.length<50;
   }
   status.textContent=profile.role==='TELESALES'?'Chỉ hiển thị cuộc gọi đã ghép với tài khoản của bạn.':profile.role==='EXECUTIVE'?'Số liệu tổng hợp toàn đội, không hiển thị thông tin khách hàng.':'Tổng hợp tính trên toàn bộ khoảng ngày; lịch sử bên dưới hiển thị 50 cuộc mỗi lần.';
  }catch(err){if(await alive())status.textContent=err.message;}finally{b.disabled=false;}
 };
 const more=dialog.querySelector('#call-more');if(more)more.onclick=async()=>{const ticket=sequence;more.disabled=true;try{const {data,error}=await historyQuery().range(loaded,loaded+49);if(error)throw error;if(!await alive())return;dialog.querySelector('#call-history').insertAdjacentHTML('beforeend',renderRows(data));loaded+=data.length;more.hidden=data.length<50;}catch(err){dialog.querySelector('#report-status').textContent=err.message;}finally{more.disabled=false;}};
 const exp=dialog.querySelector('#call-export');if(exp)exp.onclick=async()=>{if(!rangeFrom||!rangeTo)return;const ticket=sequence,exportFrom=rangeFrom,exportTo=rangeTo;exporting=true;dialog.querySelectorAll("form input,form button").forEach(x=>x.disabled=true);exp.disabled=true;const msg=dialog.querySelector('#report-status');try{
  const rows=[];for(let offset=0;offset<100000;offset+=500){const {data,error}=await historyQuery(exportFrom,exportTo).range(offset,offset+499);if(error)throw error;if(!await alive())return;rows.push(...data);msg.textContent='Đang xuất '+rows.length+' cuộc gọi…';if(data.length<500)break;if(offset===99500)throw Error('Khoảng ngày quá lớn. Hãy chọn khoảng nhỏ hơn.');}
  const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,x=>"'"+x).replaceAll('"','""')+'"';
  const csv=[['Thời gian','Hướng','Từ số','Đến số','Kết quả','Giây đàm thoại'],...rows.map(x=>[new Date(x.started_at).toLocaleString('vi-VN'),x.direction,x.from_number,x.to_number,x.outcome,x.talk_seconds])].map(r=>r.map(cell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='ellie-homes-callio.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);msg.textContent='Đã xuất '+rows.length+' cuộc gọi theo quyền tài khoản.';
 }catch(err){msg.textContent=err.message;}finally{exporting=false;exp.disabled=false;dialog.querySelectorAll("form input,form button").forEach(x=>x.disabled=false);}};
 dialog.querySelector('form').onsubmit=ev=>{ev.preventDefault();load();};await load();
}
