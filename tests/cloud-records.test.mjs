import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCloudRecords} from '../src/cloud-records.js';
const kinds=['request','vendor','approval','alias','file','batch'];
function fixture({fail=false,timeout=false}={}){
 let active=0,peak=0;const calls=[];
 const rows=kinds.flatMap((kind,index)=>Array.from({length:kind==='request'?2432:kind==='batch'?72:3},(_,n)=>({id:String(index*10000+n).padStart(6,'0'),kind})));
 const client={from(table){const args={table,limit:0,filters:{}};const q={select(){return q},eq(k,v){args.filters[k]=v;return q},order(){return q},limit(n){args.limit=n;return q},gt(k,v){args.last=v;return q},then(resolve,reject){calls.push(args);active++;peak=Math.max(peak,active);return new Promise(r=>setTimeout(r,1)).then(()=>{active--;if(fail&&args.filters.kind==='vendor')return {error:{code:'42501'}};if(timeout&&args.limit>125)return {error:{code:'57014'}};return {data:rows.filter(r=>r.kind===args.filters.kind&&(!args.last||r.id>args.last)).slice(0,args.limit)}}).then(resolve,reject)}};return q}};
 return {client,rows,calls,peak:()=>peak};
}
test('loads every kind without omissions while limiting concurrent requests',async()=>{const f=fixture();const result=await loadCloudRecords(f.client,'p');assert.deepEqual(result,f.rows);assert.equal(f.peak(),3);assert.ok(f.calls.every(c=>c.filters.project_id==='p'));assert.equal(f.calls.filter(c=>c.filters.kind==='request').length,5);console.log('2,432 requests: 5 data requests instead of 13 at page size 200')});
test('adaptive retries preserve all rows with parallel readers',async()=>{const f=fixture({timeout:true});assert.deepEqual(await loadCloudRecords(f.client,'p'),f.rows)});
test('failed group rejects the entire load',async()=>{const f=fixture({fail:true});await assert.rejects(loadCloudRecords(f.client,'p'),e=>e.code==='42501')});
