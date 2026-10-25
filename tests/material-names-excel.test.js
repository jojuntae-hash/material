import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {materialRules} from '../src/material-names.js';
import {buildMaterialRulesWorkbook,parseMaterialRulesSheet,planMaterialRulesImport} from '../src/material-names-excel.js';
test('현재 목록을 엑셀로 왕복하면 전부 중복 제외, 새 행만 추가하며 재업로드도 중복 없음',()=>{
 const original=materialRules({records:[]}),wb=XLSX.read(XLSX.write(buildMaterialRulesWorkbook(original),{type:'array',bookType:'xlsx'}));
 const imported=parseMaterialRulesSheet(wb,wb.SheetNames[0]),first=planMaterialRulesImport(original,imported);assert.equal(first.added,0);assert.equal(first.updated,0);assert.equal(first.skipped,33);
 imported.push({aliases:['신규1','신규2'],target:'신규표준',category:'분류'});
 const next=planMaterialRulesImport(original,imported);assert.equal(next.added,1);assert.equal(next.rules.length,34);assert.equal(original.length,33);assert.equal(planMaterialRulesImport(next.rules,imported).added,0);
});
test('새 별칭만 기존 규칙에 추가하고 공백·각도 차이의 중복과 충돌을 처리',()=>{
 const base=[{id:'a',aliases:['PVC 90°엘보'],target:'PVC 엘보',category:'PVC'}];
 const same=planMaterialRulesImport(base,[{aliases:['PVC90엘보'],target:'PVC 엘보',category:''}]);assert.equal(same.skipped,1);
 const update=planMaterialRulesImport(base,[{aliases:['PVC90엘보','다른이름'],target:'PVC 엘보',category:''}]);assert.equal(update.updated,1);assert.equal(update.rules[0].aliases.length,2);
 assert.throws(()=>planMaterialRulesImport(base,[{aliases:['새이름'],target:'다른표준'},{aliases:['PVC90엘보'],target:'충돌'}]),/기존 규칙과 다릅니다/);assert.equal(base.length,1);assert.equal(base[0].aliases.length,1);
});
test('원본 엑셀 제목·여러 별칭을 읽고 누락 행은 전체 반영 전 차단',()=>{
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['변환전 품명1','변환전 품명2','변환전 품명3','변환전 품명4','변환후','구분','참고사항(공동규칙)'],['A','B','C','D','표준','PVC','메모']]),'목록');
 const result=parseMaterialRulesSheet(wb,'목록');assert.equal(result[0].aliases.length,4);const round=buildMaterialRulesWorkbook(result);assert.equal(parseMaterialRulesSheet(round,round.SheetNames[0])[0].aliases.length,4);
 wb.Sheets['목록']=XLSX.utils.aoa_to_sheet([['변환 전 품명 1','변환 후 품명'],['A','']]);assert.throws(()=>parseMaterialRulesSheet(wb,'목록'),/2행/);
});
