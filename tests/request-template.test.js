import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {unzipSync,strFromU8} from 'fflate';
import {fillRequestTemplate,validateDraft,draftKey,defaultDelivery,mergeDraftRows} from '../src/request-template.js';
import {detectSheet,extractRows} from '../src/excel.js';
import {parseDraftSheet} from '../src/request-import.js';
const template=new Uint8Array(fs.readFileSync(new URL('../public/templates/request.xlsx',import.meta.url)));
const draft=()=>({date:'2026-10-24',number:'기계-001',project:'테스트 현장',manager:'소장',delivery:'2026-10-27',rows:[{name:'배관 & 시험',spec:'25A',unit:'M',quantity:'1.25',dealer:'테스트 대리점',location:'스튜디오1',applicant:'시험자',trade:'기계'}]});
test('원본 양식의 병합·서식·인쇄설정을 보존하며 정확한 셀에 입력',()=>{
 const bytes=fillRequestTemplate(template,draft()),wb=XLSX.read(bytes,{type:'array'}),s=wb.Sheets[wb.SheetNames[0]];
 for(const [ref,value] of Object.entries({H5:'기계-001',P5:'테스트 현장',P6:'소장',S6:'2026-10-27',C12:'배관 & 시험',I12:'25A',L12:'M',Q12:1.25,T12:'테스트 대리점',U12:'스튜디오1',V12:'시험자',W9:'메모',W12:''}))assert.equal(s[ref].v,value);
 assert.equal(XLSX.SSF.parse_date_code(s.H6.v).d,24);assert.equal(s.C13,undefined);
 const before=unzipSync(template),after=unzipSync(bytes);assert.deepEqual(after['xl/styles.xml'],before['xl/styles.xml']);
 assert.equal(Object.keys(before).some(k=>k.startsWith('xl/media/')||k.startsWith('xl/drawings/')),false);
 const xml=strFromU8(after['xl/worksheets/sheet2.xml']),original=strFromU8(before['xl/worksheets/sheet2.xml']);
 for(const tag of ['cols','pageSetup','pageMargins'])assert.equal(xml.match(new RegExp(`<${tag}\\b[\\s\\S]*?(?:</${tag}>|/>)`))[0],original.match(new RegExp(`<${tag}\\b[\\s\\S]*?(?:</${tag}>|/>)`))[0]);
 assert.match(strFromU8(after['xl/workbook.xml']),/\$A\$1:\$T\$42/);
 const info=detectSheet(wb,wb.SheetNames[0]),rows=extractRows(info,{});
 assert.equal(info.warnings.length,0);assert.equal(rows.length,1);
 for(const [field,value] of Object.entries({trade:'기계',location:'스튜디오1',applicant:'시험자',quantity:1.25,rawDealer:'테스트 대리점'}))assert.equal(rows[0].data[field],value);
});
test('수량·필수 입력 검증, 긴 목록 끝행 및 사용자별 임시저장 분리',()=>{
 const d=draft();for(const quantity of ['',0,-1,'abc',Infinity]){d.rows[0].quantity=quantity;assert.throws(()=>validateDraft(d),/수량/);}d.rows[0].quantity=2;
 d.date='2026-02-30';assert.throws(()=>validateDraft(d),/청구일/);d.date='2026-10-24';
 d.rows[0].dealer='';d.rows[0].location='';d.rows[0].applicant='';assert.doesNotThrow(()=>validateDraft(d));
 d.rows=Array.from({length:500},()=>({...d.rows[0]}));const wb=XLSX.read(fillRequestTemplate(template,d));assert.equal(wb.Sheets[wb.SheetNames[0]].Q511.v,2);assert.equal(wb.Sheets[wb.SheetNames[0]].A511.v,500);assert.ok(wb.Sheets[wb.SheetNames[0]]['!merges'].some(m=>m.s.r===510&&m.s.c===2&&m.e.c===7));assert.equal(parseDraftSheet(wb,wb.SheetNames[0]).rows.length,500);d.rows.push({...d.rows[0]});assert.throws(()=>validateDraft(d),/500/);
 assert.notEqual(draftKey({mode:'cloud',projectId:'a',session:{user:{id:'u'}}}),draftKey({mode:'cloud',projectId:'a',session:{user:{id:'v'}}}));
});
test('입고요청일은 2일 뒤, 금요일은 월요일이며 월말과 연말을 처리',()=>{
 assert.equal(defaultDelivery('2026-10-23'),'2026-10-26');
 assert.equal(defaultDelivery('2026-10-24'),'2026-10-26');
 assert.equal(defaultDelivery('2026-10-22'),'2026-10-24');
 assert.equal(defaultDelivery('2026-12-31'),'2027-01-02');
 assert.equal(defaultDelivery('2026-10-30'),'2026-11-02');
});
test('합산 선택 시 위치별 원본 보존, 대리점·단위는 합산하고 공종은 분리',()=>{
 const d=draft();d.rows=[{...d.rows[0],quantity:10,location:'1번 스튜디오'},{...d.rows[0],quantity:10,location:'2번 스튜디오'}];
 const before=JSON.stringify(d);let wb=XLSX.read(fillRequestTemplate(template,d));assert.equal(wb.Sheets[wb.SheetNames[0]].Q12.v,10);assert.equal(wb.Sheets[wb.SheetNames[0]].Q13.v,10);
 d.mergeItems=true;wb=XLSX.read(fillRequestTemplate(template,d));const form=wb.Sheets[wb.SheetNames[0]];assert.equal(form.Q12.v,20);assert.equal(form.Q13,undefined);assert.match(form.U12.v,/1번 스튜디오.*2번 스튜디오/);
 const detail=parseDraftSheet(wb,'작성 상세내역');assert.equal(detail.rows.length,2);assert.equal(detail.rows[1].location,'2번 스튜디오');assert.equal(detail.rows[1].quantity,10);delete d.mergeItems;assert.equal(JSON.stringify(d),before);
 d.mergeItems=true;d.rows.push({...d.rows[0],dealer:'다른 업체'},{...d.rows[0],unit:'BOX'},{...d.rows[0],trade:'소방'});wb=XLSX.read(fillRequestTemplate(template,d));assert.equal(wb.Sheets[wb.SheetNames[0]].Q12.v,40);assert.equal(wb.Sheets[wb.SheetNames[0]].L12.v,'EA');assert.equal(wb.Sheets[wb.SheetNames[0]].Q13.v,10);
});
test('위치·신청자는 중복 없이 합치고 기계·소방 수량은 각각 유지',()=>{
 const d=draft();d.mergeItems=true;d.rows=[
  {...d.rows[0],quantity:10,location:'1번 스튜디오',applicant:'김 차장',trade:'기계'},
  {...d.rows[0],quantity:20,location:'2번 스튜디오',applicant:'박 팀장',trade:'기계'},
  {...d.rows[0],quantity:5,location:'1번 스튜디오',applicant:'김 차장',trade:'기계'},
  {...d.rows[0],quantity:7,location:'3번 스튜디오',applicant:'이 부장',trade:'소방'}
 ];
 const wb=XLSX.read(fillRequestTemplate(template,d)),sheet=wb.Sheets[wb.SheetNames[0]];
 assert.equal(sheet.Q12.v,35);assert.equal(sheet.U12.v,'1번 스튜디오 / 2번 스튜디오');assert.equal(sheet.V12.v,'김 차장 / 박 팀장');assert.equal(sheet.W12.v,'');assert.equal(parseDraftSheet(wb,'작성 상세내역').rows[0].trade,'기계');
 assert.equal(sheet.Q13.v,7);assert.equal(sheet.U13.v,'3번 스튜디오');assert.equal(sheet.V13.v,'이 부장');assert.equal(sheet.W13.v,'');assert.equal(parseDraftSheet(wb,'작성 상세내역').rows[3].trade,'소방');
});
test('인쇄 밖 위치·신청자·구분의 글꼴·정렬과 잔여 테두리를 통일',()=>{
 const d=draft();d.rows=Array.from({length:25},()=>({...d.rows[0],trade:'소방'}));
 const bytes=fillRequestTemplate(template,d),xml=strFromU8(unzipSync(bytes)['xl/worksheets/sheet2.xml']);
 for(const column of ['U','V','W'])for(let row=12;row<37;row++)assert.match(xml.match(new RegExp(`<c\\b[^>]*r="${column}${row}"[^>]*>`))[0],/ s="1"/);
 assert.ok(!xml.includes('r="X16"')||xml.match(/<c\b[^>]*r="X16"[^>]*>/)[0].includes('s="1"'));
 const wb=XLSX.read(bytes);assert.equal(wb.Sheets[wb.SheetNames[0]].W36.v,'');
});
test('기존 양식 끝부분과 확장 경계에서도 모든 품목의 병합·서식을 유지',()=>{
 const d=draft();d.rows=Array.from({length:500},()=>({...d.rows[0]}));const bytes=fillRequestTemplate(template,d),wb=XLSX.read(bytes),sheet=wb.Sheets[wb.SheetNames[0]],xml=strFromU8(unzipSync(bytes)['xl/worksheets/sheet2.xml']);
 for(let n=12;n<=511;n++)for(const [a,b] of [['A','B'],['C','H'],['I','K'],['L','M'],['N','O'],['Q','R']])assert.ok(xml.includes(`ref="${a}${n}:${b}${n}"`));
 for(const n of [112,113,119,120,121,511]){
  for(const col of ['A','C','I','L','Q','T']){const style=r=>xml.match(new RegExp(`<c\\b[^>]*r="${col}${r}"[^>]*>`))[0].match(/ s="(\d+)"/)[1];assert.equal(style(n),style(12));}
  assert.equal(sheet['Q'+n].v,1.25);
 }
});
test('띄어쓰기·줄바꿈·보이지 않는 문자 차이는 합산하되 공종은 분리하고 단위 차이는 EA',()=>{
 const row={name:'절연 행거',spec:'D 25',unit:'EA',dealer:'성화 / 대화',trade:'소방',quantity:10};
 const rows=[row,{...row,name:'절연행거\u200B',spec:'D25',dealer:'성화/대화',quantity:20}];
 assert.equal(mergeDraftRows(rows).length,1);assert.equal(mergeDraftRows(rows)[0].quantity,30);
 assert.equal(mergeDraftRows([...rows,{...row,trade:'기계'},{...row,unit:'BOX'}]).length,2);
});
test('품명·규격으로 합산하여 공란 보완·여러 내용 병기·단위 차이 EA 처리',()=>{
 const row={name:'PVC관 (VG2)',spec:'D35',unit:'본',quantity:1,trade:'',dealer:'',location:'',applicant:'',note:''};
 const rows=[row,{...row,quantity:7,trade:'기계',dealer:'두리/연수',location:'지하',applicant:'김',note:'확인'},{...row,quantity:2,trade:'기계',unit:'EA',dealer:'다른 업체',location:'2층',applicant:'박',note:'추가'}];
 const before=JSON.stringify(rows),result=mergeDraftRows(rows);assert.equal(result.length,1);assert.equal(result[0].quantity,10);assert.equal(result[0].unit,'EA');assert.equal(result[0].trade,'기계');assert.equal(result[0].dealer,'두리/연수 / 다른 업체');assert.equal(result[0].location,'지하 / 2층');assert.equal(result[0].applicant,'김 / 박');assert.equal(result[0].note,'확인 / 추가');assert.equal(JSON.stringify(rows),before);
 const both=mergeDraftRows([...rows,{...row,trade:'소방',quantity:5}]);assert.equal(both.length,3);assert.equal(both.find(r=>r.trade==='소방').quantity,5);assert.equal(both.find(r=>r.trade==='').quantity,1);
 const blankUnit=mergeDraftRows([{...row,unit:''},{...row,unit:'M'}]);assert.equal(blankUnit[0].unit,'M');
});
