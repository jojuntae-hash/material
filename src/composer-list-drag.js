export function moveListItem(values,from,to){
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=values.length||to>=values.length)return values;
 const next=[...values];next.splice(to,0,...next.splice(from,1));return next;
}
export function setupListDrag({canStart,onMove}){
 let drag=null,frame=0;
 const clear=()=>{cancelAnimationFrame(frame);document.querySelectorAll('.list-drag-source,.list-drop-before,.list-drop-after').forEach(e=>e.classList.remove('list-drag-source','list-drop-before','list-drop-after'));document.body.classList.remove('list-drag-active');drag=null;};
 const update=()=>{
  if(!drag?.active)return;if(!drag.group.isConnected){clear();return;}
  const rect=drag.group.getBoundingClientRect();
  if(drag.y<rect.top+35)drag.group.scrollTop-=10;else if(drag.y>rect.bottom-35)drag.group.scrollTop+=10;
  const row=document.elementFromPoint(drag.x,Math.max(rect.top+1,Math.min(rect.bottom-1,drag.y)))?.closest('.composer-list-row');
  document.querySelectorAll('.list-drop-before,.list-drop-after').forEach(e=>e.classList.remove('list-drop-before','list-drop-after'));
  drag.valid=Boolean(row&&row.parentElement===drag.group&&drag.x>=rect.left&&drag.x<=rect.right);
  if(drag.valid){const index=Number(row.dataset.listIndex),r=row.getBoundingClientRect(),after=drag.y>r.top+r.height/2;drag.to=index===drag.from?drag.from:index+(after?1:0)-(index>=drag.from?1:0);if(index!==drag.from)row.classList.add(after?'list-drop-after':'list-drop-before');}
  frame=requestAnimationFrame(update);
 };
 document.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-list-drag]');if(!handle||event.button!==0||!canStart())return;
  clear();event.preventDefault();handle.focus({preventScroll:true});handle.setPointerCapture(event.pointerId);
  drag={group:handle.closest('.composer-list-items'),key:handle.dataset.listDrag,from:Number(handle.dataset.index),to:Number(handle.dataset.index),original:handle.dataset.original,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,id:event.pointerId};
 });
 document.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;drag.x=event.clientX;drag.y=event.clientY;if(!drag.active&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>5){drag.active=true;drag.group.querySelector(`[data-list-index="${drag.from}"]`).classList.add('list-drag-source');document.body.classList.add('list-drag-active');update();}});
 document.addEventListener('pointerup',event=>{if(!drag||event.pointerId!==drag.id)return;const current=drag;clear();if(current.active&&current.valid&&current.from!==current.to&&current.group.isConnected)onMove(current);});
 document.addEventListener('pointercancel',clear);window.addEventListener('blur',clear);document.addEventListener('keydown',event=>{if(event.key==='Escape')clear();});
}
