export const appearanceKey='mm-appearance-v1';
export const themeOptions=[
 {id:'quiet',name:'QUIET DESK',label:'부드럽고 차분한 업무형',description:'스톤 그레이, 둥근 패널, 절제된 라임',tag:'기본 디자인'},
 {id:'grid',name:'GRID ERP',label:'촘촘하고 깔끔한 실무형',description:'얇은 구분선과 정돈된 데이터 화면'},
 {id:'block',name:'COLOR BLOCK',label:'선명한 색상의 업무형',description:'원색 포인트, 굵은 테두리와 명확한 구분'},
 {id:'classic',name:'기존 디자인',label:'익숙하고 편안한 클래식',description:'네이비·청록과 기존의 글씨 크기'}
];
export function normalizeAppearance(value){
 const theme=themeOptions.some(t=>t.id===value?.theme)?value.theme:'quiet';
 const raw=Number(value?.fontScale);
 const fontScale=Number.isFinite(raw)&&raw>=90&&raw<=140?Math.round(raw/5)*5:100;
 return {theme,fontScale};
}
export function readAppearance(storage){try{return normalizeAppearance(JSON.parse(storage.getItem(appearanceKey)));}catch{return normalizeAppearance(null);}}
export function writeAppearance(storage,value){const settings=normalizeAppearance(value);try{storage.setItem(appearanceKey,JSON.stringify(settings));return true;}catch{return false;}}
