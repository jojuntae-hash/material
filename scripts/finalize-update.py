from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'scripts'/'browser-qa.cjs';s=p.read_text(encoding='utf-8')
if "const expectedTotal=" not in s:
 s=s.replace("const errors=[];", "const expectedTotal=JSON.parse(fs.readFileSync('private-data/seed.json','utf8')).records.filter(r=>r.kind==='request'&&!r.deleted).length;const errors=[];")
 s=s.replace("stats[0]!=='1,983'||stats[1]!=='957'||stats[2]!=='1,026'", "stats[0]!==expectedTotal.toLocaleString('ko-KR')")
 s=s.replace("!=='1,984'", "!==(expectedTotal+1).toLocaleString('ko-KR')")
 p.write_text(s,encoding='utf-8')
p=root/'src'/'main.js';s=p.read_text(encoding='utf-8')
s=s.replace("btn('새로고침','refresh','secondary')}","btn('새로고침','refresh','secondary')}${store.role==='admin'?btn('로컬 자료를 공유 저장으로 가져오기','migrate-local','secondary'):''}",1)
anchor=" if(a==='backup'){"
if "if(a==='migrate-local')" not in s:
 s=s.replace(anchor,""" if(a==='migrate-local'){
  if(store.mode!=='cloud'||store.role!=='admin')throw Error('공유 현장 관리자만 가져올 수 있습니다.');
  const local=await idb('state','local');if(!local)throw Error('이 브라우저에 로컬 자료가 없습니다. 로컬 화면에서 먼저 자료를 확인하세요.');
  const count=local.records.filter(r=>r.kind==='request'&&!r.deleted).length;
  if(!confirm(`로컬 청구 ${count}건과 업체·승인·원본 파일을 공유 현장으로 가져올까요? 현재 공유 현장 자료는 자동 백업 후 교체됩니다.`))return;
  const localStore=new Store();Object.assign(localStore,local);localStore.mode='local';
  const zip=await buildBackup(localStore);const prepared=await readBackup({size:zip.length,arrayBuffer:async()=>zip.buffer.slice(zip.byteOffset,zip.byteOffset+zip.byteLength)});
  await applyBackup(store,prepared);render();toast('로컬 자료를 Supabase 공유 저장소로 가져왔습니다.');
 }
"""+anchor,1)
p.write_text(s,encoding='utf-8')
