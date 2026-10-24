import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {unzipSync,strFromU8} from 'fflate';
import {fillRequestTemplate,validateDraft,draftKey,defaultDelivery} from '../src/request-template.js';
import {detectSheet,extractRows} from '../src/excel.js';
import {parseDraftSheet} from '../src/request-import.js';
const template=new Uint8Array(fs.readFileSync(new URL('../public/templates/request.xlsx',import.meta.url)));
const draft=()=>({date:'2026-10-24',number:'기계-001',project:'테스트 현장',manager:'소장',delivery:'2026-10-27',rows:[{name:'배관 & 시험',spec:'25A',unit:'M',quantity:'1.25',dealer:'테스트 대리점',location:'스튜디오1',applicant:'시험자',trade:'기계'}]});
test('원본 양식의 병합·서식·인쇄설정을 보존하며 정확한 셀에 입력',()=>{
 const bytes=fillRequestTemplate(template,draft()),wb=XLSX.read(bytes,{type:'array'}),s=wb.Sheets[wb.SheetNames[0]];
 for(const [ref,value] of Object.entries({H5:'기계-001',P5:'테스트 현장',P6:'소장',S6:'2026-10-27',C12:'배관 & 시험',I12:'25A',L12:'M',Q12:1.25,T12:'테스트 대리점',U12:'스튜디오1',V12:'시험자',W12:'기계'}))assert.equal(s[ref].v,value);
 assert.equal(XLSX.SSF.parse_date_code(s.H6.v).d,24);assert.equal(s.C13,undefined);
 const before=unzipSync(template),after=unzipSync(bytes);assert.deepEqual(after['xl/styles.xml'],before['xl/styles.xml']);
 assert.equal(Object.keys(before).some(k=>k.startsWith('xl/media/')||k.startsWith('xl/drawings/')),false);
 const xml=strFromU8(after['xl/worksheets/sheet2.xml']),original=strFromU8(before['xl/worksheets/sheet2.xml']);
 for(const tag of ['mergeCells','cols','pageSetup','pageMargins'])assert.equal(xml.match(new RegExp(`<${tag}\\b[\\s\\S]*?(?:</${tag}>|/>)`))[0],original.match(new RegExp(`<${tag}\\b[\\s\\S]*?(?:</${tag}>|/>)`))[0]);
 assert.match(strFromU8(after['xl/workbook.xml']),/\$A\$1:\$T\$42/);
 const info=detectSheet(wb,wb.SheetNames[0]),rows=extractRows(info,{});
 assert.equal(info.warnings.length,0);assert.equal(rows.length,1);
 for(const [field,value] of Object.entries({trade:'기계',location:'스튜디오1',applicant:'시험자',quantity:1.25,rawDealer:'테스트 대리점'}))assert.equal(rows[0].data[field],value);
});
test('수량·필수 입력 검증, 긴 목록 끝행 및 사용자별 임시저장 분리',()=>{
 const d=draft();for(const quantity of ['',0,-1,'abc',Infinity]){d.rows[0].quantity=quantity;assert.throws(()=>validateDraft(d),/수량/);}d.rows[0].quantity=2;
 d.date='2026-02-30';assert.throws(()=>validateDraft(d),/청구일/);d.date='2026-10-24';
 d.rows[0].dealer='';d.rows[0].location='';d.rows[0].applicant='';assert.doesNotThrow(()=>validateDraft(d));
 d.rows=Array.from({length:109},()=>({...d.rows[0]}));const wb=XLSX.read(fillRequestTemplate(template,d));assert.equal(wb.Sheets[wb.SheetNames[0]].Q120.v,2);d.rows.push({...d.rows[0]});assert.throws(()=>validateDraft(d),/109/);
 assert.notEqual(draftKey({mode:'cloud',projectId:'a',session:{user:{id:'u'}}}),draftKey({mode:'cloud',projectId:'a',session:{user:{id:'v'}}}));
});
test('입고요청일은 2일 뒤, 금요일은 월요일이며 월말과 연말을 처리',()=>{
 assert.equal(defaultDelivery('2026-10-23'),'2026-10-26');
 assert.equal(defaultDelivery('2026-10-24'),'2026-10-26');
 assert.equal(defaultDelivery('2026-10-22'),'2026-10-24');
 assert.equal(defaultDelivery('2026-12-31'),'2027-01-02');
 assert.equal(defaultDelivery('2026-10-30'),'2026-11-02');
});
test('합산 선택 시 위치별 원본 보존, 공급업체·단위·공종 차이는 분리',()=>{
 const d=draft();d.rows=[{...d.rows[0],quantity:10,location:'1번 스튜디오'},{...d.rows[0],quantity:10,location:'2번 스튜디오'}];
 const before=JSON.stringify(d);let wb=XLSX.read(fillRequestTemplate(template,d));assert.equal(wb.Sheets[wb.SheetNames[0]].Q12.v,10);assert.equal(wb.Sheets[wb.SheetNames[0]].Q13.v,10);
 d.mergeItems=true;wb=XLSX.read(fillRequestTemplate(template,d));const form=wb.Sheets[wb.SheetNames[0]];assert.equal(form.Q12.v,20);assert.equal(form.Q13,undefined);assert.match(form.U12.v,/1번 스튜디오.*2번 스튜디오/);
 const detail=parseDraftSheet(wb,'작성 상세내역');assert.equal(detail.rows.length,2);assert.equal(detail.rows[1].location,'2번 스튜디오');assert.equal(detail.rows[1].quantity,10);delete d.mergeItems;assert.equal(JSON.stringify(d),before);
 d.mergeItems=true;d.rows.push({...d.rows[0],dealer:'다른 업체'},{...d.rows[0],unit:'BOX'},{...d.rows[0],trade:'소방'});wb=XLSX.read(fillRequestTemplate(template,d));assert.equal(wb.Sheets[wb.SheetNames[0]].Q15.v,10);
});
test('위치·신청자는 중복 없이 합치고 기계·소방 수량은 각각 유지',()=>{
 const d=draft();d.mergeItems=true;d.rows=[
  {...d.rows[0],quantity:10,location:'1번 스튜디오',applicant:'김 차장',trade:'기계'},
  {...d.rows[0],quantity:20,location:'2번 스튜디오',applicant:'박 팀장',trade:'기계'},
  {...d.rows[0],quantity:5,location:'1번 스튜디오',applicant:'김 차장',trade:'기계'},
  {...d.rows[0],quantity:7,location:'3번 스튜디오',applicant:'이 부장',trade:'소방'}
 ];
 const wb=XLSX.read(fillRequestTemplate(template,d)),sheet=wb.Sheets[wb.SheetNames[0]];
 assert.equal(sheet.Q12.v,35);assert.equal(sheet.U12.v,'1번 스튜디오 / 2번 스튜디오');assert.equal(sheet.V12.v,'김 차장 / 박 팀장');assert.equal(sheet.W12.v,'기계');
 assert.equal(sheet.Q13.v,7);assert.equal(sheet.U13.v,'3번 스튜디오');assert.equal(sheet.V13.v,'이 부장');assert.equal(sheet.W13.v,'소방');
});
