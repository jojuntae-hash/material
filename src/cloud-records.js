import {loadCloudPages} from './cloud-pages.js';

// Use the existing (project_id, kind) index and cap concurrent queries at three.
export async function loadCloudRecords(client,projectId,{kinds=['request','vendor','approval','alias','file','batch'],requestsSince='',requestsBefore='',onGroup=()=>{}}={}){
 const groups=new Array(kinds.length);let next=0,failed=false;
 async function worker(){
  while(next<kinds.length&&!failed){
   const index=next++,kind=kinds[index];
   try{
    groups[index]=await loadCloudPages(({limit,last})=>{
     let query=client.from('mm_records').select('*').eq('project_id',projectId).eq('kind',kind).order('id').limit(limit);
     if(kind==='request'&&requestsSince)query=query.gte('data->>date',requestsSince);
     if(kind==='request'&&requestsBefore)query=query.or('data->>date.lt.'+requestsBefore+',data->>date.is.null');
     if(last)query=query.gt('id',last.id);
     return query;
    },{pageSize:kind==='batch'?50:500});
    onGroup(groups[index]);
   }catch(error){failed=true;throw error;}
  }
 }
 await Promise.all(Array.from({length:3},worker));
 return groups.flat().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}

export function recentRequestDate(now=new Date()){const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(now);const date=new Date(day+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-6);return date.toISOString().slice(0,10);}
export function mergeRecords(current,incoming){const rows=new Map(current.map(r=>[r.id,r]));for(const r of incoming){const old=rows.get(r.id);if(!old||(r.version||0)>=(old.version||0))rows.set(r.id,r);}return [...rows.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);}
