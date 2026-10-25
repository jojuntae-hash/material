import test from 'node:test';
import assert from 'node:assert/strict';
import {materialRules,materialRulesId,materialNameKey,validateMaterialRules,convertMaterialRow,uniqueMaterialAliases} from '../src/material-names.js';
const seed=materialRules({records:[]});
test('첨부된 33개 변환 규칙과 공통규칙: 띄어쓰기·각도기호만 무시하고 전체 일치',()=>{
 assert.equal(seed.length,33);assert.doesNotThrow(()=>validateMaterialRules(seed));
 for(const r of seed)for(const name of r.aliases)assert.equal(convertMaterialRow({name},seed).name,r.target);
 assert.equal(convertMaterialRow({name:'PVC 이중관 엘보90'},seed).name,'PVC 엘보 (NC1)');
 assert.equal(convertMaterialRow({name:' PVC이중관엘보45˚ '},seed).name,'PVC 45˚엘보 (NC1)');
 assert.equal(convertMaterialRow({name:'HIVP 90°엘보'},seed).name,'PVC 엘보(HIVP)');
 assert.equal(convertMaterialRow({name:'특수 HIVP 90엘보'},seed).name,'특수 HIVP 90엘보');
 assert.notEqual(materialNameKey('45°엘보'),materialNameKey('90°엘보'));
});
test('품명만 변경하고 규격·단위·수량·기계소방·작업위치와 원래 이름을 보존',()=>{
 const row={name:'절연행가(전산볼트)',spec:'D25',unit:'EA',quantity:12,trade:'소방',location:'지하',applicant:'김',dealer:'성화/대화'};
 const before=JSON.stringify(row),next=convertMaterialRow(row,seed);assert.equal(next.name,'절연행가');assert.equal(next.originalName,row.name);assert.equal(JSON.stringify(row),before);
 for(const k of ['spec','unit','quantity','trade','location','applicant','dealer'])assert.equal(next[k],row[k]);
 assert.deepEqual(convertMaterialRow({name:'미등록자재'},seed),{name:'미등록자재'});
});
test('여러 별칭·충돌 차단·현장별 관리 목록과 빈 목록 유지',()=>{
 const rules=[{id:'a',aliases:['원래이름1','원래이름2'],target:'표준명',category:'분류'}];assert.equal(convertMaterialRow({name:'원래 이름2'},rules).name,'표준명');
 const conflict=[...rules,{id:'b',aliases:['원래 이름1'],target:'다른이름'}];assert.throws(()=>validateMaterialRules(conflict),/서로 다른/);assert.throws(()=>convertMaterialRow({name:'원래이름1'},conflict),/충돌/);
 assert.deepEqual(materialRules({records:[{id:materialRulesId,kind:'batch',data:{type:'material-name-rules',rules:[]}}]}),[]);
 assert.equal(materialRules({records:[]}).length,33);assert.equal(convertMaterialRow({name:''},rules).name,'');
});
test('반복 적용 시 이름이 계속 바뀌는 연쇄·순환 규칙 차단과 별칭 중복 제거',()=>{
 assert.deepEqual(uniqueMaterialAliases(['PVC 90°엘보','PVC90엘보','PVC90˚엘보','다른이름']),['PVC 90°엘보','다른이름']);
 assert.throws(()=>validateMaterialRules([{aliases:['A'],target:'B'},{aliases:['B'],target:'C'}]),/다시 변환/);
 assert.throws(()=>validateMaterialRules([{aliases:['A'],target:'B'},{aliases:['B'],target:'A'}]),/다시 변환/);
 for(const rule of seed){const once=convertMaterialRow({name:rule.aliases[0]},seed);assert.equal(convertMaterialRow(once,seed).name,once.name);}
});
