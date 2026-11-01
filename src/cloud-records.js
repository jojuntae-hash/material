import {loadCloudPages} from './cloud-pages.js';

// Use the existing (project_id, kind) index and cap concurrent queries at three.
export async function loadCloudRecords(client,projectId){
 const kinds=['request','vendor','approval','alias','file','batch'];
 const groups=new Array(kinds.length);let next=0,failed=false;
 async function worker(){
  while(next<kinds.length&&!failed){
   const index=next++,kind=kinds[index];
   try{
    groups[index]=await loadCloudPages(({limit,last})=>{
     let query=client.from('mm_records').select('*').eq('project_id',projectId).eq('kind',kind).order('id').limit(limit);
     if(last)query=query.gt('id',last.id);
     return query;
    },{pageSize:kind==='batch'?50:500});
   }catch(error){failed=true;throw error;}
  }
 }
 await Promise.all(Array.from({length:3},worker));
 return groups.flat().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}
