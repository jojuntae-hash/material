import {test} from 'node:test';
import assert from 'node:assert/strict';
import {receiptSummary,addReceipt,cancelReceipt,validateReceipts} from '../src/receipts.js';
const data={quantity:10,unit:'EA'},actor='검수자';
test('기존 청구는 미입고이며 일부입고·완료·취소 후 재입고를 계산',()=>{
 assert.equal(receiptSummary(data).status,'미입고');
 const a=addReceipt(data,{quantity:3,actor});assert.equal(receiptSummary(a).status,'일부입고');
 const b=addReceipt(a,{quantity:7,actor});assert.equal(receiptSummary(b).status,'입고완료');
 const c=cancelReceipt(b,{receiptId:a.receipts[0].id,reason:'오입력',actor});assert.equal(receiptSummary(c).remaining,3);
 assert.equal(receiptSummary(addReceipt(c,{quantity:3,actor})).status,'입고완료');
 assert.equal(c.receipts.length,3);assert.equal(a.receipts[0].quantity,3);assert.equal(data.receipts,undefined);
});
test('초과·음수·빈 값·비정상·정밀도 초과 입고 차단',()=>{
 for(const quantity of [11,0,-1,'',NaN,Infinity,0.000001])assert.throws(()=>addReceipt(data,{quantity,actor}));
 for(const quantity of [null,0,-1])assert.throws(()=>addReceipt({quantity},{quantity:1,actor}));
 const d=addReceipt({quantity:0.3},{quantity:0.1,actor});assert.equal(receiptSummary(d).remaining,0.2);
 assert.equal(receiptSummary(addReceipt(d,{quantity:0.2,actor})).status,'입고완료');
});
test('중복취소·누락취소사유·입고 이하 청구수량 정정 차단',()=>{
 const a=addReceipt(data,{quantity:3,actor}),id=a.receipts[0].id;
 assert.throws(()=>cancelReceipt(a,{receiptId:id,reason:' ',actor}));
 const b=cancelReceipt(a,{receiptId:id,reason:'잘못 확인',actor});
 assert.throws(()=>cancelReceipt(b,{receiptId:id,reason:'중복',actor}));
 assert.throws(()=>validateReceipts({...a,quantity:2}));
 assert.throws(()=>validateReceipts({...a,receipts:[...a.receipts,a.receipts[0]]}));
 assert.throws(()=>cancelReceipt(a,{receiptId:'missing',reason:'오류',actor}));
});

