// Verified raw Callio codes. Technical call result !== customer business intent.
export const CALLIO_OUTCOME_LABELS = Object.freeze({
  NORMAL_CLEARING:'\u0110\u00e3 k\u1ebft n\u1ed1i',
  NO_USER_RESPONSE:'Kh\u00f4ng nghe m\u00e1y',
  USER_BUSY:'M\u00e1y b\u1eadn',
  ORIGINATOR_CANCEL:'Ng\u01b0\u1eddi g\u1ecdi h\u1ee7y',
  CALL_REJECTED:'Cu\u1ed9c g\u1ecdi b\u1ecb t\u1eeb ch\u1ed1i',
  UNALLOCATED_NUMBER:'S\u1ed1 kh\u00f4ng kh\u1ea3 d\u1ee5ng',
  NO_ROUTE_DESTINATION:'Kh\u00f4ng th\u1ec3 \u0111\u1ecbnh tuy\u1ebfn',
  SERVICE_UNAVAILABLE:'D\u1ecbch v\u1ee5 kh\u00f4ng kh\u1ea3 d\u1ee5ng',
  NORMAL_TEMPORARY_FAILURE:'L\u1ed7i t\u1ea1m th\u1eddi',
  RECOVERY_ON_TIMER_EXPIRY:'H\u1ebft th\u1eddi gian ph\u1ee5c h\u1ed3i'
});
export function callioOutcomeLabel(code, talkSeconds=0){
  const normalized=String(code||'').trim().toUpperCase();
  if(normalized==='NORMAL_CLEARING' && !(Number(talkSeconds)>0)) {
    return 'K\u1ebft th\u00fac cu\u1ed9c g\u1ecdi, ch\u01b0a x\u00e1c nh\u1eadn \u0111\u00e0m tho\u1ea1i';
  }
  return CALLIO_OUTCOME_LABELS[normalized] || normalized || 'Ch\u01b0a c\u00f3 k\u1ebft qu\u1ea3';
}
export function crmAutoStatus(outcome,talkSeconds,crmStatus){
  const code=String(outcome||'').toUpperCase();
  const status=String(crmStatus||'');
  const early=['M\u1edbi','Ch\u01b0a li\u00ean h\u1ec7'];
  if(code==='NO_USER_RESPONSE' && early.includes(status))return 'Kh\u00f4ng nghe m\u00e1y';
  if(code==='NORMAL_CLEARING' && Number(talkSeconds)>0 &&
     [...early,'Kh\u00f4ng nghe m\u00e1y'].includes(status))return '\u0110\u00e3 li\u00ean h\u1ec7';
  return null;
}
