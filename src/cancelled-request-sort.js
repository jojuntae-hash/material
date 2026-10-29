export const cancelledSortFields=[['trade','구분'],['name','품명'],['spec','규격'],['quantity','수량'],['date','신청일'],['cancelledAt','취소일']];
const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
export function sortCancelledRequests(rows,{key='cancelledAt',direction='desc'}={}){
 if(!cancelledSortFields.some(([field])=>field===key))key='cancelledAt';
 const value=r=>key==='cancelledAt'?r.data.requestCancellation?.at:r.data[key];
 const blank=v=>v===null||v===undefined||String(v).trim()==='';
 const sign=direction==='asc'?1:-1;
 return [...rows].sort((a,b)=>{const av=value(a),bv=value(b),ab=blank(av),bb=blank(bv);if(ab!==bb)return ab?1:-1;
  const primary=ab?0:key==='quantity'?Number(av)-Number(bv):key==='cancelledAt'?Date.parse(av)-Date.parse(bv):collator.compare(String(av),String(bv));
  return primary*sign||String(a.id).localeCompare(String(b.id));
 });
}
