export function validateUploadFiles(files){
 if(files.length!==1)throw Error('청구서는 한 번에 한 파일씩 넣어 주세요.');
 const file=files[0];
 if(!/\.xlsx$/i.test(file.name))throw Error('.xlsx 엑셀 파일만 넣을 수 있습니다.');
 if(file.size>15*1024*1024)throw Error('엑셀은 15MB 이하로 선택하세요.');
 return file;
}
export function enableUploadDrop({document,isUpload,onFile,onError}){
 let depth=0;
 const zone=()=>document.querySelector('.upload-zone');
 const files=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
 document.addEventListener('dragenter',e=>{if(!isUpload()||!files(e))return;e.preventDefault();if(e.target.closest?.('.upload-zone')){depth++;zone()?.classList.add('drag-over');}});
 document.addEventListener('dragover',e=>{if(!isUpload()||!files(e))return;e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect=e.target.closest?.('.upload-zone')?'copy':'none';});
 document.addEventListener('dragleave',e=>{if(!e.target.closest?.('.upload-zone'))return;depth=Math.max(0,depth-1);if(!depth)zone()?.classList.remove('drag-over');});
 document.addEventListener('drop',e=>{if(!isUpload()||!files(e))return;e.preventDefault();depth=0;zone()?.classList.remove('drag-over');if(!e.target.closest?.('.upload-zone'))return;try{onFile(validateUploadFiles(Array.from(e.dataTransfer.files)));}catch(err){onError(err.message);}});
 document.addEventListener('dragend',()=>{depth=0;zone()?.classList.remove('drag-over');});
}
