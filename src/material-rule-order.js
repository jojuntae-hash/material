export function sortMaterialRules(rules,field='alias1',direction='asc'){
 const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'}),value=r=>String(field==='alias1'?r.aliases[0]||'':field==='alias2'?r.aliases[1]||'':r[field]||'').trim();
 return rules.map((rule,index)=>({rule,index})).sort((a,b)=>{
  const x=value(a.rule),y=value(b.rule);if(!x||!y)return !x&&!y?a.index-b.index:!x?1:-1;
  return collator.compare(x,y)*(direction==='desc'?-1:1)||a.index-b.index;
 }).map(r=>r.rule);
}
export function moveMaterialRule(rules,id,step,visibleIds=rules.map(r=>r.id)){
 const result=[...rules],i=visibleIds.indexOf(id),neighbor=visibleIds[i+step];if(i<0||!neighbor)return result;
 const from=result.findIndex(r=>r.id===id),to=result.findIndex(r=>r.id===neighbor);if(from<0||to<0)return result;
 [result[from],result[to]]=[result[to],result[from]];return result;
}
