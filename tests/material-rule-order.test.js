import test from 'node:test';
import assert from 'node:assert/strict';
import {sortMaterialRules,moveMaterialRule} from '../src/material-rule-order.js';
const rules=[{id:'a',aliases:['자재10'],target:'표준10',category:'배관'},{id:'b',aliases:['자재2','별칭'],target:'표준2',category:'밸브'},{id:'c',aliases:['자재1'],target:'표준1',category:''}];
test('위아래 이동은 보이는 이웃끼리 교환하고 경계·원본을 유지',()=>{
 assert.deepEqual(moveMaterialRule(rules,'a',1).map(r=>r.id),['b','a','c']);
 assert.deepEqual(moveMaterialRule(rules,'a',1,['a','c']).map(r=>r.id),['c','b','a']);
 assert.deepEqual(moveMaterialRule(rules,'a',-1),rules);assert.deepEqual(rules.map(r=>r.id),['a','b','c']);
});
test('각 열의 자연스러운 정렬과 내림차순, 빈 값은 항상 마지막',()=>{
 assert.deepEqual(sortMaterialRules(rules,'alias1').map(r=>r.id),['c','b','a']);
 assert.deepEqual(sortMaterialRules(rules,'target','desc').map(r=>r.id),['a','b','c']);
 assert.equal(sortMaterialRules(rules,'alias2','desc')[0].id,'b');assert.equal(sortMaterialRules(rules,'category','desc').at(-1).id,'c');
});
