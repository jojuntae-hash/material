from pathlib import Path
import openpyxl,json,datetime,uuid,shutil
root=Path(__file__).resolve().parents[1]; out=root/'private-data';out.mkdir(exist_ok=True)
src=Path(r'C:\Users\Runner\Desktop\프로그램\자재신청내역')
files=['1.자재청구내역.xlsx','2.전체 자재청구내역_1016.xlsx','3.추가 참고자료.xlsx','4.원자재,대리점 목록.xlsx']
def uid(k):return str(uuid.uuid5(uuid.NAMESPACE_URL,'material-paju/'+k))
def text(v):return '' if v is None else str(v).strip()
def date(v):return v.date().isoformat() if isinstance(v,datetime.datetime) else text(v)
records=[];companies={}
def company(name,role,trade):
 name=text(name)
 if not name:return ''
 if name not in companies:companies[name]={'id':uid('vendor/'+name),'name':name,'roles':[],'trades':[],'items':[],'phone':'','fax':'','email':'','person':'','mobile':'','note':''}
 c=companies[name]
 if role not in c['roles']:c['roles'].append(role)
 if trade not in c['trades']:c['trades'].append(trade)
 return c['id']
w=openpyxl.load_workbook(src/files[3],data_only=True)
approvals=[]
for s in w.worksheets[:2]:
 for n,r in enumerate(s.values,1):
  if not isinstance(r[0],(int,float)) or not r[1]:continue
  opts=[]
  for j in range(2,6 if s.title=='소방' else 5):
   if r[j]:opts.append({'slot':chr(65+j-2),'vendorId':company(r[j],'원자재',s.title),'name':text(r[j])})
  approvals.append({'id':uid('approval/'+s.title+'/'+str(n)),'trade':s.title,'name':text(r[1]),'options':opts,'note':text(r[6] if s.title=='소방' else r[5]),'effectiveDate':'','source':{'file':files[3],'sheet':s.title,'row':n},'original':{'name':text(r[1]),'options':opts},'revision':1})
for s in w.worksheets[2:]:
 trade='기계' if s.title.startswith('기계') else '소방'
 for n,r in enumerate(s.values,1):
  if n<4 or not r[1] or not r[2]:continue
  manufacturer=company(r[2],'원자재',trade); dealer=company(r[3],'대리점',trade)
  if not dealer:continue
  c=companies[text(r[3])]
  if text(r[1]) not in c['items']:c['items'].append(text(r[1]))
  if r[4] and not c['phone']:c['phone']=text(r[4])
  if r[5] and not c['fax']:c['fax']=text(r[5])
  for extra in r[6:]:
   if extra and text(extra) not in c['note']:c['note']+=' '+text(extra)
  c.setdefault('supplies',[]).append({'manufacturerId':manufacturer,'item':text(r[1]),'trade':trade})
for c in companies.values():records.append({'id':c.pop('id'),'kind':'vendor','data':c,'version':1})
for a in approvals:records.append({'id':a.pop('id'),'kind':'approval','data':a,'version':1})
w=openpyxl.load_workbook(src/files[1],data_only=True)
for n,r in enumerate(w.worksheets[0].values,1):
 if n==1 or not r[2]:continue
 data={'trade':r[0],'date':date(r[1]),'name':text(r[2]),'spec':text(r[3]),'unit':text(r[4]),'quantity':r[5],'manufacturerId':'','dealerId':'','location':'','applicant':'','note':text(r[6]),'approvalId':'','source':{'file':files[1],'sheet':w.worksheets[0].title,'row':n},'original':{'trade':r[0],'date':date(r[1]),'name':text(r[2]),'spec':text(r[3]),'unit':text(r[4]),'quantity':r[5],'note':text(r[6])}}
 if r[5] is None:data['quantityUnconfirmed']=True
 if isinstance(r[5],(int,float)) and r[5]<0:data['quantityOriginalAdjustment']=True
 note=text(r[6]).split(' / [')[0].strip()
 parts=[part.strip() for part in note.split('/')]
 if len(parts)==2:
  raw_m,raw_d=parts;raw_d='세종넷피아' if raw_d=='세종' else raw_d
  if raw_m in companies and raw_d in companies and '원자재' in companies[raw_m]['roles'] and '대리점' in companies[raw_d]['roles']:
   data['manufacturerId']=uid('vendor/'+raw_m);data['dealerId']=uid('vendor/'+raw_d);data['vendorMappingSource']='등록 업체 및 사용자 지정 별칭 일치'
 records.append({'id':uid('request/'+str(n)),'kind':'request','data':data,'version':1})
for n,role,alias in [('세종넷피아','대리점','세종')]:
 if n in companies:records.append({'id':uid('alias/'+alias),'kind':'alias','version':1,'data':{'alias':alias,'vendorId':companies[n].get('id',uid('vendor/'+n)),'role':role,'note':'사용자 지정: 에스제이/세종'}})
for i,name in enumerate(files,1):shutil.copy2(src/name,out/f'original-{i}.xlsx')
(out/'seed.json').write_text(json.dumps({'records':records,'files':files,'projectName':'파주 콘텐츠시티','counts':{'request':1983,'mechanical':957,'fire':1026}},ensure_ascii=False,default=str),encoding='utf-8')
print('Reference data extracted:',len(records),'records; originals stored in ignored private-data only')
