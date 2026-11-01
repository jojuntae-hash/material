// Parse arithmetic only. Never execute user input as JavaScript.
export function evaluateQuantityExpression(source){
 const text=String(source??'').trim().replace(/^=/,'').replaceAll('×','*').replaceAll('÷','/');
 if(!text||text.length>200)throw Error('수량 또는 200자 이하의 계산식을 입력하세요.');
 let position=0,depth=0,operations=0;
 const space=()=>{while(/\s/.test(text[position]||'')&&position<text.length)position++;};
 function primary(){space();if(++depth>32)throw Error('괄호나 부호가 너무 많습니다.');let value;
  if(text[position]==='+'||text[position]==='-'){const negative=text[position++]==='-';value=primary()*(negative?-1:1);}
  else if(text[position]==='('){position++;value=add();space();if(text[position++]!==')')throw Error('괄호를 확인하세요.');}
  else {const match=/^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(position));if(!match)throw Error('숫자와 + − * / 괄호만 사용할 수 있습니다.');position+=match[0].length;value=Number(match[0].replaceAll(',',''));}
  depth--;return value;
 }
 function multiply(){let value=primary();space();while(text[position]==='*'||text[position]==='/'){const operator=text[position++],right=primary();operations++;if(operator==='/'&&right===0)throw Error('0으로 나눌 수 없습니다.');value=operator==='*'?value*right:value/right;space();}return value;}
 function add(){let value=multiply();space();while(text[position]==='+'||text[position]==='-'){const operator=text[position++],right=multiply();operations++;value=operator==='+'?value+right:value-right;space();}return value;}
 let result=add();space();if(position!==text.length)throw Error('계산식의 숫자·연산자·괄호를 확인하세요.');
 if(!Number.isFinite(result)||Math.abs(result)>1e12)throw Error('계산 결과는 1조 이하의 유한한 수량이어야 합니다.');
 if(operations){const rounded=Number(result.toFixed(5));if(result!==0&&rounded===0)throw Error('수량은 소수 다섯 자리까지만 계산할 수 있습니다.');result=rounded;}
 return Object.is(result,-0)?0:result;
}
