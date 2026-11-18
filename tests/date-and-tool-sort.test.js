import test from 'node:test';
import assert from 'node:assert/strict';
import {formatDateEntry,dateEntryError} from '../src/date-entry.js';
import {sortRegisteredTools} from '../src/tool-registered-sort.js';
test('date typing progresses after four-digit year and two-digit month; deleting separators remains possible',()=>{
 assert.equal(formatDateEntry('2026'),'2026-');assert.equal(formatDateEntry('202611'),'2026-11-');assert.equal(formatDateEntry('20261119'),'2026-11-19');
 assert.equal(formatDateEntry('2026',{deleting:true}),'2026');assert.equal(formatDateEntry('2026-11-19'),'2026-11-19');assert.equal(formatDateEntry('20261119999'),'2026-11-19');
 assert.equal(dateEntryError('2024-02-29'),'');assert.ok(dateEntryError('2026-02-29'));assert.ok(dateEntryError('2026-13-01'));assert.equal(dateEntryError(''),'');assert.ok(dateEntryError('2026-11-19','2026-12-01'));
});
test('registered tool sorting uses natural names and computed quantities without changing saved order',()=>{
 const rows=[{id:'a',data:{name:'공구10',events:[]}},{id:'b',data:{name:'공구2',events:[{id:'r',type:'receive',date:'2026-11-19',quantity:2}]}}];
 assert.deepEqual(sortRegisteredTools(rows,{key:'name'}).map(r=>r.id),['b','a']);
 assert.deepEqual(sortRegisteredTools(rows,{key:'stock',direction:'desc'}).map(r=>r.id),['b','a']);assert.deepEqual(sortRegisteredTools(rows,{key:'lastReceived',direction:'asc'}).map(r=>r.id),['b','a']);assert.deepEqual(rows.map(r=>r.id),['a','b']);
});
