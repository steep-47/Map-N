// Map-N rollback addon v1.0.0
// Additive only: does not replace Map-N parsing, hierarchy, UI, refresh, or live message handlers.
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const KEY='map_n_snapshot_v1',ROOT='世界舆图';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function context(i){return i?.ctx||globalThis.SillyTavern?.getContext?.()||null}
function chat(i){return context(i)?.chat||[]}
function sid(m){const n=Number(m?.swipe_id);return Number.isInteger(n)&&n>=0?n:null}
function extra(m,create=false){if(!m)return null;const n=sid(m);if(!m.is_user&&n!==null){if(!Array.isArray(m.swipe_info)){if(!create)return null;m.swipe_info=[]}if(create){m.swipe_info[n]||={};m.swipe_info[n].extra||={}}return m.swipe_info[n]?.extra||null}if(create)m.extra||={};return m.extra||null}
function take(i){return{discovered:[...(i.discovered||[])],encountered:[...(i.encountered||[])],currentPos:i.currentPos||null,currentChars:clone(i.currentChars||[]),learnedLocations:clone(i.__mapNSceneStore?.learnedLocations||{})}}
function put(i,m){const e=extra(m,true);if(e)e[KEY]=take(i)}
function get(m){const s=extra(m)?.[KEY];return s?clone(s):null}
function rebuildGraph(i){const wanted=i.currentPos;if(Array.isArray(i.entries))i.build(i.entries);if(wanted&&i.nodeMap?.[wanted]?.type==='location')i.currentPos=wanted}
function restore(i,s){if(!s)return false;i.discovered=new Set(s.discovered||[ROOT]);i.discovered.add(ROOT);i.encountered=new Set(s.encountered||[]);i.currentChars=clone(s.currentChars||[]);i.currentPos=s.currentPos||null;if(i.__mapNSceneStore){i.__mapNSceneStore.learnedLocations=clone(s.learnedLocations||{})}rebuildGraph(i);i.save?.();i.render?.();return true}
function before(i,n){const a=chat(i);for(let x=Math.min(n-1,a.length-1);x>=0;x--){const s=get(a[x]);if(s)return{x,s}}return null}
function indexOf(i,p){const a=chat(i);for(const v of[p?.messageId,p?.mesId,p?.index,p]){const n=Number(v);if(Number.isInteger(n)&&n>=0&&n<a.length)return n}return a.length-1}
function later(fn){return p=>setTimeout(()=>{try{fn(p)}catch(e){console.error('[Map-N rollback]',e)}},20)}
function replay(i,start){const a=chat(i),base=before(i,start);if(base)restore(i,base.s);else{const keepPath=Array.isArray(i.path)?[...i.path]:[ROOT];i.discovered=new Set([ROOT]);i.encountered=new Set();i.currentPos=null;i.currentChars=[];if(i.__mapNSceneStore)i.__mapNSceneStore.learnedLocations={};rebuildGraph(i);i.path=keepPath}for(let n=base?base.x+1:0;n<a.length;n++){const m=a[n];if(!m?.mes)continue;i.process(String(m.mes),!!m.is_user);put(i,m)}i.render?.()}
async function install(){for(let n=0;n<200&&!window.MapNInstance;n++)await wait(50);const i=window.MapNInstance;if(!i||i.__rollbackAddon100)return;for(let n=0;n<200&&!(i.__sceneScanner204&&i.__presence202);n++)await wait(25);i.__rollbackAddon100=true;const c=context(i),es=c?.eventSource,et=c?.eventTypes||c?.event_types;if(!es||!et)return;
for(const k of['MESSAGE_RECEIVED','MESSAGE_SENT'])if(et[k])es.on(et[k],later(p=>{const n=indexOf(i,p),m=chat(i)[n];if(m)put(i,m)}));
if(et.MESSAGE_SWIPED)es.on(et.MESSAGE_SWIPED,later(p=>{const n=indexOf(i,p),m=chat(i)[n],s=get(m);if(s)restore(i,s);else replay(i,n)}));
if(et.MESSAGE_UPDATED)es.on(et.MESSAGE_UPDATED,later(p=>replay(i,Math.max(0,indexOf(i,p)))));
if(et.MESSAGE_DELETED)es.on(et.MESSAGE_DELETED,later(()=>{const a=chat(i),b=before(i,a.length);if(b)restore(i,b.s);else replay(i,0)}));
for(const k of['CHAT_CHANGED','CHARACTER_SELECTED'])if(et[k])es.on(et[k],later(()=>setTimeout(()=>{const a=chat(i),s=get(a.at(-1));if(s)restore(i,s)},100)));
const a=chat(i);if(a.length&&!get(a.at(-1)))put(i,a.at(-1));console.log('[Map-N] rollback addon v1.0.0 installed');}
install();
