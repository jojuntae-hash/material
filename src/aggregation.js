import {matchesSearch} from './core.js';
const normalize=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
const scale=100000;
export const materialKey=d=>JSON.stringify([normalize(d.name),normalize(d.spec),normalize(d.unit)]);
const matchesMaterial=(d,q)=>{const value=[d.name,d.spec,d.unit].join(' ');return matchesSearch(value,q)||String(q).trim().split(/\s+/).every(term=>matchesSearch(value,term));};
const valid=n=>n!==null&&n!==undefined&&String(n).trim()!==''&&Number.isFinite(Number(n));
export function aggregateMaterials(records,{q='',trade='',start='',end='',sort='name'}={}){
 const groups=new Map();
 for(const r of records){if(r.kind!=='request'||r.deleted||r.data.requestArchived||r.data.requestCancellation?.active)continue;const d=r.data;
  if(trade&&d.trade!==trade||start&&d.date<start||end&&d.date>end||q&&!matchesMaterial(d,q))continue;
  const key=materialKey(d);if(!groups.has(key))groups.set(key,{key,name:d.name,spec:d.spec||'',unit:d.unit||'',scaled:0,positiveScaled:0,adjustmentScaled:0,mechanicalScaled:0,fireScaled:0,count:0,missing:0,firstDate:d.date,lastDate:d.date,rows:[]});
  const g=groups.get(key);g.count++;g.rows.push(r);if(d.date<g.firstDate)g.firstDate=d.date;if(d.date>g.lastDate)g.lastDate=d.date;
  if(!valid(d.quantity)){g.missing++;continue;}const n=Math.round(Number(d.quantity)*scale);g.scaled+=n;g.positiveScaled+=Math.max(n,0);g.adjustmentScaled+=Math.min(n,0);if(d.trade==='기계')g.mechanicalScaled+=n;if(d.trade==='소방')g.fireScaled+=n;
 }
 const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
 return [...groups.values()].map(g=>({...g,total:g.scaled/scale,positive:g.positiveScaled/scale,adjustment:g.adjustmentScaled/scale,mechanical:g.mechanicalScaled/scale,fire:g.fireScaled/scale,rows:g.rows.sort((a,b)=>b.data.date.localeCompare(a.data.date)||a.id.localeCompare(b.id))})).sort((a,b)=>(sort==='latest'?b.lastDate.localeCompare(a.lastDate):sort==='count'?b.count-a.count:0)||collator.compare(a.name,b.name)||collator.compare(a.spec,b.spec)||collator.compare(a.unit,b.unit));
}
export function materialTotal(records,data){return aggregateMaterials(records).find(g=>g.key===materialKey(data));}

export function selectedMaterialHistory(records,keys,filters={}){
 const groups=aggregateMaterials(records,filters).filter(g=>keys.has(g.key));
 const rows=groups.flatMap(g=>g.rows).sort((a,b)=>b.data.date.localeCompare(a.data.date)||a.id.localeCompare(b.id));
 const totals=aggregateMaterials(rows.map(r=>({...r,data:{...r.data,name:'선택 자재'}})));
 return {groups,rows,totals};
}
