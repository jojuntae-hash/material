export const requestSortFields=[['trade','분류'],['date','날짜'],['name','품명'],['spec','규격'],['unit','단위'],['quantity','수량'],['manufacturerId','원자재'],['dealerId','대리점'],['location','작업위치'],['applicant','신청자'],['note','비고']];
const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
export function sortRequests(rows,{key='date',direction='desc'}={},records=rows){
 if(!requestSortFields.some(([field])=>field===key))key='date';
 const sign=direction==='asc'?1:-1;
 const names=new Map(records.filter(r=>r.kind==='vendor').map(r=>[r.id,r.data.name]));
 const value=r=>key==='manufacturerId'?(names.get(r.data[key])||r.data.rawManufacturer||''):key==='dealerId'?(names.get(r.data[key])||r.data.rawDealer||''):r.data[key];
 const blank=v=>v===null||v===undefined||String(v).trim()==='';
 return [...rows].sort((a,b)=>{
  const av=value(a),bv=value(b),ab=blank(av),bb=blank(bv);
  if(ab!==bb)return ab?1:-1;
  const primary=ab?0:key==='quantity'?Number(av)-Number(bv):collator.compare(String(av),String(bv));
  return primary*sign||String(b.data.date||'').localeCompare(String(a.data.date||''))||String(a.id).localeCompare(String(b.id));
 });
}
