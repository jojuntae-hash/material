import {selectedMaterialHistory} from './aggregation.js';
import {aggregateMaterials} from './aggregation.js';
import {materialRulesId} from './material-names.js';
export const cartStorageKey=({mode,projectId,userId=''})=>`mm-material-cart-v1:${mode}:${projectId}:${userId}`;
export function readMaterialCart(storage,key){try{const value=JSON.parse(storage.getItem(key)||'[]');return new Set(Array.isArray(value)?value.filter(v=>typeof v==='string'):[]);}catch{return new Set();}}
export function materialCartData(records,keys){const result=selectedMaterialHistory(records,keys,{});return {...result,unavailable:keys.size-result.groups.length};}
export function reconcileMaterialCart(records,keys,beforeRules){
 const before=records.filter(r=>r.id!==materialRulesId).concat({id:materialRulesId,kind:'batch',data:{type:'material-name-rules',rules:beforeRules}});
 const oldGroups=aggregateMaterials(before),nextGroups=aggregateMaterials(records),byRow=new Map(nextGroups.flatMap(g=>g.rows.map(r=>[r.id,g.key]))),result=new Set(keys);
 for(const g of oldGroups){if(!keys.has(g.key))continue;result.delete(g.key);for(const r of g.rows){const key=byRow.get(r.id);if(key)result.add(key);}}
 return result;
}
