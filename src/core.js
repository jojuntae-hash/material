import {toolSummary} from './tool-ledger-core.js';
import {validateReceipts} from './receipts.js';
import {splitVendorNote} from './vendors.js';
export const uuid=()=>crypto.randomUUID();
export const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
export function inferRequestTrade(...sources){for(const source of sources){const value=String(source||'');const mechanical=value.includes('기계'),fire=value.includes('소방');if(mechanical&&fire)return '';if(mechanical)return '기계';if(fire)return '소방';}return '';}
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const label={request:'청구내역',vendor:'업체연락처',approval:'자재승인목록',alias:'업체 별칭'};
export const number=v=>v===null||v===''||v===undefined?'—':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:5});
export function validateRecord(kind,d){
 if(kind==='batch'&&d.type==='tool-ledger')toolSummary(d);
 if(kind==='request'){
  validateReceipts(d);
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
  if(d.contacts?.some(c=>c.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)))throw Error('추가 담당자 이메일 형식을 확인하세요.');
 }
 if(kind==='approval'){
  if(!clean(d.name)||!['기계','소방'].includes(d.trade))throw Error('공종과 승인 품목명을 확인하세요.');
  if(!Array.isArray(d.options))throw Error('승인 제조사 목록을 확인하세요.');
 }
 if(kind==='alias'&&(!clean(d.alias)||!d.vendorId))throw Error('별칭과 연결 업체를 선택하세요.');
}
export const searchKey=value=>String(value??'').replace(/\s+/gu,'').toLowerCase();
export const matchesSearch=(value,query)=>searchKey(value).includes(searchKey(query));
export const fingerprint=d=>[d.trade,d.date,clean(d.name),clean(d.spec),clean(d.unit),String(Number(d.quantity))].join('|');
export function resolveVendors(note,records){
 return splitVendorNote(note,records);
}
export function approvalStatus(d,records){
 const a=records.find(r=>r.id===d.approvalId&&!r.deleted&&r.kind==='approval');
 if(!a||!d.manufacturerId)return ['연결 미확인','muted'];
 const current=a.data.options.some(o=>o.vendorId===d.manufacturerId);
 if(d.approvalRevision&&d.approvalRevision!==(a.data.revision||1)){
  const past=a.data.previousRevisions?.find(p=>p.revision===d.approvalRevision);
  const then=past?.options.some(o=>o.vendorId===d.manufacturerId);
  return [`당시 v${d.approvalRevision} ${past?(then?'목록 일치':'검토 필요'):'이력 확인 필요'} · 현재 v${a.data.revision||1} ${current?'목록 일치':'검토 필요'}`,then&&current?'good':'warn'];
 }
 return current?['목록 일치','good']:['검토 필요','warn'];
}
export function filterRequests(records,{q='',trade='',start='',end='',vendor='',applicant='',location='',review=false},all=records){
 const names=new Map(all.filter(r=>r.kind==='vendor').map(r=>[r.id,r.data.name]));
 return records.filter(r=>r.kind==='request'&&!r.deleted).filter(({data:d})=>(!trade||d.trade===trade)&&(!start||d.date>=start)&&(!end||d.date<=end)&&(!vendor||d.manufacturerId===vendor||d.dealerId===vendor)&&(!applicant||matchesSearch(d.applicant,applicant))&&(!location||matchesSearch(d.location,location))&&(!review||!d.unit||d.quantity===null||!d.manufacturerId||!d.dealerId||d.note?.includes('[확인]'))&&(!q||matchesSearch([d.name,d.spec,d.note,d.location,d.applicant,d.rawManufacturer,d.rawDealer,names.get(d.manufacturerId),names.get(d.dealerId)].join(' '),q))).sort((a,b)=>b.data.date.localeCompare(a.data.date)||a.id.localeCompare(b.id));
}
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
