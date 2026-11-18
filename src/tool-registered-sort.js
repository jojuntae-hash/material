import {toolSummary} from './tool-ledger-core.js';
export const registeredSortFields={name:'공구명',spec:'규격',unit:'단위',received:'현장 입고',stock:'현재 보유',lastReceived:'최근 입고일',holders:'현재 수령자 / 수량'};
export function sortRegisteredTools(rows,{key='',direction='asc'}={}){
 if(!registeredSortFields[key])return [...rows];
 const summaries=new Map(rows.map(r=>[r.id,toolSummary(r.data)])),collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
 const value=r=>['name','spec','unit'].includes(key)?r.data[key]||'':key==='holders'?summaries.get(r.id).holders.map(h=>h.person+' '+h.quantity).join(' / '):summaries.get(r.id)[key];
 return [...rows].sort((a,b)=>{const x=value(a),y=value(b),empty=v=>v==null||v==='';if(empty(x)||empty(y))return empty(x)?empty(y)?0:1:-1;return (typeof x==='number'&&typeof y==='number'?x-y:collator.compare(String(x),String(y)))*(direction==='desc'?-1:1);});
}
