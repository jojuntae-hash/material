import {esc,uuid} from './core.js';
import {requestToolData} from './request-tool-core.js';
import {toolOwnershipLabel,toolOwnership} from './tool-ownership.js';
import {nextToolOrder} from './tool-ledger-extras.js';
let initialized=false;
export function setupRequestToolImport({getStore,rerender,notice,dialog,today}){
 if(initialized)return;initialized=true;let context=null,busy=false;
 const scope=s=>JSON.stringify([s.mode,s.projectId,s.session?.user?.id]);
 const tools=s=>s.records.filter(r=>r.kind==='batch'&&!r.deleted&&r.data.type==='tool-ledger'&&!r.data.archived);
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-tool-action="from-request"]');if(!button||busy)return;
  const store=getStore(),request=store.records.find(r=>r.id===button.dataset.requestId&&r.kind==='request');if(!request||store.role==='viewer')return;
  context={scope:scope(store),requestId:request.id,requestVersion:request.version,versions:new Map(tools(store).map(r=>[r.id,r.version]))};
  const d=request.data;
  dialog(`<div class="modal-body"><h2>청구내역을 공도구로 추가</h2><p>${esc(d.name)} · ${esc(d.spec||'규격 없음')} · 청구 ${esc(d.quantity)} ${esc(d.unit||'')}</p><form id="request-tool-import" class="request-tool-fields"><label>연결할 공구<select name="target"><option value="">＋ 새 공구로 등록</option>${tools(store).map(r=>`<option value="${esc(r.id)}">${esc(r.data.name)} · ${esc(r.data.spec||'규격 없음')} · ${esc(r.data.unit)} [${esc(toolOwnershipLabel(r.data))}]</option>`).join('')}</select></label><label>소유 구분<select name="ownership" required><option value="">선택하세요</option><option value="own">우리 공구</option><option value="hq">본사 물량</option><option value="unknown" hidden>미분류</option></select></label><label>공구명<input name="name" value="${esc(d.name)}" required></label><label>규격<input name="spec" value="${esc(d.spec||'')}"></label><label>단위<input name="unit" value="${esc(d.unit||'EA')}" required></label><label>수량<input name="quantity" type="number" step="any" min="0.00001" value="${esc(d.quantity>0?d.quantity:1)}" required></label><label class="check-label"><input name="receive" type="checkbox">실제 입고도 함께 기록</label><label>실제 입고일<input name="date" type="date" value="${today()}" disabled required></label><p class="help">기존 공구를 선택하면 이름이 달라도 해당 공구에 연결됩니다. 소유 구분이 다른 공구는 새로 등록하세요. 입고 체크가 없으면 재고는 증가하지 않습니다.</p><button class="btn primary" type="submit">공도구에 추가</button></form></div>`,true);
 });
 document.addEventListener('change',event=>{
  const form=event.target.closest('#request-tool-import');if(!form)return;
  if(event.target.name==='receive')form.elements.date.disabled=!event.target.checked;
  if(event.target.name==='target'){
   const target=tools(getStore()).find(r=>r.id===event.target.value),request=getStore().records.find(r=>r.id===context?.requestId);
   for(const key of ['name','spec']){form.elements[key].value=target?target.data[key]||'':request?.data[key]||'';form.elements[key].readOnly=!!target;}
   form.elements.ownership.value=target?toolOwnership(target.data):'';form.elements.ownership.disabled=!!target;
  }
 });
 document.addEventListener('submit',event=>{
  const form=event.target;if(form.id!=='request-tool-import')return;event.preventDefault();if(busy)return;
  (async()=>{busy=true;const submit=form.querySelector('[type="submit"]');submit.disabled=true;
   try{
    const store=getStore();if(!context||scope(store)!==context.scope||store.role==='viewer')throw Error('현장 또는 권한이 변경되었습니다. 다시 여세요.');
    const source=store.records.find(r=>r.id===context.requestId);if(!source||source.version!==context.requestVersion)throw Error('청구내역이 변경되었습니다. 다시 여세요.');
    if(store.records.some(r=>!r.deleted&&r.kind==='batch'&&r.data.type==='tool-ledger'&&(r.data.requestTransfers||[]).some(t=>t.requestId===source.id)))throw Error('이미 공도구로 추가한 청구내역입니다.');
    const fd=new FormData(form),targetId=fd.get('target'),target=targetId?tools(store).find(r=>r.id===targetId):null;
    if(targetId&&(!target||target.version!==context.versions.get(targetId)))throw Error('공구 내역이 변경되었습니다. 다시 여세요.');
    const data=requestToolData({request:source,target,ownership:fd.get('ownership'),name:fd.get('name'),spec:fd.get('spec'),unit:fd.get('unit'),quantity:Number(fd.get('quantity')),receive:fd.has('receive'),date:fd.get('date'),eventId:uuid(),at:new Date().toISOString()});
    if(!target)data.order=nextToolOrder(tools(store));
    await store.apply([{id:target?.id||uuid(),kind:'batch',data,version:target?.version||0,deleted:false}],'청구내역에서 공도구 연결','공도구 연결',source.id);
    if(scope(store)!==context.scope)return;form.closest('dialog')?.close();rerender();notice(fd.has('receive')?'공도구 연결과 실제 입고를 기록했습니다.':'공도구 대장에 연결했습니다. 실제 입고는 별도로 기록하세요.');
   }catch(error){notice(error.message,true);}finally{busy=false;if(submit.isConnected)submit.disabled=false;}
  })();
 });
}
