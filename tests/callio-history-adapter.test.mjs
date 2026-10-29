import test from 'node:test';
import assert from 'node:assert/strict';
import {mapCallioToActivities,mergeHistoryEvents,summarizeCallio} from '../src/callio-history-adapter.js';
test('callio history retains real outcome without altering CRM status',()=>{
 const [a]=mapCallioToActivities([{id:'x',started_at:'2026-10-20T10:00:00Z',outcome:'NO_ANSWER',talk_seconds:0,actor_name:'Test'}]);
 assert.equal(a.status,null);
 assert.equal(a.kind,'CALLIO');
 assert.match(a.note,/NO_ANSWER/);
 assert.equal(a.actor_name,'Test');
});
test('duplicate events deduplicated by kind and id',()=>{
 const c={id:1,kind:'UPDATE',created_at:'2026-10-20T10:00:00Z'};
 const d={id:'callio:x',kind:'CALLIO',created_at:'2026-10-20T10:01:00Z'};
 assert.equal(mergeHistoryEvents([c,c],[d,d]).length,2);
});
test('call summary is descriptive only',()=>{
 const s=summarizeCallio([{talk_seconds:9},{talk_seconds:0}]);
 assert.match(s,/2/); assert.match(s,/1/);
});
