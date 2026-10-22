import {idb} from './store.js';import {rebuildContactOps} from './contacts.js';
export async function applyContactUpdate(store){
 if(!import.meta.env.DEV||store.mode!=='local')return;
 const res=await fetch('/__local_contacts');if(!res.ok)return;
 const update=await res.json();if(store.records.some(r=>r.id===update.id&&!r.deleted))return;
 await idb('state','before-contacts-v2',{...await store.snapshot(),at:new Date().toISOString()});
 const ops=rebuildContactOps(store.records,update.contacts);
 ops.push({id:update.id,kind:'batch',version:0,data:{filename:update.filename,contactRebuild:true,applied:update.contacts.length,pending:[],unresolvedSourceRows:update.pending,at:new Date().toISOString()}});
 await store.apply(ops,'사용자 요청: 기존 연락처 전체 교체, 기계(연락처)·소방(연락처) 원본 행 재정리','업체연락처 재등록',update.id);
}
