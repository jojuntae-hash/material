import test from 'node:test';
import assert from 'node:assert/strict';
import {moveComposerRow} from '../src/composer-reorder.js';
test('move rows down and retain selection, quantities and all metadata',()=>{
 const rows=[{name:'A',quantity:3},{name:'B',quantity:7,note:'memo'},{name:'C',trade:'소방'}];
 const moved=moveComposerRow(rows,new Set([0,2]),0,2);
 assert.deepEqual(moved.rows.map(r=>r.name),['B','C','A']);
 assert.deepEqual([...moved.selection],[1,2]);
 assert.equal(moved.rows[0],rows[1]);assert.equal(moved.rows[2].quantity,3);
 assert.deepEqual(rows.map(r=>r.name),['A','B','C']);
 assert.deepEqual(JSON.parse(JSON.stringify({rows:moved.rows})).rows,moved.rows);
});
test('move upwards and ignore invalid destination',()=>{
 const rows=['A','B','C'];
 assert.deepEqual(moveComposerRow(rows,new Set([1]),2,0),{rows:['C','A','B'],selection:new Set([2])});
 for(const to of [-1,3,NaN])assert.equal(moveComposerRow(rows,new Set(),0,to).rows,rows);
});
