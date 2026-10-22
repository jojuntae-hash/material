import {idb} from './store.js';
import {uuid} from './core.js';
export async function applyLocalUpdate(store){
 if(!import.meta.env.DEV||store.mode!=='local')return;
 const response=await fetch('/__local_update');if(!response.ok)return;
 const update=await response.json();
 if(store.records.some(r=>r.id===update.id&&!r.deleted)){
  const ops=[];
  for(const incoming of update.records){const old=store.records.find(r=>r.id===incoming.id&&!r.deleted);if(!old||old.data.manual)continue;
   const keys=['manufacturerId','dealerId','vendorResolution','vendorIssues'];
   if(keys.some(k=>JSON.stringify(old.data[k])!==JSON.stringify(incoming.data[k])))ops.push({...old,data:{...old.data,...Object.fromEntries(keys.map(k=>[k,incoming.data[k]]))}});
  }
  for(const a of update.aliases)if(!store.records.some(r=>r.kind==='alias'&&!r.deleted&&r.data.alias===a.data.alias&&r.data.role===a.data.role))ops.push({...a,version:0});
  if(ops.length)await store.apply(ops,'업체 목록 대조 후 약칭 연결 보완 (직접 수정한 항목 제외)','업체명 정리');
  return;
 }
 const snapshot=await store.snapshot();await idb('state','before-period-replacement',{...snapshot,at:new Date().toISOString(),start:update.start,end:update.end});
 const targets=store.records.filter(r=>r.kind==='request'&&!r.deleted&&r.data.date>=update.start&&r.data.date<=update.end);
 const ops=targets.map(r=>({...r,deleted:true}));
 for(const a of update.aliases)if(!store.records.some(r=>r.kind==='alias'&&!r.deleted&&r.data.alias===a.data.alias&&r.data.role===a.data.role))ops.push({...a,version:0});
 const fileResponse=await fetch('/__local_file?id='+update.fileIndex);if(!fileResponse.ok)throw Error('교체 원본 파일을 읽지 못했습니다.');
 const meta=await store.putFile(new File([await fileResponse.arrayBuffer()],update.filename),'replacement');
 ops.push(...update.records.map(r=>({...r,version:0})),{id:meta.id,kind:'file',data:meta,version:0},{id:update.id,kind:'batch',version:0,data:{filename:update.filename,sheet:'자재청구내역서',applied:update.records.length,pending:[],replacement:true,replaced:targets.length,start:update.start,end:update.end,hash:update.hash,fileId:meta.id,at:new Date().toISOString()}});
 await store.apply(ops,`${update.start}~${update.end} 사용자 제공 엑셀로 교체`,'기간 내역 교체',update.id);
 store.files.push(meta);await store.persist();
}
