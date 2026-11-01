import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCloudRecords} from '../src/cloud-records.js';
const kinds=['request','vendor','approval','alias','file','batch'];
function fixture({fail=false,timeout=false}={}){
 let active=0,peak=0;const calls=[];
 const rows=kinds.flatMap((kind,index)=>Array.from({length:kind==='request'?2432:kind==='batch'?72:3},(_,n)=>({id:String(index*10000+n).padStart(6,'0'),kind})));
 const client={from(table){const args={table,limit:0,filters:{}};const q={select(){return q},eq(k,v){args.filters[k]=v;return q},gte(k,v){args.since=[k,v];return q},or(v){args.before=v;return q},order(){return q},limit(n){args.limit=n;return q},gt(k,v){args.last=v;return q},then(resolve,reject){calls.push(args);active++;peak=Math.max(peak,active);return new Promise(r=>setTimeout(r,1)).then(()=>{active--;if(fail&&args.filters.kind==='vendor')return {error:{code:'42501'}};if(timeout&&args.limit>125)return {error:{code:'57014'}};return {data:rows.filter(r=>r.kind===args.filters.kind&&(!args.last||r.id>args.last)).slice(0,args.limit)}}).then(resolve,reject)}};return q}};
 return {client,rows,calls,peak:()=>peak};
}
test('loads every kind without omissions while limiting concurrent requests',async()=>{const f=fixture();const result=await loadCloudRecords(f.client,'p');assert.deepEqual(result,f.rows);assert.equal(f.peak(),3);assert.ok(f.calls.every(c=>c.filters.project_id==='p'));assert.equal(f.calls.filter(c=>c.filters.kind==='request').length,5);console.log('2,432 requests: 5 data requests instead of 13 at page size 200')});
test('adaptive retries preserve all rows with parallel readers',async()=>{const f=fixture({timeout:true});assert.deepEqual(await loadCloudRecords(f.client,'p'),f.rows)});
test('failed group rejects the entire load',async()=>{const f=fixture({fail:true});await assert.rejects(loadCloudRecords(f.client,'p'),e=>e.code==='42501')});

test('recent window includes seven Korean calendar days across month and year boundaries',async()=>{
 const {recentRequestDate,mergeRecords}=await import('../src/cloud-records.js');
 assert.equal(recentRequestDate(new Date('2026-11-01T00:00:00Z')),'2026-10-26');
 assert.equal(recentRequestDate(new Date('2026-12-31T16:00:00Z')),'2026-12-26');
 assert.deepEqual(mergeRecords([{id:'x',version:3}],[{id:'x',version:2},{id:'y',version:1}]),[{id:'x',version:3},{id:'y',version:1}]);
});

test('recent and older requests use complementary date filters',async()=>{const f=fixture();await loadCloudRecords(f.client,'p',{kinds:['request'],requestsSince:'2026-10-26'});assert.deepEqual(f.calls[0].since,['data->>date','2026-10-26']);const old=fixture();await loadCloudRecords(old.client,'p',{kinds:['request'],requestsBefore:'2026-10-26'});assert.equal(old.calls[0].before,'data->>date.lt.2026-10-26,data->>date.is.null')});
