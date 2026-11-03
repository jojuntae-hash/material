/** Move a row and carry index-based selection with the same items. */
export function moveComposerRow(rows, selection, from, to) {
 const order=rows.map((_,i)=>i);
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=rows.length||to>=rows.length)return {rows,selection};
 order.splice(to,0,...order.splice(from,1));
 return {rows:order.map(i=>rows[i]),selection:new Set(order.flatMap((old,i)=>selection.has(old)?[i]:[]))};
}

export function setupComposerReorder(move) {
 let drag=null,frame=0;
 const clear=()=>{cancelAnimationFrame(frame);frame=0;document.querySelectorAll('.composer-dragging,.composer-drop-before,.composer-drop-after').forEach(el=>el.classList.remove('composer-dragging','composer-drop-before','composer-drop-after'));document.body.classList.remove('composer-reordering');drag=null;};
 const locate=()=>{
  if(!drag?.active)return;
  if(!drag.table.isConnected){clear();return;}
  const wrap=drag.table.closest('.composer-table-wrap'),rect=wrap.getBoundingClientRect();
  if(drag.y<rect.top+45)wrap.scrollTop-=12;else if(drag.y>rect.bottom-45)wrap.scrollTop+=12;
  const row=document.elementFromPoint(drag.x,Math.max(rect.top+2,Math.min(rect.bottom-2,drag.y)))?.closest('tr[data-compose-index]');
  document.querySelectorAll('.composer-drop-before,.composer-drop-after').forEach(el=>el.classList.remove('composer-drop-before','composer-drop-after'));
  drag.valid=Boolean(row&&row.closest('table')===drag.table&&drag.x>=rect.left&&drag.x<=rect.right);
  if(drag.valid){
   const index=Number(row.dataset.composeIndex),bounds=row.getBoundingClientRect(),after=drag.y>bounds.top+bounds.height/2;
   drag.to=index===drag.from?drag.from:Math.max(0,index+(after?1:0)-(index>=drag.from?1:0));
   if(index!==drag.from)row.classList.add(after?'composer-drop-after':'composer-drop-before');
  }
  frame=requestAnimationFrame(locate);
 };
 document.addEventListener('pointerdown',ev=>{
  const handle=ev.target.closest('[data-compose-drag]');if(!handle||ev.button!==0)return;
  clear();ev.preventDefault();handle.focus({preventScroll:true});handle.setPointerCapture(ev.pointerId);
  drag={from:Number(handle.dataset.composeDrag),to:Number(handle.dataset.composeDrag),table:handle.closest('table'),startX:ev.clientX,startY:ev.clientY,x:ev.clientX,y:ev.clientY,id:ev.pointerId};
 });
 document.addEventListener('pointermove',ev=>{
  if(!drag||ev.pointerId!==drag.id)return;drag.x=ev.clientX;drag.y=ev.clientY;
  if(!drag.active&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>5){drag.active=true;document.body.classList.add('composer-reordering');drag.table.querySelector(`[data-compose-index="${drag.from}"]`).classList.add('composer-dragging');locate();}
 });
 document.addEventListener('pointerup',ev=>{
  if(!drag||ev.pointerId!==drag.id)return;const current=drag;clear();
  if(current.active&&current.valid&&current.table.isConnected)move(current.from,current.to);
 });
 document.addEventListener('pointercancel',clear);
 window.addEventListener('blur',clear);
 document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape'){clear();return;}
  const handle=ev.target.closest('[data-compose-drag]');if(!handle||!['ArrowUp','ArrowDown'].includes(ev.key))return;
  ev.preventDefault();const from=Number(handle.dataset.composeDrag);move(from,from+(ev.key==='ArrowUp'?-1:1));
 });
}
