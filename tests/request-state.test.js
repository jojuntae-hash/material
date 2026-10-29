import test from 'node:test';
import assert from 'node:assert/strict';
import {changeRequestState} from '../src/request-state.js';
import {aggregateMaterials} from '../src/aggregation.js';
const data={name:'수전',spec:'40A',unit:'EA',quantity:2,date:'2026-10-29',trade:'기계',original:{name:'원본'}};
test('취소와 해제·삭제와 복구는 원본과 이력을 보존하고 집계에서 제외',()=>{let d=changeRequestState(data,'cancel','업체 취소 확인','관리');assert.equal(d.requestCancellation.active,true);assert.equal(aggregateMaterials([{kind:'request',data:d}]).length,0);d=changeRequestState(d,'resume','취소 철회','관리');assert.equal(aggregateMaterials([{kind:'request',data:d}])[0].total,2);d=changeRequestState(d,'archive','중복 입력','관리');assert.equal(d.requestArchived,true);d=changeRequestState(d,'restore','복구','관리');assert.equal(d.requestArchived,false);assert.equal(d.requestStateHistory.length,4);assert.deepEqual(d.original,data.original);assert.equal(data.requestCancellation,undefined);});
test('사유 누락·이미 취소된 항목·입고된 청구 취소 차단',()=>{assert.throws(()=>changeRequestState(data,'cancel','','관리'),/사유/);const d=changeRequestState(data,'cancel','오청구','관리');assert.throws(()=>changeRequestState(d,'cancel','다시','관리'),/이미/);assert.throws(()=>changeRequestState({...data,receipts:[{id:'1',type:'receive',quantity:1}]},'cancel','취소','관리'),/입고 기록/);});
