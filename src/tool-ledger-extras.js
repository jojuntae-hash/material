import * as XLSX from 'xlsx';
import {esc as e,uuid} from './core.js';
import {toolSummary} from './tool-ledger-core.js';

export function orderedTools(records){return [...records].sort((a,b)=>(a.data.order??Infinity)-(b.data.order??Infinity)||String(a.data.addedAt||'').localeCompare(String(b.data.addedAt||''))||a.id.localeCompare(b.id));}
export function nextToolOrder(records){return records.some(r=>r.data.order==null)?undefined:Math.max(-1,...records.map(r=>r.data.order))+1;}
export function moveToolOps(records,id,direction){
 const rows=orderedTools(records),i=rows.findIndex(r=>r.id===id),j=i+direction;
 if(i<0||j<0||j>=rows.length)return [];
 // Normalize existing ranks in one version-checked transaction, including old unranked entries.
 [rows[i],rows[j]]=[rows[j],rows[i]];
 return rows.flatMap((r,index)=>r.data.order===index?[]:[{id:r.id,kind:'batch',version:r.version,deleted:false,data:{...r.data,order:index}}]);
}
export function buildToolWorkbook(records){
 const rows=orderedTools(records),wb=XLSX.utils.book_new();
 const list=[['순서','품명','규격','단위','현장 입고','지급중','현재 보유','최근 입고일','현재 수령자 / 수량','사진 수']];
 const logs=[['품명','규격','단위','날짜','종류','수량','수령자','메모']];
 for(const r of rows){const d=r.data,s=toolSummary(d);list.push([list.length,d.name,d.spec||'',d.unit||'',s.received,s.issued-s.returned,s.stock,s.lastReceived,s.holders.map(h=>`${h.person} ${h.quantity}`).join(' / '),(d.photos||[]).length]);for(const x of s.active)logs.push([d.name,d.spec||'',d.unit||'',x.date,{receive:'입고',issue:'지급',return:'반납'}[x.type],x.quantity,x.person||'',x.note||'']);}
 for(const [name,data] of [['등록 공도구',list],['입출고 기록',logs]]){const ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=data[0].map((_,i)=>({wch:i===0?14:i===1?28:20}));ws['!autofilter']={ref:ws['!ref']};XLSX.utils.book_append_sheet(wb,ws,name);}return wb;
}

export function setupToolExtras({getStore,rerender,notice,dialog,run,tools,allTools,record,button,today}){
 let edit=null,photos=[],generation=0,processing=0;
 const canEdit=()=>getStore().role!=='viewer';
 const context=()=>{const s=getStore();return [s.mode,s.projectId,s.session?.user?.id].join(':');};
 let editContext='';
 function open(id){const r=id?record(id):null;if(id&&!r)return;generation++;processing=0;edit=r?{id:r.id,version:r.version}:null;editContext=context();photos=structuredClone(r?.data.photos||[]);
  dialog(`<div class="modal-body tool-editor"><h2>${r?'공도구 수정 · 사진':'공도구 직접 등록'}</h2><form id="tool-item-form"><div class="tool-item-fields"><label>품명<input name="name" value="${e(r?.data.name||'')}" required maxlength="200"></label><label>규격<input name="spec" value="${e(r?.data.spec||'')}" maxlength="200"></label><label>단위<input name="unit" value="${e(r?.data.unit||'EA')}" maxlength="30"></label></div><div class="tool-photo-drop" tabindex="0" role="group" aria-label="공도구 사진 붙여넣기"><b>사진 추가</b><span>사진을 끌어놓거나 이 영역을 선택하고 Ctrl+V로 붙여넣으세요.</span><input id="tool-photo-input" type="file" accept="image/*" multiple aria-label="사진 파일 선택"><small>최대 8장 · 장당 원본 15MB 이하 · 저장 시 크기를 줄입니다.</small></div><div id="tool-photo-list"></div><p id="tool-photo-status" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="btn secondary" data-action="close-modal">취소</button><button class="btn primary" type="submit">저장</button></div></form></div>`,true);renderPhotos();
 }
 function renderPhotos(){const box=document.getElementById('tool-photo-list');if(!box)return;box.innerHTML=photos.map((p,i)=>`<figure><a href="${e(p.url)}" download="${e(p.name)}" title="사진 내려받기"><img src="${e(p.url)}" alt="${e(p.name)}"></a><figcaption>${e(p.name)}</figcaption><button type="button" class="btn secondary" data-tool-action="photo-remove" data-index="${i}" aria-label="${e(p.name)} 사진 삭제">삭제</button></figure>`).join('');}
 async function compress(file){
  if(!file.type.startsWith('image/'))throw Error('사진 파일만 추가할 수 있습니다.');if(file.size>15*1024*1024)throw Error('사진 원본은 장당 15MB 이하로 선택하세요.');
  const bitmap=await createImageBitmap(file);try{const ratio=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return {id:uuid(),name:file.name||'붙여넣은 사진.jpg',url:canvas.toDataURL('image/jpeg',.78)};}finally{bitmap.close();}
 }
 async function addPhotos(files){const token=generation;if(!canEdit()||context()!==editContext)return;if(processing){notice('현재 사진 처리가 끝난 뒤 추가하세요.',true);return;}processing++;const status=document.getElementById('tool-photo-status');if(status)status.textContent='사진 처리 중…';try{for(const file of files){if(token!==generation||!document.getElementById('tool-item-form'))return;if(photos.length>=8)throw Error('사진은 공도구당 최대 8장까지 저장할 수 있습니다.');const photo=await compress(file);if(token!==generation||context()!==editContext)return;if(photos.reduce((n,p)=>n+p.url.length,photo.url.length)>4*1024*1024)throw Error('사진 용량이 큽니다. 사진 수나 크기를 줄여 주세요.');photos.push(photo);renderPhotos();}}catch(err){notice(err.message,true);}finally{if(token===generation){processing--;if(status)status.textContent=processing?'사진 처리 중…':`사진 ${photos.length}장 · 저장 버튼을 눌러 반영하세요.`;}}}
 document.addEventListener('change',ev=>{if(ev.target.id==='tool-photo-input')addPhotos([...ev.target.files]);});
 document.addEventListener('dragover',ev=>{if(ev.target.closest('.tool-photo-drop')){ev.preventDefault();ev.dataTransfer.dropEffect='copy';}});
 document.addEventListener('drop',ev=>{if(ev.target.closest('.tool-photo-drop')){ev.preventDefault();addPhotos([...ev.dataTransfer.files]);}});
 document.addEventListener('paste',ev=>{if(!ev.target.closest('.tool-editor'))return;const files=[...(ev.clipboardData?.items||[])].filter(i=>i.kind==='file').map(i=>i.getAsFile()).filter(Boolean);if(files.length){ev.preventDefault();addPhotos(files);}});
 document.addEventListener('submit',ev=>{if(ev.target.id!=='tool-item-form')return;ev.preventDefault();const form=ev.target;run(async()=>{if(processing)throw Error('사진 처리가 끝난 뒤 저장하세요.');if(context()!==editContext)throw Error('현장이 변경되었습니다. 다시 열어 주세요.');const r=edit?record(edit.id):null;if(edit&&(!r||r.version!==edit.version))throw Error('항목이 변경되었습니다. 다시 열어 주세요.');const fd=new FormData(form),data={...(r?.data||{type:'tool-ledger',events:[],order:nextToolOrder(tools()),addedAt:new Date().toISOString()}),name:String(fd.get('name')||'').trim(),spec:String(fd.get('spec')||'').trim(),unit:String(fd.get('unit')||'').trim(),photos:structuredClone(photos)};toolSummary(data);await getStore().save('batch',r?.id||'',data,r?.version||0,'공도구 품목·사진 저장','공도구 저장');generation++;document.querySelector('dialog')?.close();rerender();notice('공도구를 저장했습니다.');});});
 document.addEventListener('click',ev=>{const el=ev.target.closest('[data-tool-action]');if(!el)return;const action=el.dataset.toolAction;
  if(action==='manual'||action==='item-edit'){if(canEdit())open(el.dataset.id);}
  if(action==='photo-remove'){if(!canEdit()||processing)return;photos.splice(Number(el.dataset.index),1);renderPhotos();}
  if(action==='quantity-step'){const input=el.closest('.tool-quantity').querySelector('input');const value=Number(input.value)||0;input.value=String(Math.max(.00001,Math.round((value+Number(el.dataset.delta))*100000)/100000));input.dispatchEvent(new Event('input',{bubbles:true}));}
  if(action==='move')run(async()=>{const ops=moveToolOps(tools(),el.dataset.id,Number(el.dataset.direction));if(ops.length)await getStore().apply(ops,'공도구 순서 변경','공도구 정렬');rerender();document.querySelector('.tool-registered')?.setAttribute('open','');});
  if(action==='export'){try{XLSX.writeFile(buildToolWorkbook(tools()),`공도구대장_${today()}.xlsx`);}catch(err){notice(err.message,true);}}
  if(action==='purge'){if(getStore().role!=='admin')return;const r=allTools().find(r=>r.id===el.dataset.id&&r.data.archived);if(!r)return;dialog(`<div class="modal-body"><h2>공도구 완전 삭제</h2><p>${e(r.data.name)}의 입출고 기록과 사진을 삭제하며 목록에서 복구할 수 없습니다.</p><p>시스템 변경 감사이력과 기존 백업에는 과거 기록이 남을 수 있습니다.</p><div class="dialog-actions"><button class="btn secondary" data-action="close-modal">취소</button>${button('완전 삭제','purge-confirm',`data-id="${e(r.id)}" data-version="${r.version}"`)}</div></div>`);}
  if(action==='purge-confirm')run(async()=>{if(getStore().role!=='admin')throw Error('완전 삭제는 관리자만 가능합니다.');const r=allTools().find(r=>r.id===el.dataset.id&&r.data.archived);if(!r||r.version!==Number(el.dataset.version))throw Error('목록이 변경되었습니다. 다시 확인하세요.');await getStore().apply([{id:r.id,kind:'batch',version:r.version,deleted:true,data:{type:'tool-ledger'}}],'삭제 공도구 영구 제거','공도구 완전 삭제');document.querySelector('dialog')?.close();rerender();notice('공도구를 완전 삭제했습니다.');});
 });
}
