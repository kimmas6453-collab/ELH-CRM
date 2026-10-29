import test from 'node:test';
import assert from 'node:assert/strict';
import {callioOutcomeLabel,crmAutoStatus} from '../src/callio-outcome.js';
test('real Callio codes map to readable technical outcomes',()=>{
  assert.match(callioOutcomeLabel('NO_USER_RESPONSE'),/Kh\u00f4ng nghe m\u00e1y/);
  assert.match(callioOutcomeLabel('ORIGINATOR_CANCEL'),/h\u1ee7y/);
  assert.match(callioOutcomeLabel('NORMAL_CLEARING',0),/ch\u01b0a x\u00e1c nh\u1eadn/);
});
test('automatic status mappings apply only to safe early states',()=>{
  assert.equal(crmAutoStatus('NO_USER_RESPONSE',0,'Ch\u01b0a li\u00ean h\u1ec7'),'Kh\u00f4ng nghe m\u00e1y');
  assert.equal(crmAutoStatus('NORMAL_CLEARING',15,'Kh\u00f4ng nghe m\u00e1y'),'\u0110\u00e3 li\u00ean h\u1ec7');
  for (const x of ['Booking','C\u00f3 nhu c\u1ea7u','H\u1eb9n g\u1eb7p','\u0110ang t\u01b0 v\u1ea5n','Kh\u00f4ng ph\u00f9 h\u1ee3p']){
    assert.equal(crmAutoStatus('NO_USER_RESPONSE',0,x),null);
    assert.equal(crmAutoStatus('NORMAL_CLEARING',20,x),null);
  }
  assert.equal(crmAutoStatus('ORIGINATOR_CANCEL',0,'M\u1edbi'),null);
  assert.equal(crmAutoStatus('CALL_REJECTED',0,'M\u1edbi'),null);
});
