import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {parseDraftSheet} from '../src/request-import.js';
import {fillRequestTemplate} from '../src/request-template.js';
import {detectSheet,extractRows} from '../src/excel.js';
const workbook=rows=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'목록');return wb;};
test('품명만 있는 파일도 빈 항목을 추정하지 않고 가져온다',()=>{
 const result=parseDraftSheet(workbook([['품명'],['배관'],['밸브']]),'목록');
 assert.equal(result.rows.length,2);assert.deepEqual(result.rows[0],{name:'배관',spec:'',unit:'',quantity:'',dealer:'',location:'',applicant:'',note:'',trade:''});
});
test('열 순서·공백·선택 열과 쉼표 수량을 처리하고 품명 없는 행 제외',()=>{
 const result=parseDraftSheet(workbook([['신청자','수 량','작업 위치','품 명','규 격','대리점','단위','구분'],['김','1,200.5','지하','배관','25A','업체','M','기계'],['박',2,'지상','','','','',''],['이',3,'옥상','밸브','','','','소방']]),'목록');
 assert.equal(result.rows.length,2);assert.equal(result.skipped,1);assert.equal(result.rows[0].quantity,'1200.5');assert.equal(result.rows[0].location,'지하');assert.equal(result.rows[1].trade,'소방');
 assert.throws(()=>parseDraftSheet(workbook([['품명','수량','청구수량']]),'목록'),/여러/);
 assert.throws(()=>parseDraftSheet(workbook([['규격']]),'목록'),/품명/);
});
test('병합된 기존 양식에서 Q열 수량과 인쇄 밖 U~W열을 정확히 읽는다',()=>{
 const bytes=fillRequestTemplate(fs.readFileSync(new URL('../public/templates/request.xlsx',import.meta.url)),{date:'2026-10-24',rows:[{name:'배관',spec:'25A',unit:'M',quantity:2.5,dealer:'대리점',location:'지하',applicant:'김',trade:'기계'}]});
 const wb=XLSX.read(bytes),result=parseDraftSheet(wb,wb.SheetNames[0],'기계 청구서.xlsx');assert.equal(result.form,true);assert.equal(result.rows.length,1);assert.deepEqual(result.rows[0],{name:'배관',spec:'25A',unit:'M',quantity:2.5,dealer:'대리점',location:'지하',applicant:'김',note:'',trade:'기계'});
});
test('W열은 메모로 왕복하고 공종은 청구번호 우선, 파일명 보완 및 혼합표기 거부',()=>{
 const source={date:'2026-10-25',number:'파주 콘텐츠시티 현장 -  - ',rows:[{name:'배관',spec:'25A',unit:'M',quantity:2,note:'현장 확인 후 사용',trade:'소방'}]};
 const template=fs.readFileSync(new URL('../public/templates/request.xlsx',import.meta.url));
 let wb=XLSX.read(fillRequestTemplate(template,source)),name=wb.SheetNames[0];
 assert.equal(wb.Sheets[name].W9.v,'메모');assert.equal(wb.Sheets[name].W12.v,'현장 확인 후 사용');
 const info=detectSheet(wb,name,'소방 자재청구서.xlsx'),rows=extractRows(info,{});assert.equal(rows[0].data.trade,'소방');assert.equal(rows[0].data.note,'현장 확인 후 사용');
 assert.equal(parseDraftSheet(wb,name,'소방.xlsx').rows[0].trade,'소방');assert.equal(parseDraftSheet(wb,name,'기계_소방.xlsx').rows[0].trade,'');
 source.number='기계-001';wb=XLSX.read(fillRequestTemplate(template,source));assert.equal(detectSheet(wb,wb.SheetNames[0],'소방.xlsx').trade,'기계');
 assert.equal(parseDraftSheet(wb,wb.SheetNames[0],'소방.xlsx').rows[0].note,'현장 확인 후 사용');
});
