// Map-N message state v1.0.0
// SillyTavern owns the timeline. Map-N only snapshots/restores its already-derived state.
const wait=ms=>new Promise(r=>setTimeout(r,ms)),ROOT='世界舆图',KEY='map_n_state',VERSION=1;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function ctx(i){return i?.ctx||globalThis.SillyTavern?.getContext?.()||null}
function chat(i){return ctx(i)?.chat||[]}
function swipeId(m){const n=Number(m?.swipe_id);return Number.isInteger(n)&&n>=0?n:null}
function slot(m,create=false){if(!m||typeof m!=='object')return null;const sid=swipeId(m);if(!m.is_user&&sid!==null&&Array.isArray(m.swipe_info)){if(create){m.swipe_info[sid]||={};m.swipe_info[sid].extra||={};}return m.swipe_info[sid]?.extra||null}if(create)m.extra||={};return m.extra||null}
function snapshot(i){return{version:VERSION,discovered:[...(i.discovered||[])],encountered:[...(i.encountered||[])],currentPos:i.currentPos||null,currentChars:clone(i.currentChars||[]),learnedLocations:clone(i.__mapNSceneStore?.learnedLocations||{})}}
function write(i,m){const s=slot(m,true);if(!s)return false;s[KEY]=snapshot(i);return true}
function read(m){const s=slot(m,false)?.[KEY];return s&&s.version===VERSION?clone(s):null}
function apply(i,state){if(!state)return false;i.discovered=new Set(state.discovered||[ROOT]);i.discovered.add(ROOT);i.encountered=new Set(state.encountered||[]);i.currentPos=state.currentPos||null;i.currentChars=clone(state.currentChars||[]);if(i.__mapNSceneStore){i.__mapNSceneStore.learnedLocations=clone(state.learnedLocations||{});i.__mapNSceneStore.version=i.__mapNSceneStore.version||5;}if(Array.isArray(i.entries))i.build(i.entries);else globalThis.MapNSceneScanner?.mergeAll?.(i);if(i.currentPos)i.path=i.pathTo(i.currentPos);else if(!Array.isArray(i.path)||!i.path.length)i.path=[ROOT];i.save?.();i.render?.();return true}
function previousState(i,beforeIndex){const a=chat(i);for(let n=Math.min(beforeIndex-1,a.length-1);n>=0;n--){const s=read(a[n]);if(s)return{index:n,state:s}}return null}
function currentIndex(i,payload){const a=chat(i);const n=Number(payload);if(Number.isInteger(n)&&n>=0&&n<a.length)return n;return a.length-1}
async function saveChat(i){try{const r=ctx(i)?.saveChat?.();if(r?.catch)await r}catch(e){console.warn('[Map-N state] 保存聊天失败',e)}}
async function commit(i,index){const m=chat(i)[index];if(!m)return false;write(i,m);await saveChat(i);return true}
async function rebuildFrom(i,start){const a=chat(i);const base=previousState(i,start);if(base)apply(i,base.state);else{if(i.__mapNSceneStore)i.__mapNSceneStore.learnedLocations={};i.discovered=new Set([ROOT]);i.encountered=new Set();i.currentPos=null;i.currentChars=[];if(Array.isArray(i.entries))i.build(i.entries)}for(let n=base?base.index+1:0;n<a.length;n++){const m=a[n];if(!m?.mes)continue;i.process(String(m.mes),!!m.is_user);write(i,m)}await saveChat(i);i.render?.()}
async function install(){for(let n=0;n<160&&!window.MapNInstance;n++)await wait(50);const i=window.MapNInstance;if(!i||i.__messageState100)return;i.__messageState100=true;const c=ctx(i),es=c?.eventSource,et=c?.eventTypes||c?.event_types;if(!es||!et)return;
// Observe after Map-N's existing handlers. We never replace process/build/scene parsing.
const after=fn=>(payload)=>queueMicrotask(()=>Promise.resolve(fn(payload)).catch(e=>console.error('[Map-N state]',e)));
for(const k of ['MESSAGE_RECEIVED','MESSAGE_SENT'])if(et[k])es.on(et[k],after(async p=>{const n=currentIndex(i,p);if(n>=0)await commit(i,n)}));
if(et.MESSAGE_SWIPED)es.on(et.MESSAGE_SWIPED,after(async p=>{const n=currentIndex(i,p),m=chat(i)[n];const s=read(m);if(s)apply(i,s);else await rebuildFrom(i,n)}));
if(et.MESSAGE_UPDATED)es.on(et.MESSAGE_UPDATED,after(async p=>{const n=currentIndex(i,p);await rebuildFrom(i,n)}));
if(et.MESSAGE_DELETED)es.on(et.MESSAGE_DELETED,after(async()=>{const a=chat(i);const found=previousState(i,a.length);if(found)apply(i,found.state);else await rebuildFrom(i,0)}));
for(const k of ['CHAT_CHANGED','CHARACTER_SELECTED'])if(et[k])es.on(et[k],after(async()=>{await wait(50);const a=chat(i);const found=previousState(i,a.length);if(found)apply(i,found.state)}));
// Seed only the current state. Existing chats remain compatible; no history is rewritten until needed.
const a=chat(i);if(a.length&&!read(a.at(-1)))await commit(i,a.length-1);console.log('[Map-N] message state v1.0.0 installed');}
install();
