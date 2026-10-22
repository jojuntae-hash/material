import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {sha256,uuid,validateRecord} from './core.js';
export function download(bytes,name,type='application/octet-stream'){const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export async function buildBackup(store){
 const files={},manifest=[];
 for(const meta of store.files){const bytes=new Uint8Array(await store.getFile(meta));const hash=await sha256(bytes);files[`files/${meta.id}`]=bytes;manifest.push({...meta,hash});}
 const payload={format:'material-manager',version:1,projectName:store.projectName,projectId:store.projectId,createdAt:new Date().toISOString(),records:store.records,history:store.history,files:manifest};
 const json=strToU8(JSON.stringify(payload));files['data.json']=json;files['manifest.json']=strToU8(JSON.stringify({format:'material-manager',version:1,dataHash:await sha256(json),files:manifest.map(f=>({id:f.id,hash:f.hash,size:f.size}))}));
 return zipSync(files,{level:6});
}
export async function readBackup(file){
 if(file.size>100*1024*1024)throw Error('100MB 이하의 백업을 선택하세요.');
 let total=0;const files=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:f=>{total+=f.originalSize;if(total>250*1024*1024||f.originalSize>100*1024*1024)throw Error('백업 압축 해제 크기 제한을 초과했습니다.');return true;}});
 if(!files['data.json']||!files['manifest.json'])throw Error('올바른 전체 백업 파일이 아닙니다.');
 const manifest=JSON.parse(strFromU8(files['manifest.json'])),payload=JSON.parse(strFromU8(files['data.json']));
 if(manifest.format!=='material-manager'||payload.format!=='material-manager'||payload.version!==1||manifest.version!==1)throw Error('지원하지 않는 백업 형식입니다.');
 if(await sha256(files['data.json'])!==manifest.dataHash)throw Error('데이터 체크섬이 일치하지 않습니다.');
 if(!Array.isArray(payload.records)||!Array.isArray(payload.files)||payload.records.length>50000)throw Error('백업 데이터 구성을 확인하세요.');
 const ids=new Set();for(const r of payload.records){if(!/^[0-9a-f-]{36}$/i.test(r.id)||ids.has(r.id))throw Error('중복되거나 잘못된 데이터 ID가 있습니다.');ids.add(r.id);if(!['request','vendor','approval','alias','file','batch'].includes(r.kind))throw Error('알 수 없는 데이터 종류입니다.');if(!r.deleted)validateRecord(r.kind,r.data);}
 const vendors=new Set(payload.records.filter(r=>r.kind==='vendor'&&!r.deleted).map(r=>r.id));const approvals=new Set(payload.records.filter(r=>r.kind==='approval'&&!r.deleted).map(r=>r.id));
 for(const r of payload.records.filter(x=>!x.deleted)){
  const d=r.data;
  if(r.kind==='request'){for(const key of ['manufacturerId','dealerId'])if(d[key]&&!vendors.has(d[key]))throw Error('청구내역의 업체 연결이 누락되었습니다.');if(d.approvalId&&!approvals.has(d.approvalId))throw Error('승인 품목 연결이 누락되었습니다.');}
  if(r.kind==='alias'&&!vendors.has(d.vendorId))throw Error('별칭의 업체 연결이 누락되었습니다.');
  if(r.kind==='approval'&&d.options.some(o=>o.vendorId&&!vendors.has(o.vendorId)))throw Error('승인 제조사 연결이 누락되었습니다.');
 }
 for(const meta of payload.files){const bytes=files[`files/${meta.id}`];if(!bytes||await sha256(bytes)!==meta.hash)throw Error('원본 파일이 누락되거나 변경되었습니다: '+meta.name);}
 return {payload,files};
}
export async function applyBackup(store,backup){
 const before=await buildBackup(store);
 // Persist automatic pre-restore backup before changing any live records.
 const {idb}=await import('./store.js');await idb('state','last-restore-backup',{bytes:before,at:new Date().toISOString()});
 if(store.mode==='cloud'){const path=`${store.projectId}/backups/${uuid()}.zip`;const {error}=await store.client.storage.from('mm-files').upload(path,before,{contentType:'application/zip'});if(error)throw Error('복원 전 자동 백업 실패: '+error.message);}
 const payload=structuredClone(backup.payload);
 for(const meta of payload.files){const bytes=backup.files[`files/${meta.id}`];if(store.mode==='cloud'){meta.path=`${store.projectId}/restored/${uuid()}/${meta.id}`;const {error}=await store.client.storage.from('mm-files').upload(meta.path,bytes,{upsert:false});if(error)throw error;}else await idb('files',meta.id,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));}
 // Reference originals in local backups also receive a DB file row after cloud restore.
 payload.records=payload.records.filter(r=>r.kind!=='file');payload.records.push(...payload.files.map(f=>({id:f.id,kind:'file',data:f,version:1,deleted:false})));
 await store.restore(payload);
 return before;
}
