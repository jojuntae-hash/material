import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateQuantityExpression as calculate} from '../src/quantity-expression.js';
test('수량 사칙연산 우선순위·괄호·소수·일반 수량',()=>{for(const [text,result] of [['4+4',8],['10-2',8],['3*5',15],['12/3',4],['2+3*4',14],['(2+3)*4',20],['=4×(2+1)÷3',4],['-2+5',3],['10--2',12],['0.1+0.2',0.3],['1/3',0.33333],['1,000+200',1200],['2e2+5',205],['2.5',2.5],['0',0]])assert.equal(calculate(text),result,text);});
test('잘못된 식·0 나눗셈·코드·과도한 크기와 중첩을 차단',()=>{for(const text of ['', '1/0','0/0','4+','(4+2','4+2)','1..2','1,00','2**3','4;alert(1)','globalThis','Math.max(1,2)','Infinity','2(3)','1e999','1000000000001','1/1000000','('.repeat(40)+'1'+')'.repeat(40),'1+'.repeat(101)+'1'])assert.throws(()=>calculate(text),undefined,text);});
