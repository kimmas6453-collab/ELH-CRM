// Sprint 06A: pure view adapter. No customer status writes or invented call history.
import {callioOutcomeLabel} from './callio-outcome.js';
export function mapCallioToActivities(records=[]) {
  return records.filter(x=>x&&x.id&&x.started_at).map(x=>{
    const seconds=Number(x.talk_seconds||0);
    const outcome=(x.outcome||'').trim();
    const parts=[];
    if(outcome) parts.push('Kết quả: '+callioOutcomeLabel(outcome, seconds)+' ('+outcome+')');
    parts.push(seconds>0?'Có đàm thoại: '+seconds+' giây':'Chưa ghi nhận thời gian đàm thoại');
    const direction=x.direction==='outbound'?'Cuộc gọi đi':x.direction==='inbound'?'Cuộc gọi đến':'Cuộc gọi';
    return {
      id:'callio:'+x.id,
      kind:'CALLIO',
      created_at:x.started_at,
      note: direction+' · '+parts.join(' · '),
      status:null,
      source_system:'callio',
      actor_name:x.actor_name||''
    };
  });
}
export function mergeHistoryEvents(crm=[],callio=[]) {
  const seen=new Set();
  return [...crm,...callio].filter(x=>{
    if(!x)return false;
    const key=String(x.kind||'')+'::'+String(x.id||'');
    if(x.id&&seen.has(key))return false;
    seen.add(key);
    return true;
  });
}
export function summarizeCallio(records=[]) {
  if(!records.length) return '';
  const n=records.length;
  const positive=records.filter(x=>Number(x.talk_seconds)>0).length;
  return 'Callio: '+n+' cuộc gọi đã tải · '+positive+' có thời gian đàm thoại';
}
