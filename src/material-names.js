import defaults from './data/material-name-rules.json' with {type:'json'};
export const materialRulesId='067416e7-b271-4bf4-afc9-328241772ea1';
export const materialNameKey=value=>String(value??'').replace(/[°˚º]/g,'').normalize('NFKC').replace(/[\s\u200B-\u200D\u2060\uFEFF]/g,'').toLowerCase();
export function uniqueMaterialAliases(values){const seen=new Set();return values.map(v=>String(v??'').trim()).filter(v=>{const key=materialNameKey(v);if(!key||seen.has(key))return false;seen.add(key);return true;});}
export function materialRulesRecord(store){return store.records.find(r=>r.id===materialRulesId&&r.kind==='batch'&&!r.deleted&&r.data.type==='material-name-rules');}
export function materialRules(store){return materialRulesRecord(store)?.data.rules??defaults;}
export function materialCategory(name,rules){
 const key=materialNameKey(name);if(!key)return '';
 const targets=rules.filter(r=>materialNameKey(r.target)===key);
 const matches=targets.length?targets:rules.filter(r=>r.aliases.some(a=>materialNameKey(a)===key));
 return String(matches.find(r=>String(r.category||'').trim())?.category||'').trim();
}
export function validateMaterialRules(rules){
 const seen=new Map();
 for(const r of rules){
  if(!String(r.target||'').trim()||!Array.isArray(r.aliases)||!r.aliases.length||r.aliases.some(a=>!materialNameKey(a)))throw Error('변환 전 품명과 변환 후 품명을 입력하세요.');
  for(const alias of r.aliases){const key=materialNameKey(alias),target=String(r.target).trim();if(seen.has(key)&&seen.get(key)!==target)throw Error(`‘${alias}’에 서로 다른 변환 후 품명이 등록되어 있습니다.`);seen.set(key,target);}
 }
 for(const r of rules){const key=materialNameKey(r.target);if(seen.has(key)&&materialNameKey(seen.get(key))!==key)throw Error(`‘${r.target}’이 다른 규칙에서 다시 변환됩니다. 변환 후 품명을 최종 표준명으로 통일하세요.`);}
}
export function convertMaterialRow(row,rules){
 const key=materialNameKey(row.name);if(!key)return {...row};
 const matches=rules.filter(r=>r.aliases.some(a=>materialNameKey(a)===key));
 const targets=[...new Set(matches.map(r=>r.target))];
 if(targets.length>1)throw Error(`‘${row.name}’의 품명 변환 규칙이 충돌합니다. 작성리스트 품목관리에서 확인하세요.`);
 if(!targets.length||row.name===targets[0])return {...row};
 return {...row,name:targets[0],originalName:row.originalName||row.name,nameConversion:{from:row.name,to:targets[0],ruleId:matches[0].id}};
}
