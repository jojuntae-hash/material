export function setupToolDrag({canStart,snapshot,onMove}){
 let drag=null,frame=0;
 const clear=()=>{cancelAnimationFrame(frame);document.querySelectorAll('.tool-drag-source,.tool-drop-before,.tool-drop-after').forEach(e=>e.classList.remove('tool-drag-source','tool-drop-before','tool-drop-after'));document.body.classList.remove('tool-drag-active');drag=null;};
 const update=()=>{
  if(!drag?.active)return;if(!drag.row.isConnected){clear();return;}
  const edge=window.innerHeight;if(drag.y<75)window.scrollBy(0,-12);else if(drag.y>edge-65)window.scrollBy(0,12);
  const row=document.elementFromPoint(drag.x,drag.y)?.closest('[data-tool-row]');
  document.querySelectorAll('.tool-drop-before,.tool-drop-after').forEach(e=>e.classList.remove('tool-drop-before','tool-drop-after'));
  drag.target=row?.dataset.toolRow;drag.after=row?drag.y>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2:false;
  if(row&&row!==drag.row)row.classList.add(drag.after?'tool-drop-after':'tool-drop-before');frame=requestAnimationFrame(update);
 };
 document.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-tool-drag]');if(!handle||event.button!==0||!canStart())return;
  clear();event.preventDefault();handle.focus({preventScroll:true});handle.setPointerCapture(event.pointerId);
  drag={row:handle.closest('[data-tool-row]'),id:handle.dataset.toolDrag,original:snapshot(),pointer:event.pointerId,x:event.clientX,y:event.clientY,startY:event.clientY,startX:event.clientX};
 });
 document.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointer)return;drag.x=event.clientX;drag.y=event.clientY;if(!drag.active&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>5){drag.active=true;drag.row.classList.add('tool-drag-source');document.body.classList.add('tool-drag-active');update();}});
 document.addEventListener('pointerup',event=>{if(!drag||event.pointerId!==drag.pointer)return;if(drag.active){cancelAnimationFrame(frame);drag.x=event.clientX;drag.y=event.clientY;update();}const current=drag;clear();if(current.active&&current.target&&current.target!==current.id&&current.row.isConnected)onMove(current);});
 document.addEventListener('pointercancel',clear);window.addEventListener('blur',clear);document.addEventListener('keydown',event=>{if(event.key==='Escape')clear();});
}
