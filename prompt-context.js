// Map-N prompt context v1.1.0
// Register compact geographic memory through SillyTavern's extension-prompt pipeline so it is token-budgeted.
// The prompt only exists during a normal story generation and is cleared afterwards, keeping Memo-N record-only calls clean.
const ROOT='世界舆图',KEY='map-n-geography',POSITION_IN_PROMPT=0,POSITION_NONE=-1,ROLE_SYSTEM=0,wait=ms=>new Promise(r=>setTimeout(r,ms));
const uniq=a=>[...new Set((a||[]).map(x=>String(x||'').trim()).filter(Boolean))];

function pathText(inst,id){
 if(!id)return'';const ids=inst.pathTo?.(id)||[];
 return uniq(ids.filter(x=>x&&x!==ROOT).map(x=>inst.displayName?.(x)||String(x).split('／').at(-1)).filter(Boolean)).join('／');
}
function latestUserText(inst){const chat=inst.ctx?.chat||[];for(let n=chat.length-1;n>=0;n--)if(chat[n]?.is_user===true)return String(chat[n]?.mes||'');return'';}
function sourceIndex(rec){let best=-1;for(const x of [...(rec?.sources||[]),...(rec?.evidence||[]).map(e=>e?.source)]){const n=Number(String(x||'').split(':',1)[0]);if(Number.isInteger(n))best=Math.max(best,n);}return best;}
function recentScenePaths(inst,limit=5){
 const rows=Object.values(inst.__mapNSceneStore?.learnedLocations||{}).map(r=>({id:String(r?.id||''),idx:sourceIndex(r),depth:String(r?.id||'').split('／').length})).filter(x=>x.id);
 rows.sort((a,b)=>b.idx-a.idx||b.depth-a.depth);const out=[];
 for(const row of rows){if(out.some(x=>x===row.id||x.startsWith(row.id+'／')))continue;out.push(row.id);if(out.length>=limit)break;}return out;
}
function mentionedPaths(inst,text,limit=4){const ids=inst.resolveMentions?.(String(text||''),'location')||[],out=[];for(const id of ids){const p=pathText(inst,id)||String(id);if(p&&!out.includes(p))out.push(p);if(out.length>=limit)break;}return out;}
function buildContext(inst){
 const current=pathText(inst,inst.currentPos),recent=recentScenePaths(inst).map(id=>pathText(inst,id)||id).filter(Boolean),mentioned=mentionedPaths(inst,latestUserText(inst));
 const seen=new Set(),take=list=>list.filter(x=>{if(!x||seen.has(x))return false;seen.add(x);return true;});
 const cur=current?[current]:[],rec=take(recent),men=take(mentioned);if(!cur.length&&!rec.length&&!men.length)return'';
 const out=['[Map-N地理记忆]'];if(cur.length)out.push('当前位置：'+cur[0]);
 if(rec.length){out.push('近期已确认地点：');for(const x of rec)out.push('- '+x);}
 if(men.length){out.push('本轮提及的已知地点：');for(const x of men)out.push('- '+x);}
 out.push('以上仅表示已确认的地理事实。既有归属、上下级与路径关系不得因后来出现的新地名静默改写；未确认的归属保持未知。目的地、谈及地点不等于当前位置，也不自动成为当前地点的所属区域。');
 out.push('[/Map-N地理记忆]');return out.join('\n');
}
function setPrompt(inst,value){const ctx=window.SillyTavern?.getContext?.()||inst.ctx;inst.ctx=ctx||inst.ctx;const fn=ctx?.setExtensionPrompt;if(typeof fn!=='function')return false;fn(KEY,value||'',value?POSITION_IN_PROMPT:POSITION_NONE,0,false,ROLE_SYSTEM);return true;}
function refresh(inst){const value=buildContext(inst);setPrompt(inst,value);return value;}
function clear(inst){setPrompt(inst,'');}
async function install(){
 for(let n=0;n<180&&!window.MapNInstance;n++)await wait(50);const inst=window.MapNInstance;if(!inst||inst.__promptContext110)return;inst.__promptContext110=true;
 const es=inst.ctx?.eventSource,et=inst.ctx?.eventTypes||inst.ctx?.event_types;if(!es||!et?.GENERATION_STARTED){console.warn('[Map-N] 无法安装地理记忆注入：缺少生成事件');return;}
 clear(inst);
 es.on(et.GENERATION_STARTED,(type,_params,isDryRun)=>{if(isDryRun||type==='quiet'||type==='impersonate'){clear(inst);return;}try{refresh(inst)}catch(e){console.warn('[Map-N] 地理记忆准备失败',e);clear(inst);}});
 const cleanup=()=>clear(inst);if(et.GENERATION_ENDED)es.on(et.GENERATION_ENDED,cleanup);if(et.GENERATION_STOPPED)es.on(et.GENERATION_STOPPED,cleanup);if(et.CHAT_CHANGED)es.on(et.CHAT_CHANGED,cleanup);if(et.CHARACTER_SELECTED)es.on(et.CHARACTER_SELECTED,cleanup);
 globalThis.MapNPromptContext={build:()=>buildContext(inst),refresh:()=>refresh(inst),clear:()=>clear(inst)};
 console.log('[Map-N] prompt context v1.1.0 installed');
}
install();
export {buildContext};
