import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync('src/telesales-workspace-v4.js','utf8');
test('mapped groups unique',()=>{const i=src.indexOf('const GROUPS = [');assert.ok(i>=0);const data=src.slice(i,src.indexOf('];',i));for(const s of ['Chưa liên hệ','Không nghe máy','Đã liên hệ','Có nhu cầu','Booking','Không phù hợp'])assert.match(data,new RegExp(s))});
test('no direct changes to Callio records from Kanban',()=>{assert.doesNotMatch(src,/mutate\(['"](?:callio_|crm_callio)/)});
test('mutations use CRM version',()=>assert.match(src,/p_version:lead\.version/));
