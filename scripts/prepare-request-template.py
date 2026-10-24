import zipfile,re,sys,xml.etree.ElementTree as E
from pathlib import Path
n={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(sys.argv[1]) as z:
 files={k:z.read(k) for k in z.namelist()}
 ss=[''.join(x.itertext()) for x in E.fromstring(files['xl/sharedStrings.xml'])]
 def clean(m):
  tag=m.group();ref=re.search(r'r="([A-Z]+)(\d+)"',tag);col,row=ref[1],int(ref[2]);style=re.search(r' s="[^"]*"',tag);s=style[0] if style else ''
  if row>=12 or ref[1]+ref[2] in ['H5','H6','P5','P6','S6','Q2','S2','T2']:return f'<c r="{ref[1]}{row}"{s}/>'
  if 't="s"' in tag:
   idx=re.search(r'<v>(\d+)</v>',tag)
   if idx:
    from xml.sax.saxutils import escape
    return f'<c r="{col}{row}"{s} t="inlineStr"><is><t>{escape(ss[int(idx[1])])}</t></is></c>'
  return tag
 xml=files['xl/worksheets/sheet2.xml'].decode()
 xml=re.sub(r'<c\b[^>]*?(?:/>|>.*?</c>)',clean,xml)
 xml=re.sub(r'<drawing\b[^>]*/>','',xml)
 xml=re.sub(r'<mergeCell ref="(?:U14:U15|V52:W52)"/>','',xml)
 xml=re.sub(r'<mergeCells count="\d+"',lambda m:f'<mergeCells count="{len(re.findall(r"<mergeCell ",xml))}"',xml)
 files['xl/worksheets/sheet2.xml']=xml.encode()
 wb=files['xl/workbook.xml'].decode();wb=re.sub(r'<sheet [^>]*state="hidden"[^>]*/>','',wb);wb=re.sub(r'<definedName [^>]*localSheetId="0".*?</definedName>','',wb);wb=wb.replace('localSheetId="1"','localSheetId="0"').replace('activeTab="1"','activeTab="0"').replace('firstSheet="1"','firstSheet="0"');files['xl/workbook.xml']=wb.encode()
 files['xl/worksheets/sheet1.xml']=xml.encode()
 files['xl/sharedStrings.xml']=b'<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"/>'
 # Example product pictures and workbook metadata must not ship with the blank form.
 for k in list(files):
  if k.startswith(('xl/media/','xl/drawings/')):del files[k]
  elif k.endswith('.rels'):
   files[k]=re.sub(r'<Relationship\b[^>]*Type="[^"]*/drawing"[^>]*/>','',files[k].decode()).encode()
 files['[Content_Types].xml']=re.sub(r'<Override\b[^>]*PartName="/xl/drawings/[^>]*?/>','',files['[Content_Types].xml'].decode()).encode()
 files['xl/workbook.xml']=re.sub(r'<mc:AlternateContent[\s\S]*?</mc:AlternateContent>','',files['xl/workbook.xml'].decode()).encode()
 files['docProps/core.xml']=b'<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"/>'
 files['docProps/app.xml']=b'<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Material Desk</Application></Properties>'
 with zipfile.ZipFile('public/templates/request.xlsx','w',zipfile.ZIP_DEFLATED) as out:
  for k,v in files.items():out.writestr(k,v)
