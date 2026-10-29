import {esc} from './core.js';

export function setupToolPhotoViewer(){
 document.addEventListener('click',event=>{
  const link=event.target.closest('.tool-view-photos a,#tool-photo-list a,.tool-record-gallery a');
  if(!link||!link.querySelector('img'))return;
  const source=link.querySelector('img').getAttribute('src');
  if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(source||''))return;
  event.preventDefault();
  document.querySelector('.tool-photo-viewer')?.remove();
  const name=link.querySelector('img').alt||'사진.jpg',filename=name.replace(/\.[^.]+$/,'')+'.jpg';
  const viewer=document.createElement('dialog');viewer.className='tool-photo-viewer';
  viewer.setAttribute('aria-label','사진 크게 보기');
  viewer.innerHTML=`<div class="tool-photo-viewer-bar"><b>${esc(name)}</b><a class="btn secondary" href="${esc(source)}" download="${esc(filename)}">다운로드</a><button type="button" class="btn secondary" aria-label="사진 닫기">닫기 ×</button></div><div class="tool-photo-viewer-image"><img src="${esc(source)}" alt="${esc(name)}"></div>`;
  const close=()=>{viewer.close();viewer.remove();if(link.isConnected)link.focus({preventScroll:true});};
  viewer.querySelector('button').addEventListener('click',close);
  viewer.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();close();});
  viewer.addEventListener('click',event=>{if(event.target===viewer)close();});
  document.body.append(viewer);viewer.showModal();
 });
}
