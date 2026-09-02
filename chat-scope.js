// Map-N chat scope refresher v1.1.0
// Keep every chat file isolated: refresh SillyTavern context, switch storage scope, invalidate graph/runtime caches,
// then reload only the new chat's persisted main state. Worldbook is rebuilt by the pending prime() call.
const scopeWait=ms=>new Promise(r=>setTimeout(r,ms));
const ROOT='世界舆图';
function freshContext(){try{return window.SillyTavern?.getContext?.()||null}catch(e){console.warn('[Map-N] fresh context failed',e);return null}}
function currentChatIdentity(ctx){
  const chatId=ctx?.getCurrentChatId?.()||ctx?.chatId||null;
  if(chatId)return String(chatId);
  const owner=ctx?.groupId!=null?`group-${ctx.groupId}`:`char-${ctx?.characterId??'unknown'}`;
  const meta=ctx?.chatMetadata||{};
  const fallback=meta.chat_id||meta.chatId||meta.file_name||meta.filename||meta.name||'unsaved';
  return `${owner}:${fallback}`;
}
async function install(){
  for(let i=0;i<160&&!window.MapNInstance;i++)await scopeWait(50);
  const inst=window.MapNInstance;if(!inst||inst.__chatScope110)return;inst.__chatScope110=true;
  const base='mapN_memory_v120';
  inst.scopeKey=function(){const ctx=freshContext()||this.ctx;return `${base}:${currentChatIdentity(ctx)}`;};
  const refresh=()=>{const ctx=freshContext();if(ctx)inst.ctx=ctx;inst.memoryKey=inst.scopeKey();};
  const resetScopedRuntime=()=>{
    refresh();
    // Graph caches can contain scene-learned nodes from the previous chat. Clearing them forces prime()
    // to rebuild shared worldbook nodes and prevents an unchanged worldbook signature from skipping build().
    inst.root={id:ROOT,children:[],parent:null};
    inst.nodeMap={};inst.alias=new Map();inst.entries=[];inst.lastSig='';inst.__mapNHierarchyGraphSig=null;
    // Per-chat module caches must be reloaded from the NEW memoryKey, never carried across chat files.
    inst.__mapNSceneStore=null;inst.__mapNPresenceState=null;
    inst.__mapNSceneSaveDirty=false;inst.__mapNPresenceSaveDirty=false;inst.__mapNMainSaveDirty=false;
    // Re-read the new chat's persisted main map state after the scope is known.
    inst.path=[ROOT];inst.discovered=new Set([ROOT]);inst.encountered=new Set();inst.currentPos=null;inst.currentChars=[];
    inst.load?.();
  };
  refresh();
  const es=inst.ctx?.eventSource,et=inst.ctx?.eventTypes||inst.ctx?.event_types;
  if(es&&et){
    const onChange=()=>{
      // Registered after Map-N's original reset handler. This runs before its async prime().then(scanChat)
      // completes, so that pending work sees only the new chat's context and caches.
      resetScopedRuntime();
      setTimeout(()=>{refresh();},0);
    };
    if(et.CHAT_CHANGED)es.on(et.CHAT_CHANGED,onChange);
    if(et.CHARACTER_SELECTED)es.on(et.CHARACTER_SELECTED,onChange);
  }
  console.log('[Map-N] chat scope refresher v1.1.0 installed',inst.memoryKey);
}
install();
