// Receipt and cancellation events stay in the request JSON and existing audit trail.
const scale=100000;
const units=n=>Math.round(n*scale);
export function receiptSummary(data){
 const events=data.receipts||[],cancelled=new Set(events.filter(x=>x.type==='cancel').map(x=>x.receiptId));
 const active=events.filter(x=>x.type==='receive'&&!cancelled.has(x.id));
 const received=active.reduce((n,x)=>n+units(x.quantity),0)/scale;
 const valid=typeof data.quantity==='number'&&Number.isFinite(data.quantity)&&data.quantity>0;
 const remaining=valid?Math.max(0,units(data.quantity)-units(received))/scale:null;
 return {active,received,remaining,status:received===0?'미입고':valid&&remaining===0?'입고완료':'일부입고'};
}
export function validateReceipts(data){
 if(data.receipts===undefined)return;
 if(!Array.isArray(data.receipts))throw Error('입고 이력 형식을 확인하세요.');
 const seen=new Map(),cancelled=new Set();
 for(const x of data.receipts){
  if(!x.id||seen.has(x.id)||!x.actor||!Number.isFinite(Date.parse(x.at)))throw Error('입고 이력 정보를 확인하세요.');
  if(x.type==='receive'){
   if(typeof x.quantity!=='number'||!Number.isFinite(x.quantity)||x.quantity<=0||Math.abs(x.quantity-units(x.quantity)/scale)>1e-9)throw Error('입고수량은 소수점 다섯 자리 이하의 양수로 입력하세요.');
  }else if(x.type==='cancel'){
   if(seen.get(x.receiptId)?.type!=='receive'||cancelled.has(x.receiptId)||!x.reason?.trim())throw Error('취소할 입고와 취소 사유를 확인하세요.');
   cancelled.add(x.receiptId);
  }else throw Error('입고 이력 유형을 확인하세요.');
  seen.set(x.id,x);
 }
 const s=receiptSummary(data);
 if(s.received>0&&(s.remaining===null||units(s.received)>units(data.quantity)))throw Error('청구수량은 누적 입고수량 이상이어야 합니다.');
}
export function addReceipt(data,{quantity,actor,at=new Date().toISOString(),id=crypto.randomUUID()}){
 validateReceipts(data);
 const s=receiptSummary(data),q=typeof quantity==='string'&&quantity.trim()===''?NaN:Number(quantity);
 if(s.remaining===null)throw Error('청구수량을 양수로 확인한 뒤 입고 처리하세요.');
 if(!Number.isFinite(q)||q<=0||Math.abs(q-units(q)/scale)>1e-9)throw Error('입고수량은 소수점 다섯 자리 이하의 양수로 입력하세요.');
 if(units(q)>units(s.remaining))throw Error('입고수량이 미입고 수량을 초과합니다.');
 const next={...data,receipts:[...(data.receipts||[]),{id,type:'receive',quantity:q,actor,at}]};
 validateReceipts(next);return next;
}
export function cancelReceipt(data,{receiptId,reason,actor,at=new Date().toISOString(),id=crypto.randomUUID()}){
 validateReceipts(data);
 if(!receiptSummary(data).active.some(x=>x.id===receiptId))throw Error('이미 취소되었거나 없는 입고입니다.');
 const next={...data,receipts:[...(data.receipts||[]),{id,type:'cancel',receiptId,reason:String(reason||'').trim(),actor,at}]};
 validateReceipts(next);return next;
}
