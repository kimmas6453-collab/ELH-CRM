import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SessionCache} from '../src/cache.js';
import {normalizePhone,escapeHtml} from '../src/domain.js';
test('concurrent same queries deduplicate and logout rejects in-flight data',async()=>{
 const c=new SessionCache();let count=0,done;
 const loader=()=>{count++;return new Promise(r=>done=r);};
 const p=c.get('leads',loader),q=c.get('leads',loader);
 await Promise.resolve(); c.clear();done(['private']);
 await assert.rejects(p,/STALE_SESSION/);await assert.rejects(q,/STALE_SESSION/);
 assert.equal(count,1);assert.equal(c.entries.size,0);
});
test('invalidating pending query cannot delete replacement cache request',async()=>{
 const c=new SessionCache();let old,newer;
 const p=c.get('x',()=>new Promise(r=>old=r));await Promise.resolve();c.clear();
 const q=c.get('x',()=>new Promise(r=>newer=r));await Promise.resolve();old(1);await assert.rejects(p);
 assert.equal(c.pending.size,1);newer(2);assert.equal(await q,2);
});
test('phone validation and HTML escaping',()=>{
 assert.equal(normalizePhone('+84 900 000 001'),'0900000001');
 assert.throws(()=>normalizePhone('0900000001x'));
 assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
});
