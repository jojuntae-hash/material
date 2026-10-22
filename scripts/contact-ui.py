from pathlib import Path
p=Path(__file__).resolve().parents[1]/'src'/'main.js'
s=p.read_text(encoding='utf-8')
if "from './contacts.js'" not in s:s=s.replace("import {applyLocalUpdate}","import {applyContactUpdate} from './contact-update.js';\nimport {contactList,withContactRows,phoneValue} from './contacts.js';\nimport {applyLocalUpdate}",1)
start=s.index('function vendorsView(){');end=s.index('function approvalsView()',start)
s=s[:start]+'''function vendorsView(){
 const all=contactList(store.records),rows=all.filter(c=>(!masterTrade||c.trade===masterTrade)&&(!masterSearch||[c.item,c.manufacturer,c.dealer,c.phone,c.fax,c.person,c.note,...(c.emails||[])].join(' ').toLowerCase().includes(masterSearch.toLowerCase()))).sort((a,b)=>a.trade.localeCompare(b.trade,'ko')||(a.source?.row||9999)-(b.source?.row||9999));
 return title('업체연락처 조회','품목별 제조사·대리점과 해당 대리점의 연락처를 함께 확인하세요.',canEdit()?btn(icon('plus')+' 연락처 등록','contact-new')+btn('업체 등록','new-vendor','secondary'):'')+masterFilter('품목, 제조사, 대리점, 전화, 담당자 검색')+`<div class="section-heading"><div><h2>품목별 연락처 <span class="count">${rows.length}</span></h2><p>기계 ${all.filter(c=>c.trade==='기계').length}행 · 소방 ${all.filter(c=>c.trade==='소방').length}행 · 전화·팩스는 해당 행의 대리점 정보입니다.</p></div>${btn('확인 필요 자료','contact-pending','secondary')}</div><p class="mobile-only contact-scroll-hint">표를 좌우로 밀어 전화·팩스를 확인하세요.</p>${rows.length?`<div class="table-panel"><table class="contact-table"><thead><tr><th>공종</th><th>품목</th><th>제조사</th><th>대리점</th><th>연락처</th><th>팩스</th><th>담당자·비고</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr data-action="contact-detail" data-id="${c.ownerId}" data-contact="${c.id}" role="button" tabindex="0"><td>${badge(c.trade,c.trade==='소방'?'fire':'mechanical')}</td><td class="contact-item"><b>${e(c.item)}</b></td><td>${e(c.manufacturer)}</td><td><b>${e(c.dealer)}</b></td><td class="contact-phone">${e(c.phone||'미등록')}</td><td class="contact-phone">${e(c.fax||'—')}</td><td class="contact-note">${e(c.person||'')}${c.person&&c.note?'<br>':''}${e(c.note||'—')}${c.emails?.length?`<small>${e(c.emails.join(' / '))}</small>`:''}</td><td>${icon('arrow')}</td></tr>`).join('')}</tbody></table></div>`:empty('등록된 연락처가 없습니다.')}`;
}
''' + s[end:]
s=s.replace('await applyLocalUpdate(store);','await applyLocalUpdate(store);\n await applyContactUpdate(store);',1)
# Add contact form to existing common submit route.
s=s.replace("if(form.id==='edit-form')await saveEditor(form);","if(form.id==='edit-form')await saveEditor(form);\n if(form.id==='contact-form')await saveContactForm(form);",1)
anchor=" if(a==='detail')detail(id);"
s=s.replace(anchor,anchor+"""
 if(a==='contact-detail')contactDetail(id,el.dataset.contact);
 if(a==='contact-edit')editContact(id,el.dataset.contact);
 if(a==='contact-new')editContact();
 if(a==='contact-delete'){
  if(!confirm('이 연락처를 목록에서 제거할까요? 변경 이력에서 복구할 수 있습니다.'))return;
  const owner=store.records.find(r=>r.id===id),rows=owner.data.contactRows.map(c=>c.id===el.dataset.contact?{...c,deleted:true}:c);
  const next=withContactRows(owner,rows);await store.save('vendor',owner.id,next.data,owner.version,'사용자 요청: 연락처 목록에서 제거','연락처 삭제');closeModal(true);render();toast('연락처를 목록에서 제거했습니다.');
 }
 if(a==='contact-pending'){
  const batch=active('batch').find(r=>r.data.contactRebuild);const rows=batch?.data.unresolvedSourceRows||[];
  showDialog(`<div class="modal-body"><h2>원본 확인 필요 자료 ${rows.length}행</h2><p>번호가 없는 행과 연락처 칸에 업체명이 적힌 행은 전화·팩스로 등록하지 않았습니다.</p><div class="table-panel"><table><thead><tr><th>원본</th><th>품목</th><th>확인 사유</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${e(r.sheet)} ${r.row}행</td><td>${e(r.item)}</td><td>${e(r.reason)}</td></tr>`).join('')}</tbody></table></div></div>`,true);
 }
""",1)
# Route the settings contact action to a relationship form.
s=s.replace("업체·담당자 정보 관리","품목별 업체연락처 관리").replace("전화·이메일·담당자를 수정할 수 있습니다.","품목별 전화·팩스·이메일·담당자를 수정할 수 있습니다.")
p.write_text(s,encoding='utf-8')
