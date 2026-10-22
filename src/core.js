export const uuid=()=>crypto.randomUUID();
export const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const label={request:'청구내역',vendor:'업체연락처',approval:'자재승인목록',alias:'업체 별칭'};
export const number=v=>v===null||v===''||v===undefined?'—':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:5});
export function validateRecord(kind,d){
 if(kind==='request'){
  if(!['기계','소방'].includes(d.trade))throw Error('기계 또는 소방을 선택하세요.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')||!Number.isFinite(Date.parse(d.date+'T00:00:00Z'))||new Date(d.date+'T00:00:00Z').toISOString().slice(0,10)!==d.date)throw Error('올바른 청구일을 입력하세요.');
  if(!clean(d.name))throw Error('품명을 입력하세요.');
  const legacyMissing=d.quantity===null&&d.quantityUnconfirmed===true&&d.original?.quantity===null&&!!d.source?.file;
  if(!legacyMissing&&(d.quantity===''||d.quantity===null||d.quantity===undefined||!Number.isFinite(Number(d.quantity))))throw Error('수량은 숫자로 입력하세요.');
  const originalAdjustment=d.quantityOriginalAdjustment===true&&d.quantity===d.original?.quantity&&!!d.source?.file;
  if(Number(d.quantity)<0&&!originalAdjustment)throw Error('새 음수 수량은 저장할 수 없습니다. 원본 정정 내역인지 확인하세요.');
 }
 if(kind==='vendor'){
  if(!clean(d.name))throw Error('업체명을 입력하세요.');
  if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))throw Error('이메일 형식을 확인하세요.');
 }
 if(kind==='approval'){
  if(!clean(d.name)||!['기계','소방'].includes(d.trade))throw Error('공종과 승인 품목명을 확인하세요.');
  if(!Array.isArray(d.options))throw Error('승인 제조사 목록을 확인하세요.');
 }
 if(kind==='alias'&&(!clean(d.alias)||!d.vendorId))throw Error('별칭과 연결 업체를 선택하세요.');
}
export const fingerprint=d=>[d.trade,d.date,clean(d.name),clean(d.spec),clean(d.unit),String(Number(d.quantity))].join('|');
export function resolveVendors(note,records){
 const vendors=records.filter(x=>x.kind==='vendor'&&!x.deleted),aliases=records.filter(x=>x.kind==='alias'&&!x.deleted);
 const lookup=(s,role)=>{
  const exact=vendors.filter(x=>clean(x.data.name)===clean(s)&&x.data.roles?.includes(role));
  const mapped=aliases.filter(x=>clean(x.data.alias)===clean(s)&&x.data.role===role).map(a=>vendors.find(v=>v.id===a.data.vendorId)).filter(Boolean);
  const hits=[...new Map([...exact,...mapped].map(x=>[x.id,x])).values()];return hits.length===1?hits[0].id:'';
 };
 const parts=clean(note).split(' / [')[0].split('/');
 if(parts.length!==2)return {manufacturerId:'',dealerId:'',matched:false};
 const manufacturerId=lookup(parts[0],'원자재'),dealerId=lookup(parts[1],'대리점');
 return {manufacturerId,dealerId,matched:!!(manufacturerId&&dealerId)};
}
export function approvalStatus(d,records){
 const a=records.find(r=>r.id===d.approvalId&&!r.deleted&&r.kind==='approval');
 if(!a||!d.manufacturerId)return ['연결 미확인','muted'];
 return a.data.options.some(o=>o.vendorId===d.manufacturerId)?['목록 일치','good']:['검토 필요','warn'];
}
export function filterRequests(records,{q='',trade='',start='',end='',vendor='',applicant='',location='',review=false},all=records){
 const names=new Map(all.filter(r=>r.kind==='vendor').map(r=>[r.id,r.data.name]));
 return records.filter(r=>r.kind==='request'&&!r.deleted).filter(({data:d})=>(!trade||d.trade===trade)&&(!start||d.date>=start)&&(!end||d.date<=end)&&(!vendor||d.manufacturerId===vendor||d.dealerId===vendor)&&(!applicant||clean(d.applicant).includes(applicant))&&(!location||clean(d.location).includes(location))&&(!review||!d.unit||!d.manufacturerId||!d.dealerId||d.note?.includes('[확인]'))&&(!q||[d.name,d.spec,d.note,d.location,d.applicant,names.get(d.manufacturerId),names.get(d.dealerId)].join(' ').toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>b.data.date.localeCompare(a.data.date)||a.id.localeCompare(b.id));
}
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
