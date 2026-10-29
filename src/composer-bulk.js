export const bulkFields={dealer:'대리점',location:'작업위치',applicant:'신청자',trade:'구분'};
export function applySelectedRows(rows,selected,field,value){
 if(!Object.hasOwn(bulkFields,field))throw Error('일괄 입력 항목을 확인하세요.');
 if(field==='trade'&&!['','기계','소방'].includes(value))throw Error('기계 또는 소방을 선택하세요.');
 return rows.map((row,i)=>selected.has(i)?{...row,[field]:value}:row);
}
export function copySelectedRows(rows,selected){
 const copies=rows.filter((_,i)=>selected.has(i)).map(row=>structuredClone(row));
 if(!copies.length)throw Error('복사할 품목을 선택하세요.');
 if(rows.length+copies.length>500)throw Error('한 청구서는 최대 500개 품목까지 작성할 수 있습니다.');
 return [...rows,...copies];
}
