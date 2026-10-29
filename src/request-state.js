import {receiptSummary} from './receipts.js';
export const requestInactive=d=>!!(d.requestCancellation?.active||d.requestArchived);
export function changeRequestState(data,action,reason,actor,at=new Date().toISOString()){
 if(!String(reason||'').trim())throw Error('사유를 입력하세요.');
 const next=structuredClone(data);
 if(action==='cancel'){
  if(data.requestArchived||data.requestCancellation?.active)throw Error('이미 취소되었거나 삭제된 청구입니다.');
  if(receiptSummary(data).received>0)throw Error('입고 기록이 있습니다. 입고 취소 또는 반품 여부를 먼저 확인하세요. 전체 청구 취소만 지원합니다.');
  next.requestCancellation={active:true,reason:reason.trim(),actor,at};
 }else if(action==='resume'){
  if(!data.requestCancellation?.active)throw Error('취소된 청구가 아닙니다.');
  next.requestCancellation={...data.requestCancellation,active:false,restoredAt:at,restoredBy:actor};
 }else if(action==='archive'){
  if(data.requestArchived)throw Error('이미 삭제된 청구입니다.');
  next.requestArchived=true;
 }else if(action==='restore'){
  if(!data.requestArchived)throw Error('삭제된 청구가 아닙니다.');
  next.requestArchived=false;
 }else throw Error('지원하지 않는 작업입니다.');
 next.requestStateHistory=[...(data.requestStateHistory||[]),{action,reason:reason.trim(),actor,at}];return next;
}
