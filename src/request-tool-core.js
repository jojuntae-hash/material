import {addToolEvent} from './tool-ledger-core.js';
import {requestInactive} from './request-state.js';
export function requestToolData({request,target=null,ownership,name,spec,unit,quantity,receive=false,date,eventId,at}){
 if(!request||request.kind!=='request'||request.deleted||requestInactive(request.data))throw Error('유효한 청구내역을 선택하세요.');
 if(!Number.isFinite(quantity)||quantity<=0||quantity>1e12)throw Error('수량은 0보다 크게 입력하세요.');
 if(target&&(target.deleted||target.data.archived||target.kind!=='batch'||target.data.type!=='tool-ledger'))throw Error('등록 공구를 다시 선택하세요.');
 if(!target&&!['own','hq'].includes(ownership))throw Error('새 공구의 소유 구분을 선택하세요.');
 if(target&&String(target.data.unit||'').trim()!==String(unit||'').trim())throw Error('청구 단위와 등록 공구의 단위가 다릅니다. 수량을 변환한 뒤 단위를 등록 공구와 맞춰 주세요.');
 let data=target?structuredClone(target.data):{type:'tool-ledger',name:String(name||'').trim(),spec:String(spec||'').trim(),unit:String(unit||'').trim(),ownership,events:[],addedAt:at};
 if(!data.name||!data.unit)throw Error('공구명과 단위를 입력하세요.');
 if((data.requestTransfers||[]).some(t=>t.requestId===request.id))throw Error('이미 연결한 청구내역입니다.');
 data.sourceRequestIds=[...new Set([...(data.sourceRequestIds||[]),request.id])];
 data.requestTransfers=[...(data.requestTransfers||[]),{requestId:request.id,sourceVersion:request.version,sourceName:request.data.name,sourceSpec:request.data.spec||'',quantity,received:receive,eventId:receive?eventId:'',at}];
 if(receive)data=addToolEvent(data,{id:eventId,type:'receive',date,quantity,note:`청구내역 연결: ${request.data.name} ${request.data.spec||''}`,sourceRequestId:request.id,at});
 return data;
}
