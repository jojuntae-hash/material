const scale=100000;
const personKey=v=>String(v||'').trim().replace(/\s+/g,' ');
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
export function toolSummary(data){
 if(!data.name?.trim())throw Error('공도구 품명을 확인하세요.');
 const events=data.events||[],ids=new Set(),cancelled=new Set();
 for(const x of events){if(!x.id||ids.has(x.id))throw Error('중복된 기록입니다.');ids.add(x.id);if(x.type==='cancel'){const target=events.find(y=>y.id===x.eventId);if(!target||target.type==='cancel'||cancelled.has(x.eventId)||!x.reason?.trim())throw Error('취소 대상과 사유를 확인하세요.');cancelled.add(x.eventId);}else{if(!['receive','issue','return'].includes(x.type)||!validDate(x.date)||!Number.isFinite(x.quantity)||x.quantity<=0||!Number.isSafeInteger(Math.round(x.quantity*scale))||Math.abs(x.quantity*scale-Math.round(x.quantity*scale))>0.00001)throw Error('날짜와 양수 수량(소수 다섯 자리 이하)을 확인하세요.');if(x.type!=='receive'&&!personKey(x.person))throw Error('수령자 이름을 입력하세요.');}}
 const active=events.filter(x=>x.type!=='cancel'&&!cancelled.has(x.id)).sort((a,b)=>a.date.localeCompare(b.date));
 let stock=0,received=0,issued=0,returned=0,lastReceived='';const holders=new Map();
 for(const x of active){const qty=Math.round(x.quantity*scale),p=personKey(x.person);if(x.type==='receive'){stock+=qty;received+=qty;lastReceived=x.date;}if(x.type==='issue'){stock-=qty;issued+=qty;holders.set(p,(holders.get(p)||0)+qty);}if(x.type==='return'){stock+=qty;returned+=qty;holders.set(p,(holders.get(p)||0)-qty);if(holders.get(p)<0)throw Error('해당 수령자가 가져간 수량보다 많이 반납할 수 없습니다.');}if(stock<0)throw Error('지급일 기준 보유수량이 부족합니다. 현장 입고일과 수량을 먼저 확인하세요.');}
 return {stock:stock/scale,received:received/scale,issued:issued/scale,returned:returned/scale,lastReceived,holders:[...holders].filter(([,q])=>q>0).map(([person,q])=>({person,quantity:q/scale})),active,cancelled};
}
export function addToolEvent(data,event){const next={...data,events:[...(data.events||[]),event]};toolSummary(next);return next;}
