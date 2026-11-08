import {esc} from './core.js';
import {appearanceKey,themeOptions,readAppearance,writeAppearance,normalizeAppearance} from './appearance-preferences.js';
let current={theme:'quiet',fontScale:100};
function apply(settings){
 current=normalizeAppearance(settings);const root=document.documentElement;
 root.dataset.theme=current.theme;root.dataset.fontScale=String(current.fontScale);
 root.dataset.scaled=String(current.fontScale!==100||current.theme!=='classic');
 root.style.setProperty('--font-scale',String(current.fontScale/100));
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',({quiet:'#e7e8e0',grid:'#f6f7f9',block:'#ffdc39',classic:'#152d3d'})[current.theme]);
 sync();requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
}
function sync(){
 for(const input of document.querySelectorAll('[name="appearance-theme"]')){input.checked=input.value===current.theme;input.closest('.theme-option').classList.toggle('is-selected',input.checked);}
 const range=document.querySelector('#appearance-font-size');if(range)range.value=current.fontScale;
 const output=document.querySelector('#appearance-font-value');if(output)output.textContent=current.fontScale+'%';
 for(const button of document.querySelectorAll('[data-font-size]'))button.setAttribute('aria-pressed',String(Number(button.dataset.fontSize)===current.fontScale));
 const preview=document.querySelector('#appearance-preview-name');if(preview)preview.textContent=themeOptions.find(t=>t.id===current.theme).name;
}
export function appearanceSettings(){return `<section class="appearance-settings"><div class="panel appearance-themes"><div class="appearance-heading"><div><h2>디자인 테마</h2><p>원하는 분위기를 선택하면 모든 메뉴에 바로 적용됩니다.</p></div><span class="appearance-saving">자동 저장</span></div><fieldset class="theme-options"><legend class="sr-only">디자인 테마 선택</legend>${themeOptions.map(t=>`<label class="theme-option ${current.theme===t.id?'is-selected':''}" data-palette="${t.id}"><input type="radio" name="appearance-theme" value="${t.id}" ${current.theme===t.id?'checked':''}><span class="theme-mini" aria-hidden="true"><i class="theme-mini-side"><b></b><b></b><b></b></i><i class="theme-mini-work"><em></em><span><b></b><b></b><b></b></span><strong></strong><strong></strong><strong></strong></i></span><span class="theme-option-title">${esc(t.name)}<i class="theme-check" aria-hidden="true">✓</i></span><span class="theme-option-label">${esc(t.label)}</span><small>${esc(t.description)}</small>${t.tag?`<span class="theme-default-tag">${t.tag}</span>`:''}</label>`).join('')}</fieldset></div><section class="panel appearance-font"><div class="appearance-heading"><div><h2>글자 크기</h2><p>글자와 함께 입력칸·버튼·행 간격도 조정합니다.</p></div><output id="appearance-font-value" for="appearance-font-size">${current.fontScale}%</output></div><div class="font-presets">${[[90,'작게'],[100,'기본'],[115,'크게'],[130,'아주 크게']].map(([value,label])=>`<button type="button" data-font-size="${value}" aria-pressed="${current.fontScale===value}">${label}<small>${value}%</small></button>`).join('')}</div><label class="font-range-label" for="appearance-font-size"><span>세부 크기 조절</span><input id="appearance-font-size" type="range" min="90" max="140" step="5" value="${current.fontScale}"><span>90–140%</span></label><div class="appearance-preview"><div><span id="appearance-preview-name">${themeOptions.find(t=>t.id===current.theme).name}</span><b>고무발포 보온재</b><p>품명과 규격을 읽기 편한 크기로 맞춰 보세요.</p></div><div class="appearance-preview-data"><span>25T × D100</span><strong>250 <small>M</small></strong><span class="badge good">입고 확인</span></div></div><p class="appearance-help">큰 글씨에서 넓어진 표는 좌우로 밀어 볼 수 있습니다. 화면 설정은 이 브라우저에 자동 저장되며, 다른 기기에서는 별도로 선택할 수 있습니다.</p><button type="button" class="btn secondary" data-appearance-reset>기본 디자인·크기로 초기화</button></section></section>`;}
export function setupAppearance({notice}={}){
 let storage;try{storage=window.localStorage;}catch{}apply(readAppearance(storage));
 const change=patch=>{apply({...current,...patch});if(!writeAppearance(storage,current))notice?.('화면에는 적용했지만 브라우저에 설정을 저장하지 못했습니다.',true);};
 document.addEventListener('change',event=>{if(event.target.name==='appearance-theme')change({theme:event.target.value});});
 document.addEventListener('input',event=>{if(event.target.id==='appearance-font-size')change({fontScale:Number(event.target.value)});});
 document.addEventListener('click',event=>{const size=event.target.closest('[data-font-size]');if(size)change({fontScale:Number(size.dataset.fontSize)});if(event.target.closest('[data-appearance-reset]'))change({theme:'quiet',fontScale:100});});
 window.addEventListener('storage',event=>{if(event.key===appearanceKey||event.key===null)apply(readAppearance(storage));});
}
