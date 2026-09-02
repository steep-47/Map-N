// Map-N data manager v1.4.0
// Current-chat data tools only. Timeline synchronization is owned by timeline-state.js.
const dmWait=ms=>new Promise(r=>setTimeout(r,ms));
const DM_VERSION=2,DM_DEBUG_SUFFIX=':debug-v1';
function dmKeys(inst){return{main:inst.memoryKey,scene:`${inst.memoryKey}:scene-v2`,presence:`${inst.memoryKey}:presence-v1`,debug:`${inst.memoryKey}${DM_DEBUG_SUFFIX}`}}
function dmRead(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}}
function dmWrite(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v))}catch{}}
function dmDebugState(inst){return dmRead(dmKeys(inst).debug)||{enabled:false,logs:[]}}
function dmSaveDebug(inst,d){dmWrite(dmKeys(inst).debug,d)}
function dmLog(inst,type,data={}){const d=dmDebugState(inst);if(!d.enabled)return;d.logs.push({time:new Date().toISOString(),type,...data});if(d.logs.length>300)d.logs=d.logs.slice(-300);dmSaveDebug(inst,d);console.debug('[Map-N debug]',type,data)}
function dmResetRuntime(inst){inst.root={id:'世界舆图',children:[],parent:null};inst.nodeMap={};inst.alias=new Map();inst.entries=[];inst.lastSig='';inst.path=['世界舆图'];inst.discovered=new Set(['世界舆图']);inst.encountered=new Set();inst.currentPos=null;inst.currentChars=[];inst.__mapNSceneStore={version:5,learnedLocations:{}};inst.__mapNPresenceState={version:3,current:[],lastLocation:null};inst.__mapNHierarchyGraphSig=null}
function dmClearStored(inst,{keepDebug=true}={}){const k=dmKeys(inst);[k.main,k.scene,k.presence].forEach(x=>localStorage.removeItem(x));if(!keepDebug)localStorage.removeItem(k.debug)}
async function dmClearCurrent(inst){
  if(globalThis.MapNTimeline?.clearCurrentChat){await globalThis.MapNTimeline.clearCurrentChat();dmLog(inst,'clear',{scope:inst.memoryKey,mode:'timeline'});return}
  dmClearStored(inst,{keepDebug:true});dmResetRuntime(inst);inst.render?.();dmLog(inst,'clear',{scope:inst.memoryKey,mode:'fallback'})
}
function dmExport(inst){
  const k=dmKeys(inst),payload={format:'Map-N',version:DM_VERSION,exportedAt:new Date().toISOString(),scope:inst.memoryKey,data:{main:dmRead(k.main),scene:dmRead(k.scene),presence:dmRead(k.presence)}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`Map-N-${Date.now()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);dmLog(inst,'export',{})
}
function dmImport(inst,file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=async()=>{try{
  const p=JSON.parse(String(r.result||''));if(p?.format!=='Map-N'||!p.data)throw new Error('不是有效的 Map-N 数据文件');
  if(globalThis.MapNTimeline?.clearCurrentChat)await globalThis.MapNTimeline.clearCurrentChat();else{dmClearStored(inst,{keepDebug:true});dmResetRuntime(inst)}
  const k=dmKeys(inst);dmWrite(k.main,p.data.main);dmWrite(k.scene,p.data.scene);dmWrite(k.presence,p.data.presence);
  inst.load?.();inst.__mapNSceneStore=p.data.scene||{version:5,learnedLocations:{}};inst.__mapNPresenceState=p.data.presence||{version:3,current:[],lastLocation:null};
  await inst.prime?.(true);try{if(Array.isArray(inst.entries))inst.build(inst.entries)}catch{}
  inst.render?.();await globalThis.MapNTimeline?.commitCurrentCheckpoint?.('import');dmLog(inst,'import',{sourceScope:p.scope||null});resolve()
}catch(e){reject(e)}};r.onerror=()=>reject(r.error||new Error('读取文件失败'));r.readAsText(file,'utf-8')})}
function dmMakePanel(inst){
  if(document.querySelector('#mapN-data-panel'))return;
  const p=document.createElement('div');p.id='mapN-data-panel';p.style.cssText='position:absolute;right:58px;top:auto;bottom:88px;z-index:20;background:#111821;border:1px solid #30363d;border-radius:10px;padding:8px;display:none;gap:6px;flex-wrap:wrap;width:min(230px,calc(100% - 86px));max-height:calc(100% - 156px);overflow:auto;color:#c9d1d9;font-size:12px;box-shadow:0 5px 24px rgba(0,0,0,.65);box-sizing:border-box';
  const mk=(t,fn)=>{const b=document.createElement('button');b.textContent=t;b.style.cssText='background:#1c2333;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;padding:7px 8px;font-size:12px;flex:1 1 82px';b.onclick=fn;p.appendChild(b);return b};
  const themeLabel=document.createElement('div');themeLabel.textContent='外观模式';themeLabel.style.cssText='width:100%;flex:1 0 100%;font-size:11px;opacity:.72;padding:0 2px 1px';p.appendChild(themeLabel);
  const themeButtons=[];const syncThemeButtons=()=>{const mode=window.MapNTheme?.getMode?.()||'auto';themeButtons.forEach(b=>b.classList.toggle('active',b.dataset.mode===mode))};
  [['自动','auto'],['白天','light'],['夜间','dark']].forEach(([label,mode])=>{const b=mk(label,()=>{window.MapNTheme?.setMode?.(mode);syncThemeButtons()});b.dataset.mode=mode;b.classList.add('mapN-theme-choice');b.style.flex='1 1 56px';themeButtons.push(b)});
  const sep=document.createElement('div');sep.style.cssText='width:100%;height:1px;background:currentColor;opacity:.10;margin:2px 0';p.appendChild(sep);
  mk('导出',()=>dmExport(inst));
  mk('导入',()=>{const f=document.createElement('input');f.type='file';f.accept='.json,application/json';f.onchange=async()=>{if(!f.files?.[0])return;try{await dmImport(inst,f.files[0]);alert('Map-N：导入完成')}catch(e){alert(`Map-N：导入失败\n${e.message||e}`)}};f.click()});
  mk('清空',async()=>{if(!confirm('清空当前聊天的 Map-N 时间线数据？此操作不会影响其他聊天。'))return;await dmClearCurrent(inst);alert('Map-N：当前聊天地图数据已清空')});
  const dbg=mk('调试：关',()=>{const d=dmDebugState(inst);d.enabled=!d.enabled;dmSaveDebug(inst,d);dbg.textContent=`调试：${d.enabled?'开':'关'}`;dmLog(inst,'debug-toggle',{enabled:d.enabled})});dbg.textContent=`调试：${dmDebugState(inst).enabled?'开':'关'}`;
  mk('复制日志',async()=>{const text=JSON.stringify(dmDebugState(inst).logs||[],null,2);try{await navigator.clipboard.writeText(text);alert('Map-N：调试日志已复制')}catch{prompt('复制下面的调试日志：',text)}});
  (inst.container||document.body).appendChild(p);inst.__mapNDataPanel=p;window.addEventListener('mapn-theme-mode-changed',syncThemeButtons);setTimeout(syncThemeButtons,0);
  const tools=inst.container?.querySelector('.mapN-tools');if(tools){const b=document.createElement('button');b.type='button';b.id='mapN-data-btn';b.title='数据与调试';b.textContent='⚙';b.onclick=e=>{e.stopPropagation();p.style.display=p.style.display==='flex'?'none':'flex';if(p.style.display==='flex')syncThemeButtons()};tools.appendChild(b)}
}
async function installDataManager(){for(let i=0;i<120&&!window.MapNInstance;i++)await dmWait(100);const inst=window.MapNInstance;if(!inst||inst.__mapNDataManager140)return;inst.__mapNDataManager140=true;dmMakePanel(inst);console.log('[Map-N] data manager v1.4.0 installed')}
installDataManager();
