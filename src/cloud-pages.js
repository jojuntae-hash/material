export const isQueryTimeout=error=>error?.code==='57014'||/statement timeout/i.test(error?.message||'');

// Retry only the failed page, keeping completed pages and their cursor.
export async function loadCloudPages(fetchPage,{pageSize=200,maxRows=Infinity}={}){
 const rows=[];let size=pageSize;
 while(rows.length<maxRows){
  const limit=Math.min(size,maxRows-rows.length);
  const {data,error}=await fetchPage({offset:rows.length,limit,last:rows.at(-1)});
  if(error){
   if(isQueryTimeout(error)&&size>25){size=Math.max(25,Math.floor(size/2));continue;}
   throw error;
  }
  if(!Array.isArray(data))throw Error('서버 응답을 확인할 수 없습니다. 다시 불러와 주세요.');
  rows.push(...data);
  if(data.length<limit)break;
 }
 return rows;
}
