import test from 'node:test';
import assert from 'node:assert/strict';
import {formatRecentCallio} from '../src/callio-recent-display.js';
test('Callio recent reads actual rpc JSON at',()=>{
  const x=formatRecentCallio({at:'2026-10-21T02:19:33Z',outcome:'NO_USER_RESPONSE',talk_seconds:0});
  assert.match(x,/21[-\/]10/);
  assert.match(x,/Không nghe máy/);
});
test('normal clearing with talk seconds is answered',()=>{
  assert.match(formatRecentCallio({outcome:'NORMAL_CLEARING',talk_seconds:35}),/Đã kết nối/);
});
test('empty mapping never claims customer was not called',()=>{
  assert.equal(formatRecentCallio(null),'Chưa ghi nhận cuộc gọi đã ghép');
});
