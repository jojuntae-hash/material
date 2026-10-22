from pathlib import Path
p=Path(__file__).resolve().parents[1]/'src'/'main.js'
s=p.read_text(encoding='utf-8')
old="return title('청구내역 조회','필요한 자재 내역을 찾고, 새로운 청구서를 한 번에 정리하세요.',canEdit()?btn(icon('plus')+' 직접 등록','new-request','secondary')+btn(icon('upload')+' 청구서 업로드','upload'):'')+`<div class=\"stats\">"
new="const summaryActions=canEdit()?btn(icon('plus')+' 직접 등록','new-request','secondary')+btn(icon('upload')+' 청구서 업로드','upload'):'';\n return title('청구내역 조회','필요한 자재 내역을 찾고, 새로운 청구서를 한 번에 정리하세요.')+`<details class=\"request-summary\" ${!matchMedia('(max-width:767px)').matches||mobileSummaryOpen?'open':''}><summary><span class=\"summary-closed\">요약·등록 펼치기</span><span class=\"summary-open\">요약·등록 접기</span><small>전체 ${number(all.length)}건</small><span class=\"summary-chevron\">⌄</span></summary><div class=\"summary-actions\">${summaryActions}</div><div class=\"stats\">"
if old in s:
 s=s.replace(old,new,1)
 oldend=".join('')}</div><section class=\"panel filter-panel\">"
 assert oldend in s
 s=s.replace(oldend,".join('')}</div></details><section class=\"panel filter-panel\">",1)
 s=s.replace("let masterSearch='',masterTrade='';","let masterSearch='',masterTrade='';let mobileSummaryOpen=false;",1)
 s=s.replace("document.addEventListener('submit',event=>", "document.addEventListener('toggle',event=>{if(event.target.matches?.('.request-summary')&&matchMedia('(max-width:767px)').matches)mobileSummaryOpen=event.target.open;},true);\nmatchMedia('(max-width:767px)').addEventListener('change',event=>{const panel=document.querySelector('.request-summary');if(panel)panel.open=!event.matches||mobileSummaryOpen;});\ndocument.addEventListener('submit',event=>",1)
for field,raw in [('manufacturerId','rawManufacturer'),('dealerId','rawDealer')]:
 s=s.replace(f"vendorName(d.{field})||'미등록'",f"vendorName(d.{field})||d.{raw}||'미등록'")
p.write_text(s,encoding='utf-8')
