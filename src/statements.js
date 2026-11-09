import {mountStatementApp} from './statement-library/app.js';
import template from './statement-library/template.html?raw';
import styles from './statement-library/native.css?inline';
import './statements.css';
let host,engine;
export function statementsView(){return '<section id="statement-native-slot"></section>';}
export function attachStatements(){
 const slot=document.querySelector('#statement-native-slot');if(!slot)return;
 if(!host){
  host=document.createElement('div');host.className='statement-native-host';
  const root=host.attachShadow({mode:'open'});root.innerHTML=`<style>${styles}</style>${template}`;
  root.querySelector('#materialReturn')?.remove();
  const header=root.querySelector('header');header.querySelector('.brand').innerHTML='<h1>거래명세표</h1>';header.querySelector('.section-label')?.remove();
  const intro=root.querySelector('.intro');const summary=document.createElement('div');summary.className='native-summary';
  for(const id of ['totalCount','itemCount','latestStatementDate'])summary.append(root.getElementById(id));intro.replaceWith(summary);
  const library=root.getElementById('library'),aside=library.querySelector('aside');
  const groups=document.createElement('details');groups.className='native-groups';const caption=document.createElement('summary');caption.textContent='거래처 · 관리폴더 분류';groups.append(caption,aside);library.querySelector('.results').prepend(groups);
  engine=mountStatementApp(root);
 }
 slot.append(host);
}
export function canLeaveStatements(){
 const state=engine?.getState();
 if(state?.busy){alert('거래명세표 작업이 진행 중입니다. 완료 후 이동하세요.');return false;}
 return !state?.dirty||confirm('저장하지 않은 거래명세표 수정이 있습니다. 입력 내용은 이 화면에 유지됩니다. 다른 메뉴로 이동할까요?');
}
