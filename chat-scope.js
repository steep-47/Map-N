// Map-N chat scope refresher v1.0.0
// SillyTavern getContext() returns a snapshot object. When CHAT_CHANGED fires, the old snapshot can
// still hold the previous chat array even though getCurrentChatId() already points at the new file.
// Refresh the snapshot immediately so each chat file reads/writes only its own Map-N state.
const scopeWait=ms=>new Promise(r=>setTimeout(r,ms));
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
  const inst=window.MapNInstance;if(!inst||inst.__chatScope100)return;inst.__chatScope100=true;
  const base='mapN_memory_v120';
  inst.scopeKey=function(){const ctx=freshContext()||this.ctx;return `${base}:${currentChatIdentity(ctx)}`;};
  const refresh=()=>{const ctx=freshContext();if(ctx)inst.ctx=ctx;inst.memoryKey=inst.scopeKey();};
  refresh();
  const es=inst.ctx?.eventSource,et=inst.ctx?.eventTypes||inst.ctx?.event_types;
  if(es&&et){
    const onChange=()=>{
      // Run synchronously after Map-N's original reset handler has started but before its async prime().then(scanChat)
      // completes. Replacing inst.ctx here makes that pending scan consume the NEW chat array, not the old one.
      refresh();
      setTimeout(()=>{refresh();},0);
    };
    if(et.CHAT_CHANGED)es.on(et.CHAT_CHANGED,onChange);
    if(et.CHARACTER_SELECTED)es.on(et.CHARACTER_SELECTED,onChange);
  }
  console.log('[Map-N] chat scope refresher v1.0.0 installed',inst.memoryKey);
}
install();
