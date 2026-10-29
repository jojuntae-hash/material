const scale=100000;
const personKey=v=>String(v||'').trim().replace(/\s+/g,' ');
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
export function toolSummary(data){
 if(!data.name?.trim())throw Error('공도구 품명을 확인하세요.');
 if(data.photos!==undefined&&(!Array.isArray(data.photos)||data.photos.length>8||data.photos.some(p=>!p||typeof p.name!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(p.url||''))||data.photos.reduce((n,p)=>n+p.url.length,0)>4*1024*1024))throw Error('공도구 사진은 JPEG 형식 8장, 전체 4MB 이하로 저장하세요.');
 const events=data.events||[],ids=new Set(),cancelled=new Set();
 for(const x of events){if(!x.id||ids.has(x.id))throw Error('중복된 기록입니다.');ids.add(x.id);if(x.type==='cancel'){const target=events.find(y=>y.id===x.eventId);if(!target||target.type==='cancel'||cancelled.has(x.eventId)||!x.reason?.trim())throw Error('취소 대상과 사유를 확인하세요.');cancelled.add(x.eventId);}else{if(!['receive','issue','return'].includes(x.type)||!validDate(x.date)||!Number.isFinite(x.quantity)||x.quantity<=0||!Number.isSafeInteger(Math.round(x.quantity*scale))||Math.abs(x.quantity*scale-Math.round(x.quantity*scale))>0.00001)throw Error('날짜와 양수 수량(소수 다섯 자리 이하)을 확인하세요.');if(x.type!=='receive'&&!personKey(x.person))throw Error('수령자 이름을 입력하세요.');}}
 const active=events.filter(x=>x.type!=='cancel'&&!cancelled.has(x.id)).sort((a,b)=>a.date.localeCompare(b.date));
 let stock=0,received=0,issued=0,returned=0,lastReceived='';const holders=new Map();
 for(const x of active){const qty=Math.round(x.quantity*scale),p=personKey(x.person);if(x.type==='receive'){stock+=qty;received+=qty;lastReceived=x.date;}if(x.type==='issue'){stock-=qty;issued+=qty;holders.set(p,(holders.get(p)||0)+qty);}if(x.type==='return'){stock+=qty;returned+=qty;holders.set(p,(holders.get(p)||0)-qty);if(holders.get(p)<0)throw Error('해당 수령자가 가져간 수량보다 많이 반납할 수 없습니다.');}if(stock<0)throw Error('지급일 기준 보유수량이 부족합니다. 현장 입고일과 수량을 먼저 확인하세요.');}
 return {stock:stock/scale,received:received/scale,issued:issued/scale,returned:returned/scale,lastReceived,holders:[...holders].filter(([,q])=>q>0).map(([person,q])=>({person,quantity:q/scale})),active,cancelled};
}
export function addToolEvent(data,event){const next={...data,events:[...(data.events||[]),event]};toolSummary(next);return next;}
export function editToolEvent(data,eventId,replacement,cancellation){
 const summary=toolSummary(data),index=(data.events||[]).findIndex(x=>x.id===eventId),old=data.events[index];
 if(!old||old.type==='cancel'||summary.cancelled.has(eventId))throw Error('수정할 수 없는 기록입니다.');
 if(replacement.type!==old.type||cancellation.type!=='cancel'||cancellation.eventId!==eventId)throw Error('수정 기록의 종류를 확인하세요.');
 const events=[...data.events];events.splice(index+1,0,replacement);events.push(cancellation);
 const next={...data,events};toolSummary(next);return next;
}
export function toolReceiptDays(records){
 const days=new Map();
 for(const r of records){
  if(r.kind!=='batch'||r.deleted||r.data.type!=='tool-ledger'||r.data.archived)continue;
  for(const x of toolSummary(r.data).active){if(x.type!=='receive')continue;
   if(!days.has(x.date))days.set(x.date,[]);
   days.get(x.date).push({toolId:r.id,eventId:x.id,name:r.data.name,spec:r.data.spec||'',unit:r.data.unit||'',quantity:x.quantity,note:x.note||'',person:x.person||''});
  }
 }
 const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
 return [...days].sort(([a],[b])=>b.localeCompare(a)).map(([date,rows])=>({date,rows:rows.sort((a,b)=>collator.compare(a.name,b.name)||collator.compare(a.spec,b.spec)||a.eventId.localeCompare(b.eventId))}));
}
export const toolReceiptFields=[['name','공구명'],['spec','규격'],['quantity','입고수량'],['date','입고일'],['note','메모']];
export function toolReceiptRows(records,{key='date',direction='desc'}={}){
 if(!toolReceiptFields.some(([field])=>field===key))key='date';
 const rows=toolReceiptDays(records).flatMap(day=>day.rows.map(row=>({...row,date:day.date}))),collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'}),sign=direction==='asc'?1:-1;
 const blank=v=>v===null||v===undefined||String(v).trim()==='';
 return rows.sort((a,b)=>{const av=a[key],bv=b[key],ab=blank(av),bb=blank(bv);if(ab!==bb)return ab?1:-1;const result=ab?0:key==='quantity'?av-bv:collator.compare(String(av),String(bv));return result*sign||collator.compare(a.name,b.name)||collator.compare(a.spec,b.spec)||a.toolId.localeCompare(b.toolId)||a.eventId.localeCompare(b.eventId);});
}
export const toolMovementFields=[['type','구분'],['name','공구명'],['spec','규격'],['quantity','수량'],['receiveDate','입고일'],['issueDate','지급일'],['returnDate','반납일'],['person','수령자'],['note','메모']];
export function toolMovementRows(records,{key='date',direction='desc',type=''}={}){
 if(key!=='date'&&!toolMovementFields.some(([field])=>field===key))key='date';
 const rows=[];
 for(const r of records){if(r.kind!=='batch'||r.deleted||r.data.type!=='tool-ledger'||r.data.archived)continue;
  for(const [eventOrder,x] of toolSummary(r.data).active.entries()){if(type&&x.type!==type)continue;rows.push({eventOrder,at:x.at||'',toolId:r.id,eventId:x.id,name:r.data.name,spec:r.data.spec||'',unit:r.data.unit||'',type:x.type,quantity:x.quantity,date:x.date,receiveDate:x.type==='receive'?x.date:'',issueDate:x.type==='issue'?x.date:'',returnDate:x.type==='return'?x.date:'',person:x.person||'',note:x.note||''});}
 }
 const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'}),sign=direction==='asc'?1:-1,blank=v=>v===null||v===undefined||String(v).trim()==='';
 const rank={receive:0,issue:1,return:2};
 return rows.sort((a,b)=>{const av=a[key],bv=b[key],ab=blank(av),bb=blank(bv);if(ab!==bb)return ab?1:-1;const result=ab?0:key==='quantity'?av-bv:key==='type'?rank[av]-rank[bv]:collator.compare(String(av),String(bv));return result*sign||b.date.localeCompare(a.date)||String(b.at).localeCompare(String(a.at))||(a.toolId===b.toolId?b.eventOrder-a.eventOrder:0)||collator.compare(a.name,b.name)||collator.compare(a.spec,b.spec)||a.toolId.localeCompare(b.toolId)||a.eventId.localeCompare(b.eventId);});
}
