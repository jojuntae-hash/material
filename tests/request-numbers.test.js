import test from 'node:test';
import assert from 'node:assert/strict';
import {withTradeNumbers,requestFilename} from '../src/request-numbers.js';
import {splitDraftByTrade} from '../src/request-template.js';
test('기계·소방 별도 청구번호와 파일명·앞자리 0 보존',()=>{const d={date:'2026-10-26',project:'파주 콘텐츠시티',mechanicalNumber:'파주 콘텐츠시티 현장 - 기계 - 049',fireNumber:'파주 콘텐츠시티 현장 - 소방 - 071',rows:[{trade:'기계',quantity:2},{trade:'소방',quantity:3}]};assert.equal(requestFilename(d,'기계'),'1026_기계_049_자재청구서-파주콘텐츠시티.xlsx');assert.equal(requestFilename(d,'소방'),'1026_소방_071_자재청구서-파주콘텐츠시티.xlsx');const parts=splitDraftByTrade(d);assert.equal(parts[0].draft.number,d.mechanicalNumber);assert.equal(parts[1].draft.number,d.fireNumber);assert.throws(()=>requestFilename({...d,fireNumber:''},'소방'),/소방 청구번호/);});
test('이전 청구번호는 해당 공종만 계승하고 직접 입력한 공란도 유지',()=>{const d={number:'기계-049',project:'현장',rows:[{trade:'기계'},{trade:'소방'}]};const n=withTradeNumbers(d);assert.equal(n.mechanicalNumber,'기계-049');assert.ok(!n.fireNumber.includes('049'));assert.equal(d.mechanicalNumber,undefined);assert.equal(withTradeNumbers({...d,fireNumber:''}).fireNumber,'');assert.deepEqual(withTradeNumbers(n),n);});
