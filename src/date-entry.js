/** Format digit entry as a four-digit year, two-digit month and day. */
export function formatDateEntry(value,{deleting=false}={}){
 const digits=String(value||'').replace(/\D/g,'').slice(0,8);
 return digits.slice(0,4)+(digits.length>4||digits.length===4&&!deleting?'-':'')+digits.slice(4,6)+(digits.length>6||digits.length===6&&!deleting?'-':'')+digits.slice(6,8);
}
export function dateEntryError(value,min='',max=''){
 if(!value)return '';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'0001-01-01')return '날짜를 연도 4자리·월 2자리·일 2자리로 입력하세요.';
 const parsed=new Date(value+'T00:00:00Z');if(!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==value)return '올바른 날짜를 입력하세요.';
 if(min&&value<min||max&&value>max)return '허용된 날짜 범위를 확인하세요.';
 return '';
}
const initialized=new WeakSet();
export function setupDateEntries(root=document){
 if(initialized.has(root))return;initialized.add(root);
 function upgrade(input){
  if(input.dataset.calendarPicker!==undefined)return;
  const dateLabel=input.getAttribute('aria-label')||input.labels?.[0]?.textContent.trim()||'날짜';input.setAttribute('aria-label',dateLabel);
  const wrapper=document.createElement('span');wrapper.className='date-entry-wrap';wrapper.style.cssText='display:inline-flex;position:relative;align-items:center;min-width:0;max-width:100%;vertical-align:middle';
  input.before(wrapper);wrapper.append(input);input.type='text';input.dataset.dateEntry='';input.inputMode='numeric';input.maxLength=10;input.pattern='[0-9]{4}-[0-9]{2}-[0-9]{2}';input.placeholder='YYYY-MM-DD';input.autocomplete='off';input.style.paddingRight='34px';input.style.minWidth='0';input.style.width='100%';
  const picker=document.createElement('input');picker.type='date';picker.dataset.calendarPicker='';picker.tabIndex=-1;picker.setAttribute('aria-label',(input.getAttribute('aria-label')||'날짜')+' 달력 선택');picker.style.cssText='position:absolute;right:2px;top:2px;bottom:2px;width:30px!important;min-width:0!important;height:calc(100% - 4px);opacity:0;cursor:pointer;padding:0;border:0';
  const icon=document.createElement('span');icon.textContent='▦';icon.setAttribute('aria-hidden','true');icon.style.cssText='position:absolute;right:9px;pointer-events:none;font-size:19px';wrapper.append(icon,picker);
  const sync=()=>{picker.value=/^\d{4}-\d{2}-\d{2}$/.test(input.value)?input.value:'';picker.min=input.min;picker.max=input.max;picker.disabled=input.disabled||input.readOnly;};sync();
  picker.addEventListener('click',()=>{sync();try{picker.showPicker?.();}catch{}});
  picker.addEventListener('change',()=>{input.value=picker.value;input.setCustomValidity('');input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));input.dispatchEvent(new Event('change',{bubbles:true,composed:true}));});
  input.addEventListener('input',event=>{
   if(event.isComposing)return;const before=input.value,caret=input.selectionStart??before.length,deleting=event.inputType?.startsWith('delete');
   const digitsBefore=before.slice(0,caret).replace(/\D/g,'').length;input.value=formatDateEntry(before,{deleting});
   let next=digitsBefore+(digitsBefore>=4?1:0)+(digitsBefore>=6?1:0);if(caret===before.length)next=input.value.length;input.setSelectionRange(Math.min(next,input.value.length),Math.min(next,input.value.length));input.setCustomValidity(dateEntryError(input.value,input.min,input.max));sync();
  });
  input.addEventListener('change',()=>{input.setCustomValidity(dateEntryError(input.value,input.min,input.max));sync();});
 }
 const scan=node=>{if(node.nodeType!==1&&node!==root)return;if(node.matches?.('input[type="date"]'))upgrade(node);node.querySelectorAll?.('input[type="date"]:not([data-calendar-picker])').forEach(upgrade);};
 scan(root);new MutationObserver(changes=>{for(const change of changes){if(change.type==='attributes'&&change.target.dataset.dateEntry!==undefined){const main=change.target,picker=main.parentElement?.querySelector('[data-calendar-picker]');if(picker)picker.disabled=main.disabled||main.readOnly;}else for(const node of change.addedNodes)scan(node);}}).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly']});
}
