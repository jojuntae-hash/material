export const phoneValue=v=>{const s=String(v??'').trim();return /^[+\d\s().-]+$/.test(s)&&s.replace(/\D/g,'').length>=7?s:'';};
export function contactList(records){return records.filter(r=>r.kind==='vendor'&&!r.deleted).flatMap(r=>(r.data.contactRows||[]).filter(c=>!c.deleted).map(c=>({...c,ownerId:r.id,ownerVersion:r.version})));}
export function withContactRows(record,rows){
 const unique=values=>[...new Set(values.filter(Boolean))];const only=values=>{const u=unique(values);return u.length===1?u[0]:'';};
 const live=rows.filter(r=>!r.deleted);
 return {...record,data:{...record.data,contactRows:rows,phone:only(live.map(c=>c.phone)),fax:only(live.map(c=>c.fax)),email:only(live.flatMap(c=>c.emails||[])),person:only(live.map(c=>c.person)),contacts:[...new Map(live.flatMap(c=>c.contacts||[]).map(c=>[[c.name,c.phone,c.email].join('|'),c])).values()],items:unique(live.map(c=>c.item)),contactSchemaVersion:2}};
}
export function rebuildContactOps(records,contacts){
 const dealers=new Map(),roles=new Map(),trades=new Map();
 const add=(map,id,value)=>{if(!id)return;if(!map.has(id))map.set(id,new Set());map.get(id).add(value);};
 for(const a of records.filter(r=>r.kind==='approval'&&!r.deleted))for(const o of a.data.options||[]){add(roles,o.vendorId,'원자재');add(trades,o.vendorId,a.data.trade);}
 for(const c of contacts){add(roles,c.manufacturerId,'원자재');add(roles,c.dealerId,'대리점');add(trades,c.manufacturerId,c.trade);add(trades,c.dealerId,c.trade);if(!dealers.has(c.dealerId))dealers.set(c.dealerId,[]);dealers.get(c.dealerId).push(c);}
 const unique=values=>[...new Set(values.filter(Boolean))];const only=values=>{const u=unique(values);return u.length===1?u[0]:'';};
 return records.filter(r=>r.kind==='vendor'&&!r.deleted).map(r=>{
  const rows=dealers.get(r.id)||[];
  const extras=[...new Map(rows.flatMap(c=>c.contacts||[]).map(c=>[[c.name,c.phone,c.email].join('|'),c])).values()];
  return {...r,data:{...r.data,roles:[...(roles.get(r.id)||[])],trades:[...(trades.get(r.id)||[])],phone:only(rows.map(c=>c.phone)),fax:only(rows.map(c=>c.fax)),email:only(rows.flatMap(c=>c.emails||[])),person:only(rows.map(c=>c.person)),mobile:only(rows.flatMap(c=>c.contacts||[]).map(c=>c.phone).filter(n=>n.startsWith('010'))),note:unique(rows.map(c=>c.note)).join('\n'),items:unique(rows.map(c=>c.item)),contacts:extras,supplies:rows.map(c=>({manufacturerId:c.manufacturerId,item:c.item,trade:c.trade})),contactRows:rows,contactSchemaVersion:2}};
 });
}
