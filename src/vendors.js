// Reviewed spellings point only to companies that actually exist in the catalogue.
export const reviewedAliases=[
 ['세종','대리점','세종넷피아'],['진영','대리점','진영씨앤아이'],['민석','대리점','민석이노베이션'],['삼안','대리점','삼안프라자'],['대화','대리점','대화기업'],['통일 S&S','대리점','통일에스엔에스'],
 ['세아','원자재','세아제강'],['한국슈어','원자재','한국슈어조인트'],['협신','원자재','협신플랜지'],['프롬파스트','원자재','프럼파스트'],['환경덕트','원자재','환경닥트'],['환경덕트','대리점','환경닥트'],['DRNS','원자재','디알앤에스'],['DRNS','대리점','디알앤에스'],['정일테크(청암피앤피)','대리점','청암피앤피']
];
const tidy=v=>String(v??'').trim().replace(/\s+/g,' ');
const normal=v=>tidy(v).toLowerCase().replace(/주식회사|\(주\)|㈜/g,'').replace(/[\s._&()-]/g,'');
export function resolveVendorToken(token,role,records){
 const value=tidy(token),vendors=records.filter(r=>r.kind==='vendor'&&!r.deleted&&r.data.roles?.includes(role));
 const decide=(hits,method)=>{const unique=[...new Map(hits.map(r=>[r.id,r])).values()];return {id:unique.length===1?unique[0].id:'',name:unique.length===1?unique[0].data.name:'',method,status:unique.length===1?'matched':unique.length?'ambiguous':'unmatched',candidates:unique.map(r=>({id:r.id,name:r.data.name}))};};
 if(!value)return decide([],'empty');
 const custom=records.filter(r=>r.kind==='alias'&&!r.deleted&&r.data.role===role&&normal(r.data.alias)===normal(value));
 if(custom.length)return decide(custom.map(a=>vendors.find(v=>v.id===a.data.vendorId)).filter(Boolean),'alias');
 const exact=vendors.filter(v=>tidy(v.data.name)===value);if(exact.length)return decide(exact,'exact');
 const reviewed=reviewedAliases.filter(([a,r])=>r===role&&normal(a)===normal(value)).flatMap(([,r,target])=>vendors.filter(v=>v.data.name===target));
 if(reviewed.length)return decide(reviewed,'reviewed-alias');
 const normalized=vendors.filter(v=>normal(v.data.name)===normal(value));if(normalized.length)return decide(normalized,'normalized');
 // A multi-company expression, fraction or prose is never treated as a short name.
 if(normal(value).length<2||/[,/\n]|\[|\]/.test(value))return decide([],'unmatched');
 const catalogue=records.filter(r=>r.kind==='vendor'&&!r.deleted&&normal(r.data.name).startsWith(normal(value)));
 const distinctNames=new Set(catalogue.map(r=>normal(r.data.name)));
 const prefix=vendors.filter(v=>normal(v.data.name).startsWith(normal(value)));
 if(distinctNames.size>1)return {...decide(prefix,'ambiguous-prefix'),id:'',name:'',status:'ambiguous'};
 return decide(prefix,'unique-prefix');
}
export function splitVendorNote(note,records){
 const main=tidy(note).split(/\s*\/\s*\[(?:추가메모|확인)/)[0];const parts=main.split('/');
 if(parts.length!==2)return {manufacturerId:'',dealerId:'',matched:false,rawManufacturer:'',rawDealer:'',issues:[]};
 const maker=resolveVendorToken(parts[0],'원자재',records),dealer=resolveVendorToken(parts[1],'대리점',records);
 return {manufacturerId:maker.id,dealerId:dealer.id,matched:!!(maker.id&&dealer.id),rawManufacturer:tidy(parts[0]),rawDealer:tidy(parts[1]),resolution:{manufacturer:maker,dealer},issues:[...(!maker.id?[maker.status==='ambiguous'?'원자재 약칭 복수 후보':'원자재 연결 미확인']:[]),...(!dealer.id?[dealer.status==='ambiguous'?'대리점 약칭 복수 후보':'대리점 연결 미확인']:[])]};
}
export function resolveColumns(manufacturer,dealer,note,records){
 const rawManufacturer=tidy(manufacturer),rawDealer=tidy(dealer);const combined=splitVendorNote(rawManufacturer,records),fromNote=splitVendorNote(note,records);
 let maker=resolveVendorToken(rawManufacturer,'원자재',records),seller=resolveVendorToken(rawDealer,'대리점',records);
 // A few source rows combine the two companies in the manufacturer column.
 const dash=rawManufacturer.match(/^(.+?)-(.+)$/);const dashPair=dash?splitVendorNote(dash[1]+'/'+dash[2],records):null;
 if(!maker.id&&combined.manufacturerId)maker=combined.resolution.manufacturer;
 if(!maker.id&&dashPair?.matched)maker=dashPair.resolution.manufacturer;
 const manufacturerId=maker.id||(!rawManufacturer?fromNote.manufacturerId:''),dealerId=seller.id||(!rawDealer?(combined.dealerId||dashPair?.dealerId||fromNote.dealerId):'');
 return {manufacturerId:manufacturerId||'',dealerId:dealerId||'',rawManufacturer:rawManufacturer||fromNote.rawManufacturer,rawDealer:rawDealer||fromNote.rawDealer,vendorResolution:{manufacturer:maker,dealer:seller},vendorIssues:[...(!manufacturerId&&rawManufacturer?[maker.status==='ambiguous'?'원자재 약칭 복수 후보':'원자재 연결 미확인']:[]),...(!dealerId&&rawDealer?[seller.status==='ambiguous'?'대리점 약칭 복수 후보':'대리점 연결 미확인']:[])]};
}
