'use strict';
(() => {
const F=window.StatementFormats,RESERVED='_프로그램보관';
const key=s=>String(s||'').replaceAll('\\','/').normalize('NFC').toLowerCase();
const safe=s=>String(s||'').trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,100);
function checkPath(path){const p=String(path).replaceAll('\\','/');if(!p||p.startsWith('/')||p.includes(':')||p.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('허용되지 않는 파일 경로입니다.');return p.split('/');}
async function hash(input){const bytes=input instanceof Blob?await input.arrayBuffer():input;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');}
async function parent(root,path,create=false){const pieces=checkPath(path),name=pieces.pop();let dir=root;for(const part of pieces)dir=await dir.getDirectoryHandle(part,{create});return{dir,name};}
async function get(root,path){try{const {dir,name}=await parent(root,path);return await dir.getFileHandle(name);}catch(err){if(err.name==='NotFoundError')return null;throw err;}}
async function bytes(root,path){const handle=await get(root,path);if(!handle)throw Error('파일을 찾지 못했습니다: '+path);return(await handle.getFile()).arrayBuffer();}
async function write(root,path,value){const {dir,name}=await parent(root,path,true),file=await dir.getFileHandle(name,{create:true}),stream=await file.createWritable();try{await stream.write(value);await stream.close();}catch(err){try{await stream.abort();}catch{}throw err;}}
async function writeJson(root,path,value){await write(root,path,new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));}
async function readJson(root,path){return JSON.parse(new TextDecoder().decode(await bytes(root,path)));}
async function removeIf(root,path,expected){const handle=await get(root,path);if(!handle)return;if(await hash(await handle.getFile())!==expected)throw Error('파일이 다른 내용으로 변경되어 제거하지 않았습니다: '+path);const {dir,name}=await parent(root,path);await dir.removeEntry(name);}
function allocate(proposed,occupied,own=''){checkPath(proposed);const slash=proposed.lastIndexOf('/'),folder=slash<0?'':proposed.slice(0,slash+1),filename=proposed.slice(slash+1),dot=filename.lastIndexOf('.'),stem=dot>0?filename.slice(0,dot):filename,ext=dot>0?filename.slice(dot):'';let result=proposed,n=1;while(occupied.has(key(result))&&key(result)!==key(own))result=folder+stem+'_'+String(++n).padStart(2,'0')+ext;occupied.add(key(result));return result;}
function light(d){const {searchText,imagePath,...rest}=d;return structuredClone(rest);}
async function prepare({root,book,bookHash,documents,selected,action,target,entries,quantityEdits=[],itemEdits=[]}){
 if(!selected.length)throw Error('명세표를 먼저 체크해 주세요.');if(!['group','rename','archive','trash','quantity','items'].includes(action))throw Error('지원하지 않는 작업입니다.');
 target=String(target||'').trim();if(['group','rename'].includes(action)&&!target)throw Error('변경할 이름을 입력해 주세요.');if(target&&safe(target)!==target)throw Error('이름에 폴더에서 사용할 수 없는 문자가 있습니다.');if(target===RESERVED)throw Error('프로그램 보관용 이름은 사용할 수 없습니다.');
 const before=await bytes(root,book),beforeHash=await hash(before);if(beforeHash!==bookHash)throw Error('엑셀이 마지막 조회 후 변경되었습니다. 자료 새로고침 후 다시 선택해 주세요.');
 const id=new Date().toISOString().replace(/[:.]/g,'-')+'_'+crypto.randomUUID().slice(0,8),op=`${RESERVED}/작업기록/${id}`,occupied=new Set([...entries.keys()].map(key));
 const changes=[],images=[],archived=[],taken=new Map();let missing=0;
 for(const d of selected){
  if(action==='items'){changes.push({id:d.id,action:'items',items:itemEdits,date:d.date,company:d.company,source:d.source,newname:d.newname,management:d.management,originalCompany:d.originalCompany});continue;}
  if(action==='quantity'){const items=quantityEdits.filter(e=>String(e.id)===String(d.id)).map(({line,qty})=>({line,qty}));changes.push({id:d.id,action:'quantity',items});continue;}
  const source=d.imagePath||'',isRemoval=action==='archive'||action==='trash';if(!source&&!isRemoval)throw Error('이미지가 없는 문서는 분류·이름을 변경할 수 없습니다: '+(d.newname||d.source));
  let company=action==='rename'?target:d.company,management=action==='group'?target:action==='rename'&&(!d.management||d.management===d.company)?target:(d.management||d.company),newname=d.newname||d.source,relative=d.relative;
  if(isRemoval){changes.push({id:d.id,action:'remove'});if(!source){missing++;archived.push({...light(d),relative:'이미지/'+d.relative,notes:(d.notes||'')+' [이미지 없음: 엑셀 기록만 보관]'});continue;}relative=`${RESERVED}/${action==='trash'?'휴지통':'보관'}/${id}/이미지/${source}`;}
  else{if(action==='rename'){const ext=(newname.split('.').pop()||'jpg').toLowerCase();newname=(d.date||'날짜미상')+'_'+safe(company)+'.'+ext;}relative=`정리이미지/${safe(management)}/${newname}`;}
  if(source){
   const memo=key(source)+'|'+key(relative);if(taken.has(memo))relative=taken.get(memo);else{relative=allocate(relative,occupied,source);taken.set(memo,relative);const file=await get(root,source);if(!file)throw Error('이미지가 사라졌습니다. 새로고침해 주세요: '+source);const expected=await hash(await file.getFile());const backup=isRemoval?relative:op+'/원본이미지/'+source;images.push({source,target:relative,backup,hash:expected,removeSource:key(source)!==key(relative)&&!documents.some(x=>!selected.some(s=>s.key===x.key)&&key(x.imagePath)===key(source)),ready:false});}
  }
  if(!isRemoval)changes.push({id:d.id,action:'update',beforeCompany:d.company,originalCompany:d.originalCompany||d.company,company,management,newname:relative.split('/').pop(),relative});
  if(isRemoval)archived.push({...light(d),relative:relative.slice((`${RESERVED}/${action==='trash'?'휴지통':'보관'}/${id}/`).length),newname:relative.split('/').pop()});
 }
 const after=await F.patchWorkbook(before,changes),afterHash=await hash(after);
 const manifest={version:1,id,action,target,book,beforeHash,afterHash,createdAt:new Date().toISOString(),phase:'prepared',op,bookBackup:op+'/변경전.xlsx',images,changes,documentCount:selected.length,missingImages:missing,documents:selected.map(light)};
 return{manifest,before,after,archived};
}
async function rollback(root,manifest,bookUntouched=false){
 const backup=await bytes(root,manifest.bookBackup);if(await hash(backup)!==manifest.beforeHash)throw Error('변경 전 엑셀 백업의 무결성이 맞지 않습니다.');
 if(!bookUntouched){const current=await hash(await bytes(root,manifest.book));if(current!==manifest.beforeHash&&current!==manifest.afterHash)throw Error('작업 이후 엑셀이 다시 변경되었습니다. 후속 내용을 보호하기 위해 자동 복구를 중단했습니다.');}
 for(const image of manifest.images.filter(i=>i.ready)){
  const data=await bytes(root,image.backup);if(await hash(data)!==image.hash)throw Error('복구용 이미지가 변경되었습니다: '+image.backup);
  const original=await get(root,image.source);if(original){if(await hash(await original.getFile())!==image.hash)throw Error('원래 위치에 다른 이미지가 있습니다: '+image.source);}else await write(root,image.source,data);
 }
 if(!bookUntouched){const latest=await hash(await bytes(root,manifest.book));if(latest!==manifest.beforeHash&&latest!==manifest.afterHash)throw Error('복구 중 엑셀이 다시 변경되어 원본 덮어쓰기를 중단했습니다.');if(latest===manifest.afterHash)await write(root,manifest.book,backup);}
 for(const image of manifest.images.filter(i=>i.ready&&key(i.target)!==key(i.source)&&!i.target.startsWith(RESERVED+'/')))await removeIf(root,image.target,image.hash);
 manifest.phase='undone';manifest.restoredAt=new Date().toISOString();await writeJson(root,manifest.op+'/작업.json',manifest);await writeJson(root,RESERVED+'/최근작업.json',{op:manifest.op,book:manifest.book});
}
async function execute(root,plan,progress=()=>{}){
 const m=plan.manifest;let bookWritten=false,backupMade=false;
 const run=async()=>{if(await hash(await bytes(root,m.book))!==m.beforeHash)throw Error('엑셀이 변경되었습니다. 새로고침 후 작업을 다시 준비해 주세요.');
 try{
  if(await get(root,m.op+'/작업.json'))throw Error('같은 작업 기록이 이미 있습니다.');
  await write(root,m.bookBackup,plan.before);if(await hash(await bytes(root,m.bookBackup))!==m.beforeHash)throw Error('엑셀 백업 검증 실패');backupMade=true;
  await writeJson(root,m.op+'/작업.json',m);await writeJson(root,RESERVED+'/최근작업.json',{op:m.op,book:m.book});
  for(let n=0;n<m.images.length;n++){const image=m.images[n];progress(`이미지 사본 확인 ${n+1} / ${m.images.length}`);const original=await bytes(root,image.source);if(await hash(original)!==image.hash)throw Error('이미지가 준비 후 변경되었습니다: '+image.source);
   if(key(image.backup)!==key(image.source)){if(await get(root,image.backup))throw Error('백업 경로에 이미 파일이 있습니다.');await write(root,image.backup,original);if(await hash(await bytes(root,image.backup))!==image.hash)throw Error('이미지 백업 검증 실패');}
   image.ready=true;await writeJson(root,m.op+'/작업.json',m);if(key(image.target)!==key(image.source)&&key(image.target)!==key(image.backup)){if(await get(root,image.target))throw Error('대상 파일이 이미 있습니다. 덮어쓰지 않았습니다: '+image.target);await write(root,image.target,original);if(await hash(await bytes(root,image.target))!==image.hash)throw Error('이동 사본 검증 실패');}
   image.ready=true;await writeJson(root,m.op+'/작업.json',m);
  }
  if(plan.archived.length){const folder=`${RESERVED}/${m.action==='trash'?'휴지통':'보관'}/${m.id}`;await write(root,folder+'/보관명세표.xlsx',F.makeWorkbook(plan.archived));}
  m.phase='images_copied';await writeJson(root,m.op+'/작업.json',m);
  if(await hash(await bytes(root,m.book))!==m.beforeHash)throw Error('엑셀이 다른 작업에서 변경되었습니다. 덮어쓰지 않았습니다.');
  progress('엑셀에 변경 사항 반영 중');bookWritten=true;await write(root,m.book,plan.after);if(await hash(await bytes(root,m.book))!==m.afterHash)throw Error('저장된 엑셀 검증 실패');
  m.phase='workbook_saved';await writeJson(root,m.op+'/작업.json',m);
  const removed=new Set();for(const image of m.images){if(image.removeSource&&!removed.has(key(image.source))){await removeIf(root,image.source,image.hash);removed.add(key(image.source));}}
  m.phase='complete';m.completedAt=new Date().toISOString();await writeJson(root,m.op+'/작업.json',m);return m;
 }catch(err){if(backupMade){try{await rollback(root,m,!bookWritten);err.message+=' 변경 내용은 되돌렸습니다.';}catch(recovery){m.phase='needs_review';m.error=err.message;m.recoveryError=recovery.message;try{await writeJson(root,m.op+'/작업.json',m);}catch{}err.message+=' 자동 복구를 완료하지 못했습니다. '+recovery.message+' 백업 위치: '+m.op;}}throw err;}};
 if(navigator.locks){let result;await navigator.locks.request('statement-file-action:'+root.name,{ifAvailable:true},async lock=>{if(!lock)throw Error('다른 창에서 파일 작업 중입니다.');result=await run();});return result;}return run();
}
async function recent(root){const pointer=await get(root,RESERVED+'/최근작업.json');if(!pointer)return null;const record=await readJson(root,RESERVED+'/최근작업.json');return readJson(root,record.op+'/작업.json');}
async function undo(root,manifest){if(manifest.phase==='undone')throw Error('이미 되돌린 작업입니다.');if(navigator.locks){await navigator.locks.request('statement-file-action:'+root.name,{ifAvailable:true},async lock=>{if(!lock)throw Error('다른 창에서 파일 작업 중입니다.');await rollback(root,manifest);});}else await rollback(root,manifest);}
async function imageZip(documents,resolve){const result={},occupied=new Set();for(const d of documents){const file=await resolve(d);if(!file)throw Error('이미지가 없는 문서가 있습니다: '+(d.newname||d.source));const name=allocate(safe(d.newname||d.source),occupied);result[name]=new Uint8Array(await file.arrayBuffer());}return F.zipFiles(result);}
async function copyImages(targetRoot,documents,resolve,progress=()=>{}){
 const occupied=new Set();for await(const [name] of targetRoot.entries())occupied.add(key(name));const written=[];
 try{for(let n=0;n<documents.length;n++){const d=documents[n],file=await resolve(d);if(!file)throw Error('이미지가 없는 문서가 있습니다: '+(d.newname||d.source));const name=allocate(safe(d.newname||d.source),occupied);if(await get(targetRoot,name))throw Error('대상에 같은 파일이 생겼습니다. 덮어쓰지 않았습니다.');const expected=await hash(file);await write(targetRoot,name,file);if(await hash(await bytes(targetRoot,name))!==expected)throw Error('복사 파일 검증 실패');written.push({name,hash:expected});progress(`${n+1} / ${documents.length}장 복사`);}return written;}
 catch(err){for(const f of written){try{await removeIf(targetRoot,f.name,f.hash);}catch{}}throw err;}
}
window.StatementFiles={hash,prepare,execute,recent,undo,imageZip,copyImages,RESERVED};
})();
