import {selectedMaterialHistory} from './aggregation.js';
export const cartStorageKey=({mode,projectId,userId=''})=>`mm-material-cart-v1:${mode}:${projectId}:${userId}`;
export function readMaterialCart(storage,key){try{const value=JSON.parse(storage.getItem(key)||'[]');return new Set(Array.isArray(value)?value.filter(v=>typeof v==='string'):[]);}catch{return new Set();}}
export function materialCartData(records,keys){const result=selectedMaterialHistory(records,keys,{});return {...result,unavailable:keys.size-result.groups.length};}
