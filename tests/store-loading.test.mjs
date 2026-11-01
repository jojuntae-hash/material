import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCloudRecords,recentRequestDate,mergeRecords} from '../src/cloud-records.js';
import {loadCloudPages} from '../src/cloud-pages.js';
const code=readFileSync(new URL('../src/store.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replaceAll('export ','').replaceAll('import.meta.env','{}');
const Store=Function('loadCloudPages','loadCloudRecords','recentRequestDate','mergeRecords',code+';return Store;')(loadCloudPages,loadCloudRecords,recentRequestDate,mergeRecords);
function fixture(){
 const store=new Store(),calls=[];
 store.mode='cloud';store.projectId='project';store.session={user:{id:'user'}};
 store.client={from(table){const call={table,filters:[]};calls.push(call);const q={select(){return q},eq(k,v){call.filters.push([k,v]);return q},gte(){return q},or(){return q},order(){return q},limit(){return q},gt(){return q},range(){return q},then(resolve){return Promise.resolve({data:table==='mm_records'?(call.filters.some(([k,v])=>k==='kind'&&v==='request')?[{id:'r',kind:'request',data:{name:'test'}}]:[]):[{id:'h',record_id:'r'}]}).then(resolve)}};return q}};
 return {store,calls};
}
test('initial refresh reads records without waiting for audit queries',async()=>{const {store,calls}=fixture();await store.refresh();assert.equal(store.records.length,1);assert.equal(calls.length,6);assert.ok(calls.every(c=>c.table==='mm_records'));assert.deepEqual(store.history,[])});
test('item history is requested on demand and can be used to revert',async()=>{const {store,calls}=fixture();const rows=await store.loadHistory('r');assert.deepEqual(calls[0].filters,[['project_id','project'],['record_id','r']]);assert.equal(rows[0].id,'h');assert.equal(store.history[0].id,'h')});
test('failed refresh preserves displayed records',async()=>{const {store}=fixture();store.records=[{id:'old'}];store.client.from=()=>{throw Error('unavailable')};await assert.rejects(store.refresh());assert.equal(store.records[0].id,'old')});

test('background failure preserves recent data and a retry completes the load',async()=>{
 const {store}=fixture();store.records=[{id:'recent',kind:'request',data:{}}];store.recordsPartial=true;store.loadGeneration=1;store.recentSince='2026-10-26';
 const client=store.client;store.client={from(){throw Error('timeout')}};
 await store.loadOlder();assert.equal(store.records[0].id,'recent');assert.equal(store.recordsPartial,true);assert.equal(store.olderLoading,false);assert.equal(store.olderError,'timeout');
 store.client=client;await store.loadOlder();assert.equal(store.recordsPartial,false);assert.equal(store.olderError,'');assert.ok(store.records.some(r=>r.id==='recent'));
});
test('a previous project background response never enters the new project',async()=>{
 const {store}=fixture();store.recordsPartial=true;store.loadGeneration=1;store.recentSince='2026-10-26';store.records=[{id:'new'}];
 store.client={from(){store.projectId='other';throw Error('old response')}};
 await store.loadOlder();assert.deepEqual(store.records,[{id:'new'}]);assert.equal(store.olderError,'');
});

test('recent refresh resolves before older data and publishes it later',async()=>{
 let finish;const waiting=new Promise(r=>finish=r),calls=[];
 const fakeLoader=async(client,project,options)=>{calls.push(options);if(options.requestsSince)return [{id:'recent',kind:'request',version:1,data:{date:'2026-11-01'}}];await waiting;options.onGroup([{id:'older',kind:'request',version:1,data:{date:'2026-01-01'}}]);return [];};
 const TestStore=Function('loadCloudPages','loadCloudRecords','recentRequestDate','mergeRecords',code+';return Store;')(loadCloudPages,fakeLoader,recentRequestDate,mergeRecords);
 const s=new TestStore();s.mode='cloud';s.projectId='p';s.session={user:{id:'u'}};s.client={};
 await s.refresh({recentFirst:true});assert.equal(s.records.length,1);assert.equal(s.recordsPartial,true);assert.equal(calls.length,1);
 await new Promise(r=>setTimeout(r,1));assert.equal(s.olderLoading,true);assert.ok(calls[1].requestsBefore);assert.deepEqual(calls[1].kinds,['request','approval','file','batch']);
 finish();await new Promise(r=>setTimeout(r,1));assert.equal(s.recordsPartial,false);assert.deepEqual(s.records.map(r=>r.id),['older','recent']);
});
