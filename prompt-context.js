// Map-N prompt context v1.0.0
// Feed only compact, already-confirmed geographic memory back into the main story prompt.
// Never inject the full map and never participate in Memo-N record-only requests.
const ROOT='世界舆图',MARK='[Map-N地理记忆]',wait=ms=>new Promise(r=>setTimeout(r,ms));
const uniq=a=>[...new Set((a||[]).map(x=>String(x||'').trim()).filter(Boolean))];

function pathText(inst,id){
  if(!id)return'';
  const ids=inst.pathTo?.(id)||[];
  const names=ids.filter(x=>x&&x!==ROOT).map(x=>inst.displayName?.(x)||String(x).split('／').at(-1)).filter(Boolean);
  return uniq(names).join('／');
}
function latestUserText(inst){
  const chat=inst.ctx?.chat||[];
  for(let n=chat.length-1;n>=0;n--)if(chat[n]?.is_user===true)return String(chat[n]?.mes||'');
  return'';
}
function sourceIndex(rec){
  let best=-1;
  for(const x of [...(rec?.sources||[]),...(rec?.evidence||[]).map(e=>e?.source)]){
    const n=Number(String(x||'').split(':',1)[0]);if(Number.isInteger(n))best=Math.max(best,n);
  }
  return best;
}
function recentScenePaths(inst,limit=5){
  const rows=Object.values(inst.__mapNSceneStore?.learnedLocations||{}).map(r=>({id:String(r?.id||''),idx:sourceIndex(r),depth:String(r?.id||'').split('／').length})).filter(x=>x.id);
  rows.sort((a,b)=>b.idx-a.idx||b.depth-a.depth);
  const out=[];
  for(const row of rows){
    if(out.some(x=>x===row.id||x.startsWith(row.id+'／')))continue;
    out.push(row.id);if(out.length>=limit)break;
  }
  return out;
}
function mentionedPaths(inst,text,limit=4){
  const ids=inst.resolveMentions?.(String(text||''),'location')||[],out=[];
  for(const id of ids){const p=pathText(inst,id)||String(id);if(p&&!out.includes(p))out.push(p);if(out.length>=limit)break;}
  return out;
}
function recordOnlyPrompt(chat){
  const text=(chat||[]).map(m=>typeof m?.content==='string'?m.content:'').join('\n');
  return text.includes('Memo独立表格记录器')||text.includes('# Memo独立记录操作协议')||text.includes('[Memo-N唯一输出格式v2]')||text.includes('Memo世界状态表格整理器');
}
function buildContext(inst){
  const current=pathText(inst,inst.currentPos),recent=recentScenePaths(inst).map(id=>pathText(inst,id)||id).filter(Boolean),mentioned=mentionedPaths(inst,latestUserText(inst));
  const seen=new Set(),take=list=>list.filter(x=>{if(!x||seen.has(x))return false;seen.add(x);return true;});
  const cur=current?[current]:[],rec=take(recent),men=take(mentioned);
  if(!cur.length&&!rec.length&&!men.length)return'';
  const out=[MARK];
  if(cur.length)out.push('当前位置：'+cur[0]);
  if(rec.length){out.push('近期已确认地点：');for(const x of rec)out.push('- '+x);}
  if(men.length){out.push('本轮提及的已知地点：');for(const x of men)out.push('- '+x);}
  out.push('以上仅表示已确认的地理事实。既有归属、上下级与路径关系不得因后来出现的新地名静默改写；未确认的归属保持未知。目的地、谈及地点不等于当前位置，也不自动成为当前地点的所属区域。');
  out.push('[/Map-N地理记忆]');
  return out.join('\n');
}
function inject(inst,eventData){
  const chat=eventData?.chat;if(!Array.isArray(chat)||!chat.length||recordOnlyPrompt(chat))return;
  if(chat.some(m=>typeof m?.content==='string'&&m.content.includes(MARK)))return;
  const content=buildContext(inst);if(!content)return;
  let at=chat.length;for(let n=chat.length-1;n>=0;n--)if(String(chat[n]?.role||'').toLowerCase()==='user'){at=n;break;}
  chat.splice(at,0,{role:'system',content});
}
async function install(){
  for(let n=0;n<180&&!window.MapNInstance;n++)await wait(50);
  const inst=window.MapNInstance;if(!inst||inst.__promptContext100)return;inst.__promptContext100=true;
  const es=inst.ctx?.eventSource,et=inst.ctx?.eventTypes||inst.ctx?.event_types;
  if(!es||!et?.CHAT_COMPLETION_PROMPT_READY){console.warn('[Map-N] 无法安装地理记忆注入：缺少CHAT_COMPLETION_PROMPT_READY');return;}
  const handler=data=>{try{inject(inst,data)}catch(e){console.warn('[Map-N] 地理记忆注入失败',e)}};
  es.on(et.CHAT_COMPLETION_PROMPT_READY,handler);es.makeLast?.(et.CHAT_COMPLETION_PROMPT_READY,handler);
  globalThis.MapNPromptContext={build:()=>buildContext(inst)};
  console.log('[Map-N] prompt context v1.0.0 installed');
}
install();
export {buildContext};
