import * as XLSX from 'xlsx';
import {clean,uuid,resolveVendors,fingerprint,validateRecord} from './core.js';
export const columnName=XLSX.utils.encode_col;
export function excelDate(value,date1904=false){
 if(value instanceof Date)return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
 if(typeof value==='number'){const d=XLSX.SSF.parse_date_code(value,{date1904});return d?`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`:'';}
 const m=String(value||'').match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';
}
export async function readWorkbook(file){if(file.size>15*1024*1024)throw Error('엑셀은 15MB 이하로 선택하세요.');if(!/\.xlsx$/i.test(file.name))throw Error('.xlsx 형식만 지원합니다.');const bytes=await file.arrayBuffer();const wb=XLSX.read(bytes,{type:'array',cellDates:false,sheetRows:10001});return wb;}
export function detectSheet(wb,name){
 const s=wb.Sheets[name],rows=XLSX.utils.sheet_to_json(s,{header:1,defval:'',blankrows:true});
 if(rows.length>10000)throw Error('시트는 10,000행 이하만 처리할 수 있습니다.');
 const header=rows.findIndex(r=>r.some(v=>clean(v)==='품명')&&r.some(v=>/^(규격|규 격)$/.test(clean(v))));
 if(header<0)return {supported:false,rows,name};
 const headers=rows[header].map(clean);const form=headers.includes('번호')&&header>0;
 const column=(names,fallback)=>{const n=headers.findIndex(v=>names.includes(v));return n<0?fallback:n;};
 const map=form?{name:2,spec:8,unit:11,quantity:16,note:19,location:20,applicant:21,trade:-1,date:-1,manufacturer:-1,dealer:-1}:{name:column(['품명'],2),spec:column(['규격'],3),unit:column(['단위'],4),quantity:column(['수량','청구수량'],5),note:column(['비고'],6),trade:column(['분류','소방·기계 구분'],0),date:column(['날짜','청구일'],1),manufacturer:column(['원자재'],-1),dealer:column(['대리점'],-1),location:column(['작업위치'],-1),applicant:column(['신청자'],-1)};
 const docNo=form?clean(rows[4]?.[7]):'';const trade=docNo.includes('소방')?'소방':docNo.includes('기계')?'기계':'';
 const date=form?excelDate(rows[5]?.[7],wb.Workbook?.WBProps?.date1904):'';
 const candidates=rows.map((r,i)=>({r,i})).filter(({r,i})=>i>header&&clean(r[map.name])&&(!form||typeof r[0]==='number'));
 const warnings=[];
 if(/삭제|재청구|취소/.test(name))warnings.push('삭제·재청구·취소 표기 시트입니다. 기본 제외를 권장합니다.');
 if(form&&candidates.some(({r})=>(r[16]===''||r[16]===undefined)&&typeof r[18]==='number'))warnings.push('청구물량 Q열이 비어 있고 S열에 수량이 있습니다. 원본 확인 후 수량 열을 직접 선택하세요.');
 const md=name.match(/(\d{1,2})월\s*(\d{1,2})일/);if(date&&md&&(Number(date.slice(5,7))!==+md[1]||Number(date.slice(8,10))!==+md[2]))warnings.push('본문 청구일과 시트명 날짜가 다릅니다.');
 return {supported:true,name,rows,map,header,form,docNo,trade,date,candidates,warnings};
}
export function extractRows(info,{map=info.map,trade=info.trade,date=info.date,records=[],filename=''}){
 const byName=(name,role)=>{const a=records.filter(r=>r.kind==='vendor'&&!r.deleted&&clean(r.data.name)===clean(name)&&r.data.roles?.includes(role));return a.length===1?a[0].id:'';};
 const known=new Set(records.filter(r=>r.kind==='request'&&!r.deleted).map(r=>fingerprint(r.data)));
 return info.candidates.map(({r,i})=>{
  const value=k=>map[k]>=0?r[map[k]]:'';const note=clean(value('note'));const resolved=resolveVendors(note,records);
  const d={trade:clean(value('trade'))||trade,date:excelDate(value('date'))||date,name:clean(value('name')),spec:clean(value('spec')),unit:clean(value('unit')),quantity:value('quantity'),manufacturerId:byName(value('manufacturer'),'원자재')||resolved.manufacturerId,dealerId:byName(value('dealer'),'대리점')||resolved.dealerId,location:clean(value('location')),applicant:clean(value('applicant')),note,approvalId:'',documentNumber:info.docNo,source:{file:filename,sheet:info.name,row:i+1},original:{cells:r,quantityColumn:columnName(map.quantity)}};
  const issues=[];try{validateRecord('request',d);}catch(e){issues.push(e.message);}if(!d.unit)issues.push('단위 미확인');if(!d.manufacturerId||!d.dealerId)issues.push('업체 연결 미확인');
  const duplicate=known.has(fingerprint(d));return {id:uuid(),data:d,issues,duplicate,selected:!issues.length&&!duplicate};
 });
}
export function exportRequests(rows,vendorName){
 const header=['분류','날짜','품명','규격','단위','수량','원자재','대리점','작업위치','신청자','비고','원본파일','원본시트','원본행'];
 const body=rows.map(({data:d})=>[d.trade,d.date,d.name,d.spec,d.unit,d.quantity===null?null:Number(d.quantity),vendorName(d.manufacturerId),vendorName(d.dealerId),d.location,d.applicant,d.note,d.source?.file||'',d.source?.sheet||'',d.source?.row||'']);
 const ws=XLSX.utils.aoa_to_sheet([header,...body]);ws['!cols']=header.map((_,i)=>({wch:[2,3,10,11,12].includes(i)?30:16}));ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:body.length,c:header.length-1}})};const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'청구내역');XLSX.writeFile(wb,`자재청구내역_${new Date().toISOString().slice(0,10)}.xlsx`);
}
