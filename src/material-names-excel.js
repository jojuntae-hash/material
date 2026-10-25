import * as XLSX from 'xlsx';
import {materialNameKey,validateMaterialRules,uniqueMaterialAliases} from './material-names.js';
import {sortMaterialRules} from './material-rule-order.js';
const text=v=>String(v??'').trim();
const heading=v=>text(v).replace(/\s/g,'');
export function buildMaterialRulesWorkbook(rules){
 const count=Math.max(2,...rules.map(r=>r.aliases.length));
 const headers=[...Array.from({length:count},(_,i)=>`변환 전 품명 ${i+1}`),'변환 후 품명','분류'];
 const rows=sortMaterialRules(rules,'target','asc').map(r=>[...Array.from({length:count},(_,i)=>r.aliases[i]||''),r.target,r.category||'']);
 const sheet=XLSX.utils.aoa_to_sheet([headers,...rows]);sheet['!cols']=headers.map((_,i)=>({wch:i===headers.length-1?20:35}));sheet['!autofilter']={ref:sheet['!ref']};
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,sheet,'품명 변환 목록');return wb;
}
export function parseMaterialRulesSheet(wb,name){
 const sheet=wb.Sheets[name];if(!sheet)throw Error('시트를 선택하세요.');
 const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',blankrows:true});if(rows.length>10000)throw Error('시트는 10,000행 이하만 지원합니다.');
 const aliasHeading=h=>/^변환전(?:품명|자재이름)\d*$/.test(h);
 const header=rows.findIndex(r=>r.some(v=>aliasHeading(heading(v)))&&r.some(v=>['변환후','변환후품명','변환후자재이름'].includes(heading(v))));
 if(header<0)throw Error('변환 전 품명 1·2 / 변환 후 품명 / 분류 열 제목을 확인하세요.');
 const heads=rows[header].map(heading),aliases=heads.map((h,i)=>aliasHeading(h)?i:-1).filter(i=>i>=0),targets=heads.map((h,i)=>['변환후','변환후품명','변환후자재이름'].includes(h)?i:-1).filter(i=>i>=0);
 if(targets.length!==1)throw Error('변환 후 품명 열은 하나만 사용하세요.');
 const category=heads.findIndex(h=>['분류','구분'].includes(h)),result=[];
 for(let i=header+1;i<rows.length;i++){
  const row=rows[i],before=aliases.map(c=>text(row[c])).filter(Boolean),target=text(row[targets[0]]);
  if(!before.length&&!target)continue;
  if(!before.length||!target)throw Error(`${i+1}행의 변환 전·후 품명을 모두 입력하세요.`);
  result.push({aliases:uniqueMaterialAliases(before),target,category:category<0?'':text(row[category])});
 }
 validateMaterialRules(result);return result;
}
export function planMaterialRulesImport(existing,incoming){
 const rules=structuredClone(existing);let added=0,updated=0,skipped=0;
 for(const source of incoming){
  const row={...source,aliases:uniqueMaterialAliases(source.aliases)};
  const keys=new Set(row.aliases.map(materialNameKey));
  const overlaps=rules.filter(r=>r.aliases.some(a=>keys.has(materialNameKey(a))));
  if(overlaps.some(r=>r.target!==row.target))throw Error(`‘${row.aliases.join(' / ')}’의 변환 후 품명이 기존 규칙과 다릅니다. 기존 규칙은 유지됩니다. 목록에서 수정하거나 파일을 확인하세요.`);
  const matching=overlaps[0];
  if(matching){const known=new Set(overlaps.flatMap(r=>r.aliases.map(materialNameKey))),fresh=row.aliases.filter(a=>!known.has(materialNameKey(a)));if(fresh.length){matching.aliases.push(...fresh);updated++;}else skipped++;}
  else{rules.push({...row,id:crypto.randomUUID()});added++;}
 }
 validateMaterialRules(rules);return {rules,added,updated,skipped};
}
