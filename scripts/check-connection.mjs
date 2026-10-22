import fs from 'node:fs/promises';
const text=await fs.readFile('.env.local','utf8');const read=k=>text.split(/\r?\n/).find(l=>l.startsWith(k+'='))?.slice(k.length+1).trim();
const url=read('VITE_SUPABASE_URL'),key=read('VITE_SUPABASE_ANON_KEY');
for(const [name,path] of [['API','/rest/v1/'],['전용 테이블','/rest/v1/mm_projects?select=id&limit=1']]){
 try{const r=await fetch(url+path,{headers:{apikey:key}});const data=await r.json();console.log(name,JSON.stringify({status:r.status,code:data.code||'',message:data.message||'',tableReady:!data.code&&r.status===200}));}catch(e){console.log(name,e.message);}
}
