// Map-N timeline state v1.0.0
// SillyTavern chat + swipe is the only timeline. Map-N stores derived state on that timeline.
const ROOT='世界舆图';
const STATE_KEY='map_n_state';
const STATE_VERSION=1;
const DEFAULT_CHECKPOINT_INTERVAL=25;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const uniq=a=>[...new Set((a||[]).filter(Boolean))];

function hashString(value){
  const s=String(value||'');
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
}

function checkpointInterval(){
  const n=Number(globalThis.MapNCheckpointInterval);
  return Number.isFinite(n)&&n>=5?Math.floor(n):DEFAULT_CHECKPOINT_INTERVAL;
}

function refreshContext(inst){
  const fresh=window.SillyTavern?.getContext?.();
  if(fresh)inst.ctx=fresh;
  try{inst.memoryKey=inst.scopeKey()}catch{}
  return inst.ctx;
}

function currentSwipeExtra(message,create=false){
  if(!message||message.is_user)return null;
  const sid=Number(message.swipe_id);
  if(!Number.isInteger(sid)||sid<0||!Array.isArray(message.swipe_info)||!message.swipe_info[sid])return null;
  const info=message.swipe_info[sid];
  if(!info.extra&&create)info.extra={};
  return info.extra||null;
}

function readRecord(message){
  const swipe=currentSwipeExtra(message,false);
  return swipe?.[STATE_KEY]||message?.extra?.[STATE_KEY]||null;
}

function writeRecord(message,record){
  if(!message||message.is_user)return;
  if(!message.extra||typeof message.extra!=='object')message.extra={};
  message.extra[STATE_KEY]=clone(record);
  const swipe=currentSwipeExtra(message,true);
  if(swipe)swipe[STATE_KEY]=clone(record);
}

function removeRecords(message){
  if(!message)return;
  if(message.extra&&typeof message.extra==='object')delete message.extra[STATE_KEY];
  if(Array.isArray(message.swipe_info))for(const info of message.swipe_info){
    if(info?.extra&&typeof info.extra==='object')delete info.extra[STATE_KEY];
  }
}

function chatHashes(chat){
  const out=[];
  let chain='mapn-v1';
  for(let i=0;i<chat.length;i++){
    const m=chat[i]||{};
    const part=`${i}|${m.is_user?'u':'a'}|${Number(m.swipe_id??0)}|${String(m.mes||'')}`;
    chain=hashString(`${chain}\n${part}`);
    out.push(chain);
  }
  return out;
}

function learnedLocations(inst){
  return clone(inst.__mapNSceneStore?.learnedLocations||{});
}

function snapshot(inst){
  return {
    discovered:uniq([ROOT,...(inst.discovered instanceof Set?[...inst.discovered]:[])]),
    encountered:uniq(inst.encountered instanceof Set?[...inst.encountered]:[]),
    currentPos:inst.currentPos||null,
    currentChars:uniq(inst.currentChars||[]),
    learnedLocations:learnedLocations(inst),
  };
}

function emptySnapshot(){
  return {discovered:[ROOT],encountered:[],currentPos:null,currentChars:[],learnedLocations:{}};
}

function deltaBetween(before,after){
  const bd=new Set(before.discovered||[]),be=new Set(before.encountered||[]),learned={};
  for(const [id,rec] of Object.entries(after.learnedLocations||{})){
    if(JSON.stringify(before.learnedLocations?.[id]||null)!==JSON.stringify(rec))learned[id]=clone(rec);
  }
  return {
    discoveredAdded:(after.discovered||[]).filter(x=>!bd.has(x)),
    encounteredAdded:(after.encountered||[]).filter(x=>!be.has(x)),
    learnedUpserts:learned,
    currentPos:after.currentPos||null,
    currentChars:uniq(after.currentChars||[]),
  };
}

function applyDelta(base,record){
  const next=clone(base)||emptySnapshot();
  next.discovered=uniq([ROOT,...(next.discovered||[]),...(record.discoveredAdded||[])]);
  next.encountered=uniq([...(next.encountered||[]),...(record.encounteredAdded||[])]);
  next.learnedLocations={...(next.learnedLocations||{})};
  for(const [id,rec] of Object.entries(record.learnedUpserts||{}))next.learnedLocations[id]=clone(rec);
  next.currentPos=record.currentPos||null;
  next.currentChars=uniq(record.currentChars||[]);
  return next;
}

function recordState(record,base){
  if(!record||record.version!==STATE_VERSION)return null;
  if(record.kind==='checkpoint'&&record.snapshot)return clone(record.snapshot);
  if(record.kind==='delta')return applyDelta(base,record);
  return null;
}

function validBrowsePath(inst,path){
  return Array.isArray(path)&&path.length&&(!inst.validPath||inst.validPath(path));
}

function applySnapshot(inst,state,{preserveBrowse=true}={}){
  const s=clone(state)||emptySnapshot();
  const browse=preserveBrowse&&Array.isArray(inst.path)?[...inst.path]:[ROOT];
  inst.__mapNSceneStore={version:5,learnedLocations:clone(s.learnedLocations||{})};
  inst.__mapNPresenceState={version:3,current:uniq(s.currentChars||[]),lastLocation:s.currentPos||null};
  inst.discovered=new Set([ROOT]);
  inst.encountered=new Set(s.encountered||[]);
  inst.currentPos=null;
  inst.currentChars=[];
  try{if(Array.isArray(inst.entries))inst.build(inst.entries)}catch(e){console.warn('[Map-N timeline] runtime graph rebuild failed',e)}
  inst.discovered=new Set(uniq([ROOT,...(s.discovered||[])]));
  inst.encountered=new Set(s.encountered||[]);
  inst.currentPos=s.currentPos||null;
  inst.currentChars=uniq(s.currentChars||[]);
  if(validBrowsePath(inst,browse))inst.path=browse;
  else if(inst.currentPos&&inst.pathTo)inst.path=inst.pathTo(inst.currentPos);
  else inst.path=[ROOT];
  try{localStorage.setItem(`${inst.memoryKey}:scene-v2`,JSON.stringify(inst.__mapNSceneStore))}catch{}
  try{localStorage.setItem(`${inst.memoryKey}:presence-v1`,JSON.stringify(inst.__mapNPresenceState))}catch{}
  try{inst.save?.()}catch{}
}

function findLastAssistant(chat,limit=chat.length-1){
  for(let i=Math.min(limit,chat.length-1);i>=0;i--)if(chat[i]&&!chat[i].is_user)return i;
  return -1;
}

function assistantOrdinalAt(chat,index){
  let n=-1;
  for(let i=0;i<=index&&i<chat.length;i++)if(chat[i]&&!chat[i].is_user)n++;
  return n;
}

function findValidCheckpoint(chat,hashes,beforeIndex){
  for(let i=Math.min(beforeIndex,chat.length-1);i>=0;i--){
    const m=chat[i];
    if(!m||m.is_user)continue;
    const r=readRecord(m);
    if(r?.version===STATE_VERSION&&r.kind==='checkpoint'&&r.chainHash===hashes[i]&&r.snapshot)return {index:i,state:clone(r.snapshot)};
  }
  return {index:-1,state:emptySnapshot()};
}

function restoreRecordedState(chat,hashes,targetIndex){
  if(targetIndex<0)return emptySnapshot();
  const cp=findValidCheckpoint(chat,hashes,targetIndex);
  let state=cp.state;
  for(let i=cp.index+1;i<=targetIndex;i++){
    const m=chat[i];
    if(!m||m.is_user)continue;
    const r=readRecord(m);
    if(!r||r.version!==STATE_VERSION||r.chainHash!==hashes[i])return null;
    state=recordState(r,state);
    if(!state)return null;
  }
  return state;
}

async function persistChat(inst){
  try{
    const result=inst.ctx?.saveChat?.();
    if(result?.then)await result;
  }catch(e){console.warn('[Map-N timeline] saveChat failed',e)}
}

function batch(inst,fn){
  const api=globalThis.MapNHistoryWindow;
  return api?.batch?api.batch(inst,fn):fn();
}

let synchronizing=false,queued=false,queuedReason='event';

async function synchronize(reason='event',{forceWorld=false}={}){
  const inst=window.MapNInstance;
  if(!inst)return null;
  if(synchronizing){queued=true;queuedReason=reason;return null}
  synchronizing=true;
  try{
    refreshContext(inst);
    if(forceWorld){try{await inst.prime(true)}catch(e){console.warn('[Map-N timeline] world refresh failed',e)}}
    const chat=Array.isArray(inst.ctx?.chat)?inst.ctx.chat:[];
    const hashes=chatHashes(chat);
    const lastAI=findLastAssistant(chat);
    if(lastAI<0){applySnapshot(inst,emptySnapshot());inst.render?.();return emptySnapshot()}

    let firstInvalid=-1;
    for(let i=0;i<=lastAI;i++){
      const m=chat[i];
      if(!m||m.is_user)continue;
      const r=readRecord(m);
      if(!r||r.version!==STATE_VERSION||r.chainHash!==hashes[i]){firstInvalid=i;break}
    }

    if(firstInvalid<0){
      const restored=restoreRecordedState(chat,hashes,lastAI);
      if(restored){applySnapshot(inst,restored);inst.render?.();return restored}
      firstInvalid=0;
    }

    const cp=findValidCheckpoint(chat,hashes,firstInvalid-1);
    applySnapshot(inst,cp.state,{preserveBrowse:true});
    let state=clone(cp.state),ordinal=assistantOrdinalAt(chat,cp.index);
    const interval=checkpointInterval();

    batch(inst,()=>{
      for(let i=cp.index+1;i<=lastAI;i++){
        const m=chat[i];
        if(!m||m.is_user||!m.mes)continue;
        ordinal++;
        const before=clone(state);
        inst.process(String(m.mes),false);
        state=snapshot(inst);
        const makeCheckpoint=ordinal===0||ordinal%interval===0;
        const record=makeCheckpoint
          ?{version:STATE_VERSION,kind:'checkpoint',chainHash:hashes[i],snapshot:clone(state)}
          :{version:STATE_VERSION,kind:'delta',chainHash:hashes[i],...deltaBetween(before,state)};
        writeRecord(m,record);
      }
    });

    applySnapshot(inst,state,{preserveBrowse:true});
    await persistChat(inst);
    inst.render?.();
    console.log(`[Map-N timeline] synchronized (${reason}) from ${cp.index+1} to ${lastAI}`);
    return state;
  }finally{
    synchronizing=false;
    if(queued){const r=queuedReason;queued=false;queuedReason='event';setTimeout(()=>synchronize(r),0)}
  }
}

async function commitCurrentCheckpoint(reason='manual'){
  const inst=window.MapNInstance;if(!inst)return false;
  refreshContext(inst);
  const chat=Array.isArray(inst.ctx?.chat)?inst.ctx.chat:[],lastAI=findLastAssistant(chat);
  if(lastAI<0)return false;
  const hashes=chatHashes(chat),state=snapshot(inst);
  writeRecord(chat[lastAI],{version:STATE_VERSION,kind:'checkpoint',chainHash:hashes[lastAI],snapshot:state,reason});
  await persistChat(inst);
  return true;
}

async function clearCurrentChat(){
  const inst=window.MapNInstance;if(!inst)return;
  refreshContext(inst);
  const chat=Array.isArray(inst.ctx?.chat)?inst.ctx.chat:[];
  for(const m of chat)removeRecords(m);
  try{localStorage.removeItem(inst.memoryKey);localStorage.removeItem(`${inst.memoryKey}:scene-v2`);localStorage.removeItem(`${inst.memoryKey}:presence-v1`)}catch{}
  inst.__mapNSceneStore={version:5,learnedLocations:{}};
  applySnapshot(inst,emptySnapshot(),{preserveBrowse:false});
  await persistChat(inst);
  inst.render?.();
}

function bindEvents(inst){
  const es=inst.ctx?.eventSource,et=inst.ctx?.eventTypes||inst.ctx?.event_types;
  if(!es||!et)return;
  let timer=null;
  const queue=reason=>{clearTimeout(timer);timer=setTimeout(()=>synchronize(reason),90)};
  ['MESSAGE_RECEIVED','MESSAGE_SWIPED','MESSAGE_UPDATED','MESSAGE_EDITED','MESSAGE_DELETED','CHAT_CHANGED','CHARACTER_SELECTED'].forEach(k=>{
    if(et[k])es.on(et[k],()=>queue(k));
  });
  if(et.WORLDINFO_ENTRIES_LOADED)es.on(et.WORLDINFO_ENTRIES_LOADED,()=>queue('WORLDINFO_ENTRIES_LOADED'));
}

async function install(){
  for(let i=0;i<180&&!window.MapNInstance;i++)await wait(50);
  const inst=window.MapNInstance;if(!inst||inst.__mapNTimelineState100)return;
  inst.__mapNTimelineState100=true;
  globalThis.MapNCheckpointInterval=globalThis.MapNCheckpointInterval||DEFAULT_CHECKPOINT_INTERVAL;
  globalThis.MapNTimeline={synchronize,commitCurrentCheckpoint,clearCurrentChat,readRecord,writeRecord,snapshot};
  bindEvents(inst);
  await synchronize('startup');
  console.log(`[Map-N] timeline state v1.0.0 installed; checkpoint interval ${checkpointInterval()} assistant messages`);
}

install();
export {synchronize,commitCurrentCheckpoint,clearCurrentChat,readRecord,writeRecord,snapshot};
