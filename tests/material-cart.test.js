import test from 'node:test';
import assert from 'node:assert/strict';
import {cartStorageKey,readMaterialCart,materialCartData} from '../src/material-cart.js';
import {materialKey} from '../src/aggregation.js';
import {buildMaterialCartWorkbook} from '../src/excel.js';
import * as XLSX from 'xlsx';
const rows=[{id:'1',kind:'request',data:{name:'단니플',spec:'40A',unit:'EA',quantity:117,trade:'기계',date:'2026-10-01'}},{id:'2',kind:'request',data:{name:'단니플(나사)',spec:'40A',unit:'EA',quantity:28,trade:'소방',date:'2026-10-20'}}];
test('장바구니 보관·중복 방지·현장 및 사용자 격리·자료 누락',()=>{const a=cartStorageKey({mode:'cloud',projectId:'a',userId:'u'});assert.notEqual(a,cartStorageKey({mode:'cloud',projectId:'b',userId:'u'}));assert.notEqual(a,cartStorageKey({mode:'cloud',projectId:'a',userId:'v'}));const keys=rows.map(r=>materialKey(r.data));const cart=readMaterialCart({getItem:()=>JSON.stringify([...keys,keys[0]])},a);assert.equal(cart.size,2);const data=materialCartData(rows,cart);assert.equal(data.rows.length,2);assert.equal(data.totals[0].total,145);assert.equal(materialCartData([rows[0]],cart).unavailable,1);assert.equal(readMaterialCart({getItem:()=>'{bad'},a).size,0);});
test('엑셀은 원래 품명별 집계·규격별 합계·전체 청구내역을 포함',()=>{const data=materialCartData(rows,new Set(rows.map(r=>materialKey(r.data))));const wb=buildMaterialCartWorkbook(data,()=>'', '테스트 현장');assert.equal(wb.SheetNames.length,4);const totals=XLSX.utils.sheet_to_json(wb.Sheets['규격별 합계']);assert.equal(totals[0]['총청구수량'],145);const history=XLSX.utils.sheet_to_json(wb.Sheets['청구내역']);assert.equal(history.length,2);assert.deepEqual(new Set(history.map(r=>r['품명'])),new Set(['단니플','단니플(나사)']));assert.equal(materialCartData(rows,new Set()).rows.length,0);});
