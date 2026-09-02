// Map-N history window v1.0.1
// Performance policy: persistent map memory may accumulate, but automatic text re-scans only inspect a recent chat window.
const DEFAULT_LIMIT=200;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function limit(){const n=Number(globalThis.MapNHistoryScanLimit);return Number.isFinite(n)&&n>=20?Math.floor(n):DEFAULT_LIMIT;}
function slice(chat){const arr=Array.isArray(chat)?chat:[],n=limit();return arr.length>n?arr.slice(-n):arr.slice();}
function range(chat){const arr=Array.isArray(chat)?chat:[],n=limit(),start=Math.max(0,arr.length-n);return{start,end:arr.length,count:arr.length-start,total:arr.length,limited:start>0};}
function batch(inst,fn){const c=inst?.container,wasOpen=!!c?.classList?.contains('open');if(wasOpen)c.classList.remove('open');try{return fn();}finally{if(wasOpen){c.classList.add('open');inst.render?.();}}}
globalThis.MapNHistoryScanLimit=globalThis.MapNHistoryScanLimit||DEFAULT_LIMIT;
globalThis.MapNHistoryWindow={limit,slice,range,batch};
async function install(){for(let i=0;i<160&&!window.MapNInstance;i++)await wait(25);const inst=window.MapNInstance;if(!inst||inst.__historyWindow101)return;inst.__historyWindow101=true;inst.historyScanLimit=limit();inst.scanChat=function(){const fresh=window.SillyTavern?.getContext?.();if(fresh)this.ctx=fresh;const chat=this.ctx?.chat||[],r=range(chat);batch(this,()=>{for(let i=r.start;i<r.end;i++){const m=chat[i];if(m?.mes)this.process(String(m.mes),!!m.is_user);}});this.__mapNLastHistoryScan=r;return r;};console.log(`[Map-N] history window v1.0.1 installed: recent ${limit()} floors`);}
install();
export {limit,slice,range,batch};
