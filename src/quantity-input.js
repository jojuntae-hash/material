import {esc} from './core.js';
import {evaluateQuantityExpression} from './quantity-expression.js';
import './quantity-input.css';

export function quantityInput(value='',attributes=''){
 return `<span class="quantity-control"><input type="text" data-quantity-expression inputmode="text" autocomplete="off" maxlength="200" title="4+4, 3*5, 12/3 입력 후 Enter로 계산" value="${esc(value)}" ${attributes}><span class="quantity-spinner"><button type="button" data-quantity-step="1" aria-label="수량 1 늘리기" tabindex="-1">▴</button><button type="button" data-quantity-step="-1" aria-label="수량 1 줄이기" tabindex="-1">▾</button></span></span>`;
}
export function setupQuantityInputs(notice){
 const selector='input[data-quantity-expression]';
 function write(input,value){input.value=String(value);input.setCustomValidity('');input.removeAttribute('aria-invalid');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
 function read(input){const value=evaluateQuantityExpression(input.value);if(input.min!==''&&value<Number(input.min))throw Error(`수량은 ${input.min} 이상으로 입력하세요.`);if(input.max!==''&&value>Number(input.max))throw Error(`수량은 ${input.max} 이하로 입력하세요.`);return value;}
 function error(input,err){input.setCustomValidity(err.message);input.setAttribute('aria-invalid','true');notice(err.message,true);}
 function commit(input){if(!input.value.trim()){input.setCustomValidity('');input.removeAttribute('aria-invalid');return true;}try{write(input,read(input));return true;}catch(err){error(input,err);return false;}}
 function step(input,delta){try{let value=(input.value.trim()?read(input):0)+delta;if(input.min!=='')value=Math.max(Number(input.min),value);if(input.max!=='')value=Math.min(Number(input.max),value);write(input,Number(value.toFixed(5)));input.focus({preventScroll:true});}catch(err){error(input,err);}}
 document.addEventListener('input',event=>{if(event.target.matches(selector)){event.target.setCustomValidity('');event.target.removeAttribute('aria-invalid');}},true);
 document.addEventListener('keydown',event=>{const input=event.target;if(!input.matches(selector)||event.isComposing)return;if(event.key==='Enter'){event.preventDefault();if(!commit(input))event.stopImmediatePropagation();}if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();step(input,event.key==='ArrowUp'?1:-1);}},true);
 document.addEventListener('focusout',event=>{if(event.target.matches(selector))commit(event.target);},true);
 document.addEventListener('click',event=>{const legacy=event.target.closest('[data-tool-action=quantity-step]');if(legacy){const input=legacy.closest('.tool-quantity').querySelector(selector);if(input&&!commit(input)){event.preventDefault();event.stopImmediatePropagation();return;}}const button=event.target.closest('[data-quantity-step]');if(button){event.preventDefault();step(button.closest('.quantity-control').querySelector(selector),Number(button.dataset.quantityStep));return;}if(event.target.closest('[data-compose="export"],[data-compose="draft-save"],[data-compose="draft-save-copy"],[data-compose="copy-row"],[data-compose="copy-selected"]')){for(const input of document.querySelectorAll('.composer-table '+selector))if(!commit(input)){event.preventDefault();event.stopImmediatePropagation();input.focus();return;}}},true);
 document.addEventListener('submit',event=>{for(const input of event.target.querySelectorAll(selector))if(!commit(input)){event.preventDefault();event.stopImmediatePropagation();input.focus();return;}},true);
}
