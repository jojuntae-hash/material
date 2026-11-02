export function withTradeNumbers(d){
 const next={...d},legacy=String(d.number||'').trim(),trades=new Set((d.rows||[]).map(r=>r.trade).filter(Boolean));
 for(const [trade,field] of [['기계','mechanicalNumber'],['소방','fireNumber']]){
  if(typeof next[field]==='string')continue;
  const matching=legacy.includes(trade)&&!legacy.includes(trade==='기계'?'소방':'기계');
  const sole=trades.size===1&&trades.has(trade)&&!/[기계소방]/.test(legacy);
  next[field]=matching||sole?legacy:`${d.project||'파주 콘텐츠시티'} 현장 - ${trade} - `;
 }
 return next;
}
export function tradeRequestNumber(d,trade){const n=withTradeNumbers(d);return String(trade==='기계'?n.mechanicalNumber:n.fireNumber).trim();}
export function requestFilename(d,trade){
 const number=tradeRequestNumber(d,trade),match=number.match(/(\d+)\s*$/);
 if(!match)throw Error(`${trade} 청구번호 끝에 번호를 입력하세요. (예: ${trade} - 049)`);
 const clean=v=>String(v).replace(/[<>:"/\\|?*\x00-\x1f]/g,'').replace(/\s+/g,'').replace(/[. ]+$/g,'');
 const project=clean(d.project||'파주 콘텐츠시티').replace(/현장$/,'');
 return `${d.date.slice(5,7)}${d.date.slice(8,10)}_${trade}_${match[1]}_자재청구서-${project||'현장'}.xlsx`;
}
