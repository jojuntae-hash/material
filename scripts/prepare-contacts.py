from pathlib import Path
import openpyxl,json,re,hashlib
root=Path(__file__).resolve().parents[1];out=root/'private-data'
src=Path(r'C:\Users\Runner\Desktop\프로그램\자재신청내역\4.원자재,대리점 목록.xlsx')
w=openpyxl.load_workbook(src,data_only=True); seed=json.loads((out/'seed.json').read_text(encoding='utf-8'))
vendors={r['data']['name']:r['id'] for r in seed['records'] if r['kind']=='vendor' and not r.get('deleted')}
def text(v):return '' if v is None else str(v).strip()
def phone(v):
 s=text(v)
 return s if re.fullmatch(r'[+\d\s().-]+',s) and len(re.sub(r'\D','',s))>=7 else ''
def stable(key):
 s=hashlib.sha256(('contacts-v2/'+key).encode()).hexdigest()
 return s[:8]+'-'+s[8:12]+'-4'+s[13:16]+'-a'+s[17:20]+'-'+s[20:32]
contacts=[];pending=[]
for title in ['기계(연락처)','소방(연락처)']:
 for n,r in enumerate(w[title].values,1):
  if n<4 or not r[1]:continue
  item,maker,dealer,raw_phone,raw_fax=map(text,r[1:6]);p=phone(raw_phone)
  if not maker or not dealer or not p:
   pending.append({'sheet':title,'row':n,'item':item,'manufacturer':maker,'dealer':dealer,'rawPhone':raw_phone,'reason':'연락처 열에 업체명 기재: 승인 후보 형식' if raw_phone and not p else '대리점 또는 연락처 미정','original':list(r)});continue
  if maker not in vendors or dealer not in vendors:raise ValueError('목록 업체 누락: '+maker+'/'+dealer)
  extras=[text(v) for v in r[6:] if v is not None];fax=phone(raw_fax);person='' if fax else raw_fax
  emails=list(dict.fromkeys(re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', ' '.join(extras))))
  note_parts=[v for v in extras if v not in emails]
  if raw_fax and not fax:note_parts.insert(0,'원본 FAX 칸 담당자: '+raw_fax)
  phones=list(dict.fromkeys(re.findall(r'0\d{1,2}-\d{3,4}-\d{4}', ' '.join(extras))))
  names=[v for v in extras if re.search(r'사원|부장|사장|전무|상무',v)]
  parsed=[]
  for ph in phones:
   matching=next((v for v in names if ph in v),'')
   name=re.sub(r'\s*[-:]?\s*'+re.escape(ph),'',matching).strip(' -:') if matching else (names[0] if names and len(phones)==1 else '')
   parsed.append({'name':name,'phone':ph,'email':''})
  for em in emails:parsed.append({'name':'','phone':'','email':em})
  if person:parsed.append({'name':person,'phone':p,'email':''})
  contacts.append({'id':stable(title+'/'+str(n)),'trade':title.split('(')[0],'item':item,'manufacturerId':vendors[maker],'manufacturer':maker,'dealerId':vendors[dealer],'dealer':dealer,'phone':p,'fax':fax,'person':person,'emails':emails,'contacts':parsed,'note':' / '.join(note_parts),'source':{'file':src.name,'sheet':title,'row':n},'original':{'item':item,'manufacturer':maker,'dealer':dealer,'phone':raw_phone,'fax':raw_fax,'extra':extras}})
payload={'id':stable(hashlib.sha256(src.read_bytes()).hexdigest()+'/v2'),'contacts':contacts,'pending':pending,'filename':src.name}
(out/'contacts-v2.json').write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'contacts':len(contacts),'mechanical':sum(c['trade']=='기계' for c in contacts),'fire':sum(c['trade']=='소방' for c in contacts),'pending':len(pending),'fax_names_corrected':sum(bool(c['person']) for c in contacts),'emails':sum(len(c['emails']) for c in contacts)},ensure_ascii=False))
