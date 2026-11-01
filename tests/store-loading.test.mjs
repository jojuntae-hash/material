import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCloudRecords} from '../src/cloud-records.js';
import {loadCloudPages} from '../src/cloud-pages.js';
const code=readFileSync(new URL('../src/store.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replaceAll('export ','').replaceAll('import.meta.env','{}');
const Store=Function('loadCloudPages','loadCloudRecords',code+';return Store;')(loadCloudPages,loadCloudRecords);
function fixture(){
 const store=new Store(),calls=[];
 store.mode='cloud';store.projectId='project';
 store.client={from(table){const call={table,filters:[]};calls.push(call);const q={select(){return q},eq(k,v){call.filters.push([k,v]);return q},order(){return q},limit(){return q},gt(){return q},range(){return q},then(resolve){return Promise.resolve({data:table==='mm_records'?(call.filters.some(([k,v])=>k==='kind'&&v==='request')?[{id:'r',kind:'request',data:{name:'test'}}]:[]):[{id:'h',record_id:'r'}]}).then(resolve)}};return q}};
 return {store,calls};
}
test('initial refresh reads records without waiting for audit queries',async()=>{const {store,calls}=fixture();await store.refresh();assert.equal(store.records.length,1);assert.equal(calls.length,6);assert.ok(calls.every(c=>c.table==='mm_records'));assert.deepEqual(store.history,[])});
test('item history is requested on demand and can be used to revert',async()=>{const {store,calls}=fixture();const rows=await store.loadHistory('r');assert.deepEqual(calls[0].filters,[['project_id','project'],['record_id','r']]);assert.equal(rows[0].id,'h');assert.equal(store.history[0].id,'h')});
test('failed refresh preserves displayed records',async()=>{const {store}=fixture();store.records=[{id:'old'}];store.client.from=()=>{throw Error('unavailable')};await assert.rejects(store.refresh());assert.equal(store.records[0].id,'old')});
