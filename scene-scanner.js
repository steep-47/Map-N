// Map-N scene scanner v2.5.0
// Responsibility: learn canonical location chains from structured scene headers. No person parsing here.
// Scene-header locations keep message provenance so recent swipe/update/delete can roll back only affected learned nodes.
const wait=ms=>new Promise(r=>setTimeout(r,ms)),ROOT='世界舆图',MEMORY_VERSION=9;
const uniq=a=>[...new Set((a||[]).map(x=>String(x).trim()).filter(Boolean))];
const storeKey=i=>`${i.memoryKey}:scene-v2`;
const empty=()=>({version:MEMORY_VERSION,learnedLocations:{},conflicts:[]});
function load(i){try{const r=JSON.parse(localStorage.getItem(storeKey(i))||'null')||{};return{...empty(),...r,learnedLocations:r.learnedLocations||{},conflicts:Array.isArray(r.conflicts)?r.conflicts:[]}}catch{return empty()}}
function write(i){try{localStorage.setItem(storeKey(i),JSON.stringify(i.__mapNSceneStore||empty()))}catch(e){console.warn('[Map-N] 场景地点保存失败',e)}}
function save(i){if((i.__mapNBatchDepth||0)>0){i.__mapNSceneSaveDirty=true;return;}write(i);}
function recentRange(chat){const a=Array.isArray(chat)?chat:[],api=globalThis.MapNHistoryWindow;return api?.range?api.range(a):{start:0,end:a.length};}
function hashText(s){let h=2166136261;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function sourceKey(index,text){return Number.isInteger(index)&&index>=0?`${index}:${hashText(text)}`:null}
function inferSourceIndex(i,text){const forced=Number(i.__mapNProcessingMessageIndex);if(Number.isInteger(forced)&&forced>=0)return forced;const chat=i.ctx?.chat||[];for(let n=chat.length-1;n>=0;n--)if(String(chat[n]?.mes||'')===String(text||''))return n;return -1}
function canonicalPath(core,value){if(!value||value===ROOT)return value;const parts=String(value).split('／').flatMap(x=>core.normalizeLocationParts(x));return parts.length?parts.join('／'):core.normalizeLocationSegment(value);}
function evidenceText(text){return String(text||'').replace(/\s+/gu,' ').trim().slice(0,1200)}
function evidenceList(...groups){const m=new Map();for(const group of groups)for(const e of(Array.isArray(group)?group:[])){const source=String(e?.source||''),body=evidenceText(e?.text||'');if(source&&body)m.set(source,{source,text:body});}return[...m.values()].slice(-6)}
function addEvidence(list,source,body){const next=evidenceList(list);const text=evidenceText(body);if(source&&text){const m=new Map(next.map(e=>[e.source,e]));m.set(source,{source,text});return[...m.values()].slice(-6)}return next}
function migrate(i,core){
 const s=i.__mapNSceneStore||=load(i),next={};let changed=s.version!==MEMORY_VERSION;
 for(const rec of Object.values(s.learnedLocations||{})){
  let parts=String(rec?.id||'').split('／').flatMap(x=>core.normalizeLocationParts(x));
  const fallback=core.normalizeLocationSegment(rec?.label||'');if(!parts.length&&fallback)parts=[fallback];if(!parts.length)continue;
  for(let n=0;n<parts.length;n++){
   const id=parts.slice(0,n+1).join('／'),parent=n?parts.slice(0,n).join('／'):ROOT,label=parts[n],prev=next[id],leaf=n===parts.length-1;
   const aliases=uniq([...(prev?.aliases||[]),label,...(leaf?(rec?.aliases||[]).map(core.normalizeLocationSegment):[])]),sources=uniq([...(prev?.sources||[]),...(rec?.sources||[])]),evidence=evidenceList(prev?.evidence,rec?.evidence);
   next[id]={id,label,parent,aliases,sources,evidence,learned:true,source:'scene-header'};
  }
  const migrated=parts.join('／');if(migrated!==rec?.id||s.version!==MEMORY_VERSION)changed=true;
 }
 s.learnedLocations=next;s.version=MEMORY_VERSION;
 if(changed){if(i.discovered instanceof Set)i.discovered=new Set([...i.discovered].map(x=>x===ROOT?ROOT:canonicalPath(core,x)).filter(Boolean));if(i.currentPos)i.currentPos=canonicalPath(core,i.currentPos);if(Array.isArray(i.path))i.path=i.path.map(x=>x===ROOT?ROOT:canonicalPath(core,x)).filter(Boolean);save(i);}
 return changed;
}
function ensure(i,core,parts,src=null,sourceText=''){const s=i.__mapNSceneStore||=load(i);if(s.version!==MEMORY_VERSION)migrate(i,core);let parent=ROOT,changed=false;const touched=[];for(let n=0;n<parts.length;n++){const id=parts.slice(0,n+1).join('／'),label=parts[n],existing=s.learnedLocations[id];if(!existing){s.learnedLocations[id]={id,label,parent,aliases:[label],sources:src?[src]:[],evidence:addEvidence([],src,sourceText),learned:true,source:'scene-header'};changed=true;}else{const aliases=uniq([...(existing.aliases||[]),label]),sources=uniq([...(existing.sources||[]),...(src?[src]:[])]),evidence=addEvidence(existing.evidence,src,sourceText);if(existing.id!==id||existing.label!==label||existing.parent!==parent||aliases.length!==(existing.aliases||[]).length||sources.length!==(existing.sources||[]).length||evidence.length!==(existing.evidence||[]).length||evidence.at(-1)?.text!==(existing.evidence||[]).at(-1)?.text){existing.id=id;existing.label=label;existing.parent=parent;existing.aliases=aliases;existing.sources=sources;existing.evidence=evidence;existing.learned=true;existing.source='scene-header';changed=true;}}touched.push(id);parent=id;}if(changed)save(i);return{leaf:parent,touched,changed};}
function removeChild(list,id){if(!Array.isArray(list))return;for(let n=list.length-1;n>=0;n--)if(list[n]===id)list.splice(n,1);}
function adoptStaticPlaceholder(i,r){
 if(!r?.label||r.id===r.label)return null;
 const old=i.nodeMap?.[r.label];if(!old||old.type!=='location'||old.learned===true||old.source==='scene-header')return null;
 const dynamicParentLabel=r.parent===ROOT?ROOT:String(r.parent||'').split('／').at(-1);
 const oldParent=old.parent||ROOT;if(oldParent!==ROOT&&oldParent!==r.parent&&oldParent!==dynamicParentLabel)return null;
 if(oldParent===ROOT)removeChild(i.root?.children,old.id);else removeChild(i.nodeMap?.[oldParent]?.children,old.id);
 const children=[...(old.children||[])];for(const childId of children){const child=i.nodeMap?.[childId];if(child?.parent===old.id)child.parent=r.id;}
 const compiled=i.__mapNCompiledParents instanceof Map?i.__mapNCompiledParents:null;
 if(compiled){for(const [child,p] of [...compiled.entries()])if(p===old.id)compiled.set(child,r.id);compiled.delete(old.id);}
 for(const [a,target] of [...(i.alias?.entries?.()||[])])if(target===old.id)i.alias.delete(a);
 i.discovered?.delete?.(old.id);delete i.nodeMap[old.id];
 return{...old,children};
}
function bindAlias(i,a,id){
 if(!a)return;i.__mapNAmbiguousAliases||=new Set();if(i.__mapNAmbiguousAliases.has(a))return;
 const prev=i.alias.get(a);if(!prev||prev===id||!i.nodeMap?.[prev]){i.alias.set(a,id);return;}
 const p=i.nodeMap[prev],n=i.nodeMap?.[id];
 if(p?.learned===true&&n?.learned===true){i.alias.delete(a);i.__mapNAmbiguousAliases.add(a);return;}
 if(p?.learned!==true&&n?.learned===true)i.alias.set(a,id);
}
function mergeRecord(i,r){
 if(!r)return;const aliases=uniq([...(r.aliases||[]),r.label]),adopted=adoptStaticPlaceholder(i,r),existing=i.nodeMap[r.id],sceneContent=['剧情场景头确认的地点。',...(r.evidence||[]).map(e=>e.text)].join(' ');
 if(!existing){i.nodeMap[r.id]={id:r.id,displayName:r.label,aliases:uniq([...(adopted?.aliases||[]),...aliases]),content:[adopted?.content,sceneContent].filter(Boolean).join(' '),type:'location',children:[...(adopted?.children||[])],parent:r.parent,isWater:!!adopted?.isWater||/海|河|湖|江|溪|潭|湾|岸|滩/u.test(r.label),isMountain:!!adopted?.isMountain||/山|峰|岭|崖|峪|谷/u.test(r.label),learned:true,source:'scene-header',worldbookBacked:!!adopted};}
 const n=i.nodeMap[r.id],sceneOwned=n.source==='scene-header'&&n.learned===true;
 if(sceneOwned){n.displayName=r.label;n.parent=r.parent;n.content=[...new Set([adopted?.content,n.worldbookBacked?n.content:null,sceneContent].filter(Boolean))].join(' ');n.learned=true;n.source='scene-header';n.worldbookBacked=n.worldbookBacked||!!adopted;}
 n.aliases=uniq([...(n.aliases||[]),...(adopted?.aliases||[]),...aliases]);for(const a of n.aliases)bindAlias(i,a,r.id);i.discovered.add(r.id);
 if(sceneOwned){if(r.parent===ROOT){i.root.children||=[];if(!i.root.children.includes(r.id))i.root.children.push(r.id);}else if(i.nodeMap[r.parent]){i.nodeMap[r.parent].children||=[];if(!i.nodeMap[r.parent].children.includes(r.id))i.nodeMap[r.parent].children.push(r.id);}}
}
function mergeAll(i,core){migrate(i,core);for(const r of Object.values(i.__mapNSceneStore?.learnedLocations||{}))mergeRecord(i,r);}
const STABLE_GEO_RE=/(?:大陆|陆|洲|州|郡|府|县|国|皇朝|王朝|帝国|王国|域|界)$/u;
const CORRECTION_RE=/(?:纠正|更正|修正|改正|写错|说错|记错|弄错|地图.{0,8}(?:错|错误)|地理.{0,8}(?:错|错误)|归属.{0,8}(?:错|错误)|前面.{0,8}(?:错|错误)|刚才.{0,8}(?:错|错误)|(?:归属|属于|隶属|位于|所在地|上级|下辖)[^。！？!?]{0,28}(?:应为|应该是|实际(?:上)?是|并非|不是))/u;
function recordConflict(i,incoming,kept,src,text,segment=''){
 const s=i.__mapNSceneStore||=load(i),item={incoming,kept,segment,source:src||null,evidence:evidenceText(text),at:Date.now()};
 const last=s.conflicts?.at?.(-1);if(!last||last.incoming!==incoming||last.kept!==kept||last.segment!==segment)s.conflicts=[...(s.conflicts||[]),item].slice(-32);
 save(i);
}
function correctionIntent(i,sourceIndex,label,oldParts,newParts){
 if(!Number.isInteger(sourceIndex)||sourceIndex<=0)return false;const prev=i.ctx?.chat?.[sourceIndex-1];if(!prev?.is_user)return false;
 const text=String(prev.mes||'').replace(/\s+/gu,' ').trim();if(!CORRECTION_RE.test(text))return false;
 const refs=uniq([label,...oldParts,...newParts]).filter(x=>x&&x.length>=2);return refs.some(x=>text.includes(x))||/(?:地图|地理|地点|位置|归属|国家|王朝|皇朝|州|郡|府|县|边境)/u.test(text);
}
function mergeStoreRecord(a,b){
 if(!a)return b;if(!b)return a;return{...a,...b,aliases:uniq([...(a.aliases||[]),...(b.aliases||[])]),sources:uniq([...(a.sources||[]),...(b.sources||[])]),evidence:evidenceList(a.evidence,b.evidence)};
}
function rehomePrefix(i,oldPrefix,newPrefix){
 if(!oldPrefix||!newPrefix||oldPrefix===newPrefix)return;const s=i.__mapNSceneStore||=load(i),rows=Object.entries(s.learnedLocations||{}).filter(([id])=>id===oldPrefix||id.startsWith(oldPrefix+'／')).sort((a,b)=>a[0].length-b[0].length);
 if(!rows.length)return;const moved=[];
 for(const [oldId,rec] of rows){const suffix=oldId.slice(oldPrefix.length),newId=newPrefix+suffix,parts=newId.split('／').filter(Boolean),parent=parts.length>1?parts.slice(0,-1).join('／'):ROOT,next={...rec,id:newId,parent,label:parts.at(-1)};s.learnedLocations[newId]=mergeStoreRecord(s.learnedLocations[newId],next);delete s.learnedLocations[oldId];moved.push({oldId,newId});}
 for(const {oldId} of moved)detachNode(i,oldId);for(const {newId} of moved)mergeRecord(i,s.learnedLocations[newId]);
 if(i.currentPos&&(i.currentPos===oldPrefix||i.currentPos.startsWith(oldPrefix+'／')))i.currentPos=newPrefix+i.currentPos.slice(oldPrefix.length);
 if(Array.isArray(i.path))i.path=i.currentPos?i.pathTo(i.currentPos):[ROOT];i.__mapNHierarchyGraphSig=null;save(i);
}
function stableParts(i,core,clean,src,text,sourceIndex){
 if(!clean.length)return{parts:clean,conflicted:false,corrected:false};const s=i.__mapNSceneStore||=load(i),incoming=clean.join('／'),records=Object.values(s.learnedLocations||{});
 for(let n=0;n<clean.length;n++){
  const label=core.normalizeLocationSegment(clean[n]);if(!STABLE_GEO_RE.test(label))continue;
  const matches=records.filter(r=>core.normalizeLocationSegment(r?.label)===label);if(matches.length!==1)continue;
  const rec=matches[0],old=String(rec.id||'').split('／').filter(Boolean),prefix=clean.slice(0,n+1).join('／');if(!old.length||rec.id===prefix)continue;
  if(correctionIntent(i,sourceIndex,label,old,clean)){rehomePrefix(i,rec.id,prefix);return{parts:clean,conflicted:false,corrected:true};}
  recordConflict(i,incoming,rec.id,src,text,label);return{parts:null,conflicted:true,corrected:false};
 }
 return{parts:clean,conflicted:false,corrected:false};
}
function learn(i,core,parts,setCurrent=true,sourceIndex=null,sourceText=''){
 const raw=core.expandLocationParts?core.expandLocationParts(parts):(parts||[]).map(core.normalizeLocationSegment).filter(Boolean);if(!raw.length)return null;
 const idx=Number.isInteger(sourceIndex)?sourceIndex:inferSourceIndex(i,sourceText),src=sourceKey(idx,sourceText),resolved=stableParts(i,core,raw,src,sourceText,idx);
 if(resolved.conflicted||!resolved.parts?.length){i.save?.();return i.currentPos||null;}const clean=resolved.parts;
 const{leaf,touched}=ensure(i,core,clean,src,sourceText);const s=i.__mapNSceneStore;for(const id of touched)mergeRecord(i,s?.learnedLocations?.[id]);
 if(setCurrent){i.currentPos=leaf;i.path=i.pathTo(leaf);}i.save?.();return leaf;
}
function detachNode(i,id){const n=i.nodeMap?.[id];if(!n||n.source!=='scene-header'||n.learned!==true)return;if(n.parent===ROOT)removeChild(i.root?.children,id);else removeChild(i.nodeMap?.[n.parent]?.children,id);delete i.nodeMap[id];for(const [a,target] of [...(i.alias?.entries?.()||[])])if(target===id)i.alias.delete(a);i.discovered?.delete?.(id);if(i.currentPos===id)i.currentPos=null;if(Array.isArray(i.path)&&i.path.includes(id))i.path=[ROOT];}
function reconcileRecent(i,start,end,chat){const s=i.__mapNSceneStore||=load(i);const valid=new Set();for(let n=start;n<end;n++){const m=chat?.[n];if(m?.mes&&!m.is_user)valid.add(sourceKey(n,String(m.mes)));}let changed=false;for(const [id,rec] of Object.entries(s.learnedLocations||{})){const sources=uniq(rec?.sources||[]);if(!sources.length)continue;const kept=sources.filter(k=>{const idx=Number(String(k).split(':',1)[0]);return !Number.isInteger(idx)||idx<start||valid.has(k)});if(kept.length!==sources.length){rec.sources=kept;rec.evidence=(rec.evidence||[]).filter(e=>kept.includes(e.source));changed=true;}if(!kept.length){delete s.learnedLocations[id];detachNode(i,id);changed=true;}}if(changed){i.__mapNHierarchyGraphSig=null;save(i);}return changed;}
function scanHeaders(i,core,chat,start=0,end=(chat||[]).length){let count=0,last=null;for(let n=Math.max(0,start);n<Math.min(end,(chat||[]).length);n++){const m=chat?.[n];if(!m?.mes||m.is_user)continue;const text=String(m.mes),paths=core.parseHeaderLocations?.(text)||[];for(const p of paths){last=learn(i,core,p,true,n,text);count++;}}return{count,last};}
async function install(){for(let n=0;n<160&&(!window.MapNInstance||!globalThis.MapNEntityCore);n++)await wait(50);const i=window.MapNInstance,core=globalThis.MapNEntityCore;if(!i||!core||i.__sceneScanner250)return;i.__sceneScanner250=true;i.__mapNSceneStore=load(i);migrate(i,core);const priorFlush=i.__mapNFlushBatch?.bind(i);i.__mapNFlushBatch=function(){priorFlush?.();if(this.__mapNSceneSaveDirty){this.__mapNSceneSaveDirty=false;write(this);}};const oldBuild=i.build.bind(i);i.build=function(entries){oldBuild(entries);this.__mapNAmbiguousAliases=new Set();mergeAll(this,core);};const oldProcess=i.process.bind(i);i.process=function(text,isUser=false){oldProcess(text,isUser);if(!isUser&&text){const paths=core.parseHeaderLocations?.(text)||[];for(const parts of paths)learn(this,core,parts,true,null,String(text));}if(this.container?.classList.contains('open'))this.render?.();};mergeAll(i,core);const chat=i.ctx?.chat||[],r=recentRange(chat);scanHeaders(i,core,chat,r.start,r.end);globalThis.MapNSceneScanner={reconcileRecent:(inst,start,end,all)=>reconcileRecent(inst,start,end,all),scanAll:(inst,all)=>scanHeaders(inst,core,all,0,(all||[]).length)};const es=i.ctx?.eventSource,et=i.ctx?.eventTypes||i.ctx?.event_types;if(es&&et){const onMutation=()=>setTimeout(()=>{const fresh=window.SillyTavern?.getContext?.();if(fresh)i.ctx=fresh;const all=i.ctx?.chat||[],rr=recentRange(all);if(reconcileRecent(i,rr.start,rr.end,all))i.render?.();},80);['MESSAGE_SWIPED','MESSAGE_UPDATED','MESSAGE_DELETED'].forEach(k=>{if(et[k])es.on(et[k],onMutation)});}i.render?.();console.log('[Map-N] scene scanner v2.5.0 installed');}
install();
