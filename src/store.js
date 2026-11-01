import {loadCloudRecords,recentRequestDate,mergeRecords} from './cloud-records.js';
import {loadCloudPages} from './cloud-pages.js';
import {createClient} from '@supabase/supabase-js';
import {uuid,validateRecord,sha256} from './core.js';
import {publicSupabaseConfig} from './public-config.js';
const DB='material-manager-v1';
const openDB=()=>new Promise((resolve,reject)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{q.result.createObjectStore('state');q.result.createObjectStore('files');};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
export async function idb(store,key,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,value===undefined?'readonly':'readwrite'),os=tx.objectStore(store),q=value===undefined?os.get(key):os.put(value,key);let result;q.onsuccess=()=>{result=q.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};});}
export const config=()=>({url:localStorage.getItem('mm-url')||import.meta.env.VITE_SUPABASE_URL||publicSupabaseConfig.url,key:localStorage.getItem('mm-key')||import.meta.env.VITE_SUPABASE_ANON_KEY||publicSupabaseConfig.key});
export class Store{
 constructor(){this.records=[];this.history=[];this.mode='local';this.role='admin';this.projectName='파주 콘텐츠시티';this.projectId='local';this.files=[];}
 async init(){
  const c=config();
  if(c.url&&c.key){this.client=createClient(c.url,c.key);const {data,error}=await this.client.auth.getSession();if(error)throw error;this.session=data.session;this.mode='cloud';if(this.session)await this.loadProjects();return;}
  const saved=await idb('state','local');
  if(saved){Object.assign(this,saved);this.mode='local';return;}
  if(import.meta.env.DEV){const r=await fetch('/__local_seed');if(r.ok){const seed=await r.json();this.records=seed.records;this.projectName=seed.projectName;for(let i=0;i<seed.files.length;i++){const response=await fetch('/__local_file?id='+(i+1));if(response.ok){const bytes=await response.arrayBuffer();const file={id:uuid(),name:seed.files[i],size:bytes.byteLength,hash:await sha256(bytes),path:'',type:'reference'};await idb('files',file.id,bytes);this.files.push(file);}}await this.persist();}}
 }
 async login(email,password){const {error}=await this.client.auth.signInWithPassword({email,password});if(error)throw error;this.session=(await this.client.auth.getSession()).data.session;await this.loadProjects();}
 async logout(){this.loadGeneration=(this.loadGeneration||0)+1;this.recordsPartial=false;this.olderLoading=false;await this.client.auth.signOut();this.session=null;this.records=[];this.files=[];}
 async loadProjects(){const {data,error}=await this.client.from('mm_members').select('project_id,role,mm_projects(name)');if(error)throw Error('Supabase 테이블을 준비하세요. '+error.message);this.projects=data||[];const last=localStorage.getItem('mm-project');const selected=this.projects.find(p=>p.project_id===last)||this.projects[0];if(selected)await this.selectProject(selected.project_id);else {this.projectId='';this.records=[];}}
 async createProject(name){const {data,error}=await this.client.rpc('mm_create_project',{p_name:name});if(error)throw error;await this.loadProjects();await this.selectProject(data);}
 async selectProject(id){this.projectId=id;localStorage.setItem('mm-project',id);const p=this.projects.find(x=>x.project_id===id);this.role=p.role;this.projectName=p.mm_projects.name;await this.refresh({recentFirst:true});}
 async refresh({recentFirst=false}={}){
  if(this.mode==='local')return;
  const projectId=this.projectId,generation=(this.loadGeneration||0)+1;this.loadGeneration=generation;
  this.recordsPartial=false;this.olderLoading=false;this.olderError='';
  const since=recentFirst?recentRequestDate():'';
  const records=await loadCloudRecords(this.client,projectId,recentFirst?{kinds:['request','vendor','alias'],requestsSince:since}:{});
  if(this.projectId!==projectId||this.loadGeneration!==generation)return;
  this.records=records;this.history=[];this.updateFiles();
  if(recentFirst){
   this.recordsPartial=true;this.recentSince=since;
   setTimeout(()=>{if(this.projectId===projectId&&this.loadGeneration===generation)this.loadOlder();},0);
  }
 }
 updateFiles(){for(const r of this.records){if(r.kind!=='request')continue;const d=r.data;if(d.quantity===null&&d.original?.quantity===null&&d.source?.file)d.quantityUnconfirmed=true;if(d.quantity<0&&d.quantity===d.original?.quantity&&d.source?.file)d.quantityOriginalAdjustment=true;}this.files=this.records.filter(r=>r.kind==='file'&&!r.deleted).map(r=>({...r.data,id:r.id}));}
 async loadOlder(){
  if(!this.recordsPartial||this.olderLoading)return;
  const projectId=this.projectId,generation=this.loadGeneration;
  const current=()=>this.projectId===projectId&&this.loadGeneration===generation&&!!this.session;
  this.olderLoading=true;this.olderError='';this.onDataChange?.();
  try{
   await loadCloudRecords(this.client,projectId,{kinds:['request','approval','file','batch'],requestsBefore:this.recentSince,onGroup:rows=>{
    if(!current())return;
    this.records=mergeRecords(this.records,rows);this.updateFiles();this.onDataChange?.();
   }});
   if(current())this.recordsPartial=false;
  }catch(error){if(current())this.olderError=error.message||'이전 내역을 불러오지 못했습니다.';}
  finally{if(current()){this.olderLoading=false;this.onDataChange?.();}}
 }
 async loadHistory(recordId=''){
  if(this.mode==='local')return recordId?this.history.filter(h=>h.record_id===recordId):this.history;
  const projectId=this.projectId;
  const history=await loadCloudPages(({offset,limit})=>{
   let query=this.client.from('mm_audit').select('*').eq('project_id',projectId);
   if(recordId)query=query.eq('record_id',recordId);
   return query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+limit-1);
  },{pageSize:50,maxRows:100});
  if(this.projectId!==projectId)return [];
  this.history=recordId?[...this.history.filter(h=>h.record_id!==recordId),...history]:history;
  return history;
 }
 async persist(){if(this.mode==='local')await idb('state','local',{records:this.records,history:this.history,files:this.files,projectName:this.projectName,role:'admin',projectId:'local'});}
 async snapshot(){
  if(this.mode==='cloud'){const {data,error}=await this.client.rpc('mm_snapshot',{p_project:this.projectId});if(error)throw error;return {records:data.records,history:data.history,files:data.records.filter(r=>r.kind==='file'&&!r.deleted).map(r=>({...r.data,id:r.id}))};}
  const data=await idb('state','local');return data||{records:this.records,history:this.history,files:this.files};
 }
 async save(kind,id,data,version,reason,action='수정'){
  if(this.recordsPartial)throw Error('전체 내역을 불러온 뒤 저장할 수 있습니다.');
  validateRecord(kind,data);
  const record={id:id||uuid(),kind,data,version:version||0,deleted:false};
  await this.apply([record],reason,action);return record.id;
 }
 async apply(ops,reason,action='수정',operationId=uuid()){
  if(this.recordsPartial)throw Error('전체 내역을 불러온 뒤 변경할 수 있습니다.');
  if(!reason?.trim())throw Error('변경 사유를 입력하세요.');
  if(this.role==='viewer')throw Error('조회 권한으로는 변경할 수 없습니다.');
  ops.forEach(o=>{if(!o.deleted&&o.kind!=='file')validateRecord(o.kind,o.data);});
  if(this.mode==='cloud'){
   const {error}=await this.client.rpc('mm_apply',{p_project:this.projectId,p_ops:ops,p_reason:reason,p_action:action,p_operation:operationId});if(error)throw Error(error.message);await this.refresh();return;
  }
  // Refresh latest persisted version before comparing to catch another browser tab.
  const latest=await idb('state','local');if(latest)this.records=latest.records;
  for(const op of ops){const old=this.records.find(r=>r.id===op.id);if((old?.version||0)!==op.version)throw Error('다른 화면에서 수정되었습니다. 새로고침 후 다시 확인하세요.');}
  const before=structuredClone({records:this.records,history:this.history});
  for(const op of ops){const index=this.records.findIndex(r=>r.id===op.id),old=index<0?null:structuredClone(this.records[index]);const next={...op,version:(old?.version||0)+1,updated_at:new Date().toISOString()};if(index<0)this.records.push(next);else this.records[index]=next;this.history.unshift({id:uuid(),record_id:op.id,kind:op.kind,before:old,after:structuredClone(next),reason,action,actor:'로컬 사용자',created_at:next.updated_at});}
  try{await this.persist();}catch(e){this.records=before.records;this.history=before.history;throw e;}
 }
 async putFile(file,type='upload'){
  const bytes=await file.arrayBuffer(),hash=await sha256(bytes),id=uuid();const meta={id,name:file.name,size:bytes.byteLength,hash,type,path:`${this.projectId}/${id}/${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`};
  if(this.mode==='cloud'){const {error}=await this.client.storage.from('mm-files').upload(meta.path,bytes,{contentType:file.type||'application/octet-stream',upsert:false});if(error)throw error;}
  else await idb('files',id,bytes);
  return meta;
 }
 async attachFile(meta){if(this.mode==='local'){this.files.push(meta);await this.persist();}else await this.apply([{id:meta.id,kind:'file',data:meta,version:0}], '원본 파일 보존','파일 등록');}
 async getFile(meta){if(this.mode==='cloud'){const {data,error}=await this.client.storage.from('mm-files').download(meta.path);if(error)throw error;return data.arrayBuffer();}const bytes=await idb('files',meta.id);if(!bytes)throw Error('원본 파일을 찾을 수 없습니다: '+meta.name);return bytes;}
 async restore(payload){
  if(this.role!=='admin')throw Error('복원은 관리자만 실행할 수 있습니다.');
  if(this.mode==='cloud'){const {error}=await this.client.rpc('mm_restore',{p_project:this.projectId,p_records:payload.records,p_reason:'전체 백업 복원',p_operation:uuid()});if(error)throw error;await this.refresh();}
  else{await idb('state','before-restore',{records:this.records,history:this.history,files:this.files,projectName:this.projectName,createdAt:new Date().toISOString()});const now=new Date().toISOString();this.records=payload.records;this.files=payload.files;this.history=[{id:uuid(),kind:'system',action:'전체 복원',reason:'복원 전 상태를 별도 보존',actor:'로컬 사용자',created_at:now},...(payload.history||[])];await this.persist();}
 }
}

