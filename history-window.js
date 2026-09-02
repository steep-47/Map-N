// Map-N history window v1.0.0
// Performance policy: persistent map memory may accumulate, but automatic text re-scans only inspect a recent chat window.
const DEFAULT_LIMIT=200;
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function limit(){
  const n=Number(globalThis.MapNHistoryScanLimit);
  return Number.isFinite(n)&&n>=20?Math.floor(n):DEFAULT_LIMIT;
}
function slice(chat){
  const arr=Array.isArray(chat)?chat:[];
  const n=limit();
  return arr.length>n?arr.slice(-n):arr.slice();
}
function range(chat){
  const arr=Array.isArray(chat)?chat:[],n=limit(),start=Math.max(0,arr.length-n);
  return{start,end:arr.length,count:arr.length-start,total:arr.length,limited:start>0};
}

globalThis.MapNHistoryScanLimit=globalThis.MapNHistoryScanLimit||DEFAULT_LIMIT;
globalThis.MapNHistoryWindow={limit,slice,range};

async function install(){
  for(let i=0;i<160&&!window.MapNInstance;i++)await wait(25);
  const inst=window.MapNInstance;
  if(!inst||inst.__historyWindow100)return;
  inst.__historyWindow100=true;
  inst.historyScanLimit=limit();
  inst.scanChat=function(){
    const fresh=window.SillyTavern?.getContext?.();
    if(fresh)this.ctx=fresh;
    const chat=this.ctx?.chat||[],r=range(chat);
    for(let i=r.start;i<r.end;i++){
      const m=chat[i];
      if(m?.mes)this.process(String(m.mes),!!m.is_user);
    }
    this.__mapNLastHistoryScan=r;
    return r;
  };
  console.log(`[Map-N] history window v1.0.0 installed: recent ${limit()} floors`);
}
install();
export {limit,slice,range};
