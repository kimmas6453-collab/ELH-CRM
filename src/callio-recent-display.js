// Display-only adapter. Shape of public.crm_staff_callio_recent(p_ids text[]):
// { [lead_id]: { at, outcome, talk_seconds } }. No CRM writes.
import {callioOutcomeLabel} from './callio-outcome.js';
export function formatRecentCallio(call){
  if(!call || typeof call!=='object') return 'Chưa ghi nhận cuộc gọi đã ghép';
  const outcome=String(call.outcome||'').trim();
  if(!outcome)return 'Chưa có kết quả xác minh';
  const seconds=Number(call.talk_seconds||0);
  const label=callioOutcomeLabel(outcome,seconds);
  const when=call.at || call.started_at || null;
  if(!when)return label;
  const date=new Date(when);
  if(Number.isNaN(date.getTime()))return label;
  const time=new Intl.DateTimeFormat('vi-VN',{
    timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false
  }).format(date);
  return time+' · '+label;
}
