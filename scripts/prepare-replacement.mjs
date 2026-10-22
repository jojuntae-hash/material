import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as XLSX from 'xlsx';
import {resolveColumns,reviewedAliases} from '../src/vendors.js';
import {validateRecord} from '../src/core.js';
import {excelDate} from '../src/excel.js';
const dir=new URL('../private-data/',import.meta.url);
const input=process.argv[2]||'C:/Users/Runner/Desktop/자재청구내역.xlsx';
const seed=JSON.parse(await fs.readFile(new URL('seed.json',dir),'utf8'));
const bytes=await fs.readFile(input),hash=createHash('sha256').update(bytes).digest('hex');
const stable=key=>{const s=createHash('sha256').update('material-replacement/'+key).digest('hex');return `${s.slice(0,8)}-${s.slice(8,12)}-4${s.slice(13,16)}-a${s.slice(17,20)}-${s.slice(20,32)}`;};
const id=stable(hash),start='2026-10-12',end='2026-10-20';
const wb=XLSX.read(bytes,{type:'buffer',cellDates:false});const sheet='자재청구내역서';const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:null});
const records=[];
for(let i=1;i<rows.length;i++){
 const r=rows[i];if(!r[2])continue;
 const date=excelDate(r[1],wb.Workbook?.WBProps?.date1904);if(!date)throw Error(`날짜 형식 확인: ${i+1}행`);
 if(date<start||date>end)throw Error(`요청 기간 밖의 날짜: ${date}`);
 const company=resolveColumns(r[6],r[7],r[10],seed.records);
 const data={trade:r[0],date,name:String(r[2]).trim(),spec:String(r[3]??''),unit:String(r[4]??''),quantity:r[5],...company,location:String(r[8]??''),applicant:String(r[9]??''),note:String(r[10]??''),approvalId:'',source:{file:'자재청구내역.xlsx',sheet,row:i+1},original:{trade:r[0],date,name:r[2],spec:r[3],unit:r[4],quantity:r[5],manufacturer:r[6],dealer:r[7],location:r[8],applicant:r[9],note:r[10]},replacementId:id};
 if(r[5]===null)data.quantityUnconfirmed=true;
 if(typeof r[5]==='number'&&r[5]<0)data.quantityOriginalAdjustment=true;
 validateRecord('request',data);records.push({id:stable(hash+'/'+sheet+'/'+(i+1)),kind:'request',data,version:1});
}
if(records.length!==331)throw Error('교체 건수가 예상과 다릅니다.');
const aliases=reviewedAliases.flatMap(([alias,role,target])=>{
 const v=seed.records.find(r=>r.kind==='vendor'&&r.data.name===target&&r.data.roles.includes(role));
 if(!v)return [];return [{id:stable('alias/'+role+'/'+alias),kind:'alias',data:{alias,role,vendorId:v.id,note:'제공된 업체 목록과 대조한 약칭'},version:1}];
});
const update={id,start,end,filename:'자재청구내역.xlsx',hash,fileIndex:5,records,aliases};
await fs.writeFile(new URL('replacement.json',dir),JSON.stringify(update));
await fs.writeFile(new URL('original-5.xlsx',dir),bytes);
if(!seed.records.some(r=>r.id===id)){
 await fs.writeFile(new URL('seed-before-replacement.json',dir),JSON.stringify(seed));
 let removed=0;
 for(const r of seed.records)if(r.kind==='request'&&!r.deleted&&r.data.date>=start&&r.data.date<=end){r.deleted=true;r.version++;removed++;}
 seed.records.push(...records,{id,kind:'batch',data:{filename:update.filename,sheet,applied:records.length,pending:[],replacement:true,replaced:removed,start,end,hash,at:new Date().toISOString()},version:1});
 for(const a of aliases)if(!seed.records.some(r=>r.kind==='alias'&&!r.deleted&&r.data.alias===a.data.alias&&r.data.role===a.data.role))seed.records.push(a);
 if(!seed.files.includes(update.filename))seed.files.push(update.filename);
 seed.counts={request:seed.records.filter(r=>r.kind==='request'&&!r.deleted).length};
 await fs.writeFile(new URL('seed.json',dir),JSON.stringify(seed));
}else{
 // Re-running only refreshes generated replacement rows; existing user state is never touched here.
 const incoming=new Map(records.map(r=>[r.id,r]));
 seed.records=seed.records.map(r=>incoming.get(r.id)||r);
 for(const a of aliases)if(!seed.records.some(r=>r.kind==='alias'&&!r.deleted&&r.data.alias===a.data.alias&&r.data.role===a.data.role))seed.records.push(a);
 await fs.writeFile(new URL('seed.json',dir),JSON.stringify(seed));
}
const counts={};for(const r of records)counts[r.data.date]=(counts[r.data.date]||0)+1;
const report={start,end,replacementCount:records.length,activeTotal:seed.records.filter(r=>r.kind==='request'&&!r.deleted).length,counts,mappedManufacturers:records.filter(r=>r.data.manufacturerId).length,mappedDealers:records.filter(r=>r.data.dealerId).length,missingQuantity:records.filter(r=>r.data.quantity===null).length,unresolved:records.filter(r=>!r.data.manufacturerId||!r.data.dealerId).map(r=>({row:r.data.source.row,manufacturer:r.data.rawManufacturer,dealer:r.data.rawDealer,issues:r.data.vendorIssues}))};
await fs.writeFile(new URL('replacement-report.json',dir),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,unresolved:report.unresolved.length},null,2));
