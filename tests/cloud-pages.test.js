import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCloudPages} from '../src/cloud-pages.js';
test('timeout reduces only the failed page and preserves cursor without losing rows',async()=>{
 const source=Array.from({length:430},(_,id)=>({id})),calls=[];
 const result=await loadCloudPages(async ({offset,limit,last})=>{
  calls.push({offset,limit,last:last?.id});
  if(offset===200&&limit>50)return {error:{code:'57014'}};
  return {data:source.slice(offset,offset+limit)};
 });
 assert.deepEqual(result,source);
 assert.deepEqual(calls.slice(1,4),[{offset:200,limit:200,last:199},{offset:200,limit:100,last:199},{offset:200,limit:50,last:199}]);
});
test('history is bounded at 500 rows',async()=>{
 let count=0;
 const result=await loadCloudPages(async ({limit})=>{count++;return {data:Array.from({length:limit},()=>({id:count}))}},{pageSize:50,maxRows:500});
 assert.equal(result.length,500);assert.equal(count,10);
});
test('permission failures are not retried',async()=>{
 let calls=0;const error={code:'42501',message:'permission denied'};
 await assert.rejects(loadCloudPages(async()=>{calls++;return {error}}),e=>e===error);assert.equal(calls,1);
});
test('persistent timeout stops at the minimum page size',async()=>{
 let calls=0;
 await assert.rejects(loadCloudPages(async()=>{calls++;return {error:{code:'57014'}}}),e=>e.code==='57014');assert.equal(calls,4);
});
