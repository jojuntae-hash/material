import './statements.css';
export function statementsView(){return `<section class="statements-module"><div class="statements-toolbar"><h1>거래명세표</h1><a class="btn secondary" href="/statements/실행.html" target="_blank" rel="noopener">별도 창으로 열기 ↗</a></div><iframe id="statements-frame" title="거래명세표 보관함 · 컴퓨터 폴더 연결" src="/statements/실행.html"></iframe></section>`;}
export function canLeaveStatements(){
 const frame=document.querySelector('#statements-frame');
 const status=frame?.contentWindow?.statementWorkState?.();
 if(status?.busy){alert('거래명세표 작업이 진행 중입니다. 완료된 뒤 메뉴를 이동하세요.');return false;}
 if(status?.dirty)return confirm('거래명세표에 저장하지 않은 수정 또는 진행 중인 작업이 있습니다. 저장·완료 후 이동하는 것을 권장합니다. 그래도 메뉴를 이동할까요?');
 return true;
}
