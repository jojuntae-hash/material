import test from 'node:test';
import assert from 'node:assert/strict';
import {moveListItem} from '../src/composer-list-drag.js';
test('choice list move preserves all hidden items and does not mutate source',()=>{
 const values=['A','숨긴항목','B','C'];
 assert.deepEqual(moveListItem(values,0,2),['숨긴항목','B','A','C']);
 assert.deepEqual(moveListItem(values,3,0),['C','A','숨긴항목','B']);
 assert.deepEqual(values,['A','숨긴항목','B','C']);
 for(const to of [-1,4,NaN])assert.equal(moveListItem(values,0,to),values);
});
