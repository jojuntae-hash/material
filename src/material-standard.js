import {materialRules,materialNameKey,validateMaterialRules} from './material-names.js';

// A read-only projection: stored requests and their source names are never rewritten.
export function materialResolver(rules){
 validateMaterialRules(rules);const aliases=new Map(),targets=new Map(),searchNames=new Map();
 for(const r of rules){const key=materialNameKey(r.target);if(!targets.has(key)||String(r.id).localeCompare(String(targets.get(key).id))<0)targets.set(key,r);}
 for(const r of rules){const key=materialNameKey(r.target);searchNames.set(key,[...(searchNames.get(key)||[]),r.target,...r.aliases]);for(const name of [r.target,...r.aliases])aliases.set(materialNameKey(name),targets.get(key));}
 return row=>{
  const originalName=String(row.originalName||row.name||''),rule=aliases.get(materialNameKey(originalName))||(!row.nameConversion?aliases.get(materialNameKey(row.name)):null);
  const names=rule?searchNames.get(materialNameKey(rule.target)):[];
  return {...row,name:rule?.target||originalName,originalName,standardMaterialId:rule?.id||'',materialSearchNames:[originalName,row.name,...names].filter(Boolean).join(' ')};
 };
}
export const resolverForRecords=records=>materialResolver(materialRules({records}));
export function standardRecords(records){const resolve=resolverForRecords(records);return records.map(r=>['request','approval'].includes(r.kind)?{...r,data:resolve(r.data)}:r);}
export function materialRuleImpact(records,before,after){
 validateMaterialRules(after);const old=materialResolver(before),next=materialResolver(after);
 return records.filter(r=>r.kind==='request'&&!r.deleted).filter(r=>{const a=old(r.data),b=next(r.data);return a.name!==b.name||a.standardMaterialId!==b.standardMaterialId;}).map(r=>({id:r.id,from:old(r.data).name,to:next(r.data).name,original:r.data.originalName||r.data.name}));
}
