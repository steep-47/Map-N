// Map-N message state v1.1.1
// SillyTavern owns the timeline. This layer only snapshots/restores results from Map-N's existing derivation chain.
const wait=ms=>new Promise(r=>setTimeout(r,ms)),ROOT='世界舆图',KEY='map_n_state',VERSION=2,SCENE_VERSION=5;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function ctx(i){return i?.ctx||globalThis.SillyTavern?.getContext?.()||null}
function chat(i){return ctx(i)?.chat||[]}
function swipeId(m){const n=Number(m?.swipe_id);return Number.isInteger(n)&&n>=0?n:null}
function slot(m,create=false){if(!m||typeof m!=='object')return null;const sid=swipeId(m);if(!m.is_user&&sid!==null){if(create){if(!Array.isArray(m.swipe_info))m.swipe_info=[];m.swipe_info[sid]||={};m.swipe_info[sid].extra||={};}return m.swipe_info?.[sid]?.extra||null}if(create)m.extra||={};return m.extra||null}
function snapshot(i){return{version:VERSION,discovered:[...(i.discovered||[])],encountered:[...(i.encountered||[])],currentPos:i.currentPos||null,currentChars:clone(i.currentChars||[]),learnedLocations:clone(i.__mapNSceneStore?.learnedLocations||{})}}
function write(i,m){const s=slot(m,true);if(!s)return false;s[KEY]=snapshot(i);return true}
function read(m){const s=slot(m,false)?.[KEY];return s&&s.version===VERSION?clone(s):null}
function setLearned(i,learned){i.__mapNSceneStore={version:SCENE_VERSION,learnedLocations:clone(learned||{})}}
function clearRuntime(i){i.discovered=new Set([ROOT]);i.encountered=new Set();i.currentPos=null;i.currentChars=[];setLearned(i,{});if(Array.isArray(i.entries))i.build(i.entries);i.path=[ROOT]}
function apply(i,state){if(!state)return false;i.discovered=new Set(state.discovered||[ROOT]);i.discovered.add(ROOT);i.encountered=new Set(state.encountered||[]);i.currentPos=state.currentPos||null;i.currentChars=clone(state.currentChars||[]);setLearned(i,state.learnedLocations);if(Array.isArray(i.entries))i.build(i.entries);if(i.currentPos)i.path=i.pathTo(i.currentPos);else i.path=[ROOT];i.save?.();i.render?.();return true}
function prior(i,before){const a=chat(i);for(let n=Math.min(before-1,a.length-1);n>=0;n--){const s=read(a[n]);if(s)return{index:n,state:s}}return null}
function eventIndex(i,p){const a=chat(i);for(const v of [p?.messageId,p?.mesId,p?.index,p]){const n=Number(v);if(Number.isInteger(n)&&n>=0&&n<a.length)return n}return a.length-1}
async function persist(i){try{const r=ctx(i)?.saveChat?.();if(r?.then)await r}catch(e){console.warn('[Map-N state] chat save failed',e)}}
async function commit(i,n){const m=chat(i)[n];if(!m)return false;if(!write(i,m))return false;await persist(i);return true}
async function replay(i,start){const a=chat(i),base=prior(i,start);if(base)apply(i,base.state);else clearRuntime(i);const from=base?base.index+1:0;for(let n=from;n<a.length;n++){const m=a[n];if(!m?.mes)continue;i.process(String(m.mes),!!m.is_user);write(i,m)}await persist(i);i.render?.()}
async function restoreTail(i){const a=chat(i),found=prior(i,a.length);if(found)return apply(i,found.state);clearRuntime(i);i.save?.();i.render?.();return true}
async function install(){for(let n=0;n<160&&!window.MapNInstance;n++)await wait(50);const i=window.MapNInstance;if(!i||i.__messageState111)return;i.__messageState111=true;const c=ctx(i),es=c?.eventSource,et=c?.eventTypes||c?.event_types;if(!es||!et)return;
const after=fn=>(p)=>setTimeout(()=>Promise.resolve(fn(p)).catch(e=>console.error('[Map-N state]',e)),0);
for(const k of ['MESSAGE_RECEIVED','MESSAGE_SENT'])if(et[k])es.on(et[k],after(async p=>{const n=eventIndex(i,p);if(n>=0)await commit(i,n)}));
if(et.MESSAGE_SWIPED)es.on(et.MESSAGE_SWIPED,after(async p=>{const n=eventIndex(i,p),m=chat(i)[n],s=read(m);if(s)apply(i,s);else await replay(i,n)}));
if(et.MESSAGE_UPDATED)es.on(et.MESSAGE_UPDATED,after(async p=>{const n=eventIndex(i,p);await replay(i,Math.max(0,n))}));
if(et.MESSAGE_DELETED)es.on(et.MESSAGE_DELETED,after(async()=>restoreTail(i)));
for(const k of ['CHAT_CHANGED','CHARACTER_SELECTED'])if(et[k])es.on(et[k],after(async()=>{await wait(100);const a=chat(i),s=read(a.at(-1));if(s)apply(i,s)}));
await wait(150);const a=chat(i);if(a.length&&!read(a.at(-1)))await commit(i,a.length-1);console.log('[Map-N] message state v1.1.1 installed');}
install();
