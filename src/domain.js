export const statuses=['Mới','Chưa liên hệ','Không nghe máy','Đã liên hệ','Có nhu cầu','Hẹn gặp','Đang tư vấn','Không phù hợp','Booking'];
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizePhone(value) {
  let phone=String(value||'').replace(/[\s().-]/g,'');
  if (/^\+?84\d{9}$/.test(phone)) phone='0'+phone.replace(/^\+?84/,'');
  if(!/^0\d{9}$/.test(phone)) throw new Error('Số điện thoại Việt Nam phải đủ 10 chữ số.');
  return phone;
}
