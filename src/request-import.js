import * as XLSX from 'xlsx';
const text=v=>String(v??'').trim();
const heading=v=>text(v).replace(/\s+/g,'');
const aliases={name:['품명'],spec:['규격'],unit:['단위'],quantity:['청구물량','청구수량','수량'],dealer:['대리점'],location:['작업위치'],applicant:['신청자'],trade:['구분','공종','분류','소방·기계구분']};
export function parseDraftSheet(workbook,sheetName){
 const sheet=workbook.Sheets[sheetName];if(!sheet)throw Error('시트를 찾을 수 없습니다.');
 const data=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',blankrows:true});
 if(data.length>10000)throw Error('시트는 10,000행 이하만 지원합니다.');
 const header=data.findIndex(row=>row.some(v=>heading(v)==='품명'));
 if(header<0)throw Error('‘품명’ 열 제목이 있는 시트를 선택하세요.');
 const headings=data[header].map(heading);
 const form=headings[2]==='품명'&&headings[8]==='규격'&&heading(data[header+1]?.[16])==='청구물량';
 const map={};
 for(const [field,names] of Object.entries(aliases)){
  const columns=headings.map((h,i)=>names.includes(h)?i:-1).filter(i=>i>=0);
  if(columns.length>1)throw Error(`‘${names[0]}’에 해당하는 열이 여러 개입니다. 열 제목을 확인하세요.`);
  map[field]=columns[0]??-1;
 }
 if(form){Object.assign(map,{name:2,spec:8,unit:11,quantity:16,location:20,applicant:21,trade:22});map.dealer=19;}
 const rows=[];let skipped=0;
 for(let i=header+(form?4:1);i<data.length;i++){
  const source=data[i];if(!source.some(v=>text(v)))continue;
  const get=k=>map[k]<0?'':source[map[k]]??'';
  if(!text(get('name'))){skipped++;continue;}if(heading(get('name'))==='품명')continue;
  const row=Object.fromEntries(Object.keys(aliases).map(k=>[k,text(get(k))]));
  const qty=get('quantity');row.quantity=typeof qty==='number'?qty:text(qty).replace(/,/g,'');
  rows.push(row);
 }
 return {rows,skipped,form};
}
