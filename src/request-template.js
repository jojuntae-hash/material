import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';

export const draftKey=s=>`mm-request-draft-v1:${s.mode}:${s.projectId}:${s.session?.user?.id||''}`;
export function defaultDelivery(date){
 const day=new Date(date+'T00:00:00Z');
 if(!Number.isFinite(day.getTime()))return '';
 day.setUTCDate(day.getUTCDate()+(day.getUTCDay()===5?3:2));
 return day.toISOString().slice(0,10);
}
export function validateDraft(d){
 if(!d.rows.length)throw Error('품목을 하나 이상 추가하세요.');
 if(d.rows.length>109)throw Error('한 청구서에는 최대 109개 품목을 넣을 수 있습니다.');
 const parsedDate=new Date(d.date+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==d.date)throw Error('올바른 청구일을 입력하세요.');
 d.rows.forEach((r,i)=>{if(!Number.isFinite(Number(r.quantity))||Number(r.quantity)<=0||Number(r.quantity)>1e12)throw Error(`${i+1}번 수량은 0보다 큰 숫자로 입력하세요.`);});
}
const xmlEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function writeCell(xml,ref,value){
 const pattern=new RegExp(`<c\\b(?=[^>]*\\br="${ref}")[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
 const old=xml.match(pattern)?.[0];const style=old?.match(/\bs="[^"]*"/)?.[0]||'';
 const body=typeof value==='number'?`<v>${value}</v>`:`<is><t xml:space="preserve">${xmlEscape(value)}</t></is>`;
 const cell=`<c r="${ref}" ${style}${typeof value==='number'?'':' t="inlineStr"'}>${body}</c>`;
 if(old)return xml.replace(pattern,()=>cell);
 const row=ref.match(/\d+$/)[0];
 return xml.replace(new RegExp(`(<row\\b[^>]*\\br="${row}"[^>]*>)([\\s\\S]*?)(</row>)`),(_,a,b,c)=>{
  const cells=[...b.matchAll(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)].map(x=>x[0]);cells.push(cell);
  const col=s=>{const letters=s.match(/\br="([A-Z]+)/)[1];return [...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);};
  return a+cells.sort((x,y)=>col(x)-col(y)).join('')+c;
 });
}
export function fillRequestTemplate(bytes,d){
 validateDraft(d);const files=unzipSync(bytes);let xml=strFromU8(files['xl/worksheets/sheet2.xml']);
 const date=Math.round((Date.parse(d.date+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000);
 for(const [ref,v] of Object.entries({H5:d.number||'',H6:date,P5:d.project||'',P6:d.manager||'',S6:d.delivery||''}))xml=writeCell(xml,ref,v);
 d.rows.forEach((r,i)=>{const n=i+12;for(const [col,v] of Object.entries({A:i+1,C:r.name,I:r.spec,L:r.unit,Q:Number(r.quantity),T:r.dealer,U:r.location,V:r.applicant,W:r.trade}))xml=writeCell(xml,col+n,v);});
 files['xl/worksheets/sheet2.xml']=strToU8(xml);
 let wb=strFromU8(files['xl/workbook.xml']);wb=wb.replace(/(<definedName\b[^>]*name="_xlnm.Print_Area"[^>]*>)([\s\S]*?)(<\/definedName>)/,(_,a,b,c)=>a+b.replace(/\$A\$1:\$T\$\d+/,`$A$1:$T$${Math.max(42,d.rows.length+11)}`)+c);files['xl/workbook.xml']=strToU8(wb);
 const sheetName=`${Number(d.date.slice(5,7))}월${Number(d.date.slice(8,10))}일`;
 const oldName=wb.match(/<sheet\b[^>]*name="([^"]+)"/)?.[1];
 if(oldName)files['xl/workbook.xml']=strToU8(wb.replaceAll(oldName,sheetName));
 return zipSync(files,{level:6});
}
