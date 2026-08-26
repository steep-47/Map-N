// Map-N scene scanner v1.1.1
// Durable cognitive locations + conservative, role-based visible entity parsing.

const wait = ms => new Promise(r => setTimeout(r, ms));
const uniq = arr => [...new Set((arr || []).map(x => String(x).trim()).filter(Boolean))];
const ROOT = '世界舆图';
const MEMORY_VERSION = 2;

function scopeStoreKey(inst) { return `${inst.memoryKey}:scene-v2`; }
function emptyStore() { return { version: MEMORY_VERSION, learnedLocations: {}, knownCharacters: {} }; }
function loadStore(inst) { try { return { ...emptyStore(), ...(JSON.parse(localStorage.getItem(scopeStoreKey(inst)) || 'null') || {}) }; } catch { return emptyStore(); } }
function saveStore(inst) { try { localStorage.setItem(scopeStoreKey(inst), JSON.stringify(inst.__mapNSceneStore || emptyStore())); } catch (e) { console.warn('[Map-N] 场景记忆保存失败', e); } }

function parseHeaderLocation(text) {
    const head = String(text || '').split(/\n/).slice(0, 6).join('\n');
    const m = head.match(/[【\[]\s*((?:(?:\d{1,6}年\d{1,2}月\d{1,2}日)|(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2})|(?:\d{1,2}月\d{1,2}日))(?:[^|｜】\]\n]{0,30})?|(?:\d{1,2}:\d{2})(?:[^|｜】\]\n]{0,20})?)\s*[|｜]\s*([^】\]\n]+)[】\]]/);
    if (!m) return null;
    const parts = m[2].trim().split(/\s*[·•›>→/／]+\s*/).map(x => x.trim()).filter(x => x.length >= 2 && x.length <= 30);
    return parts.length ? parts : null;
}

function locKey(parts, index) { return parts.slice(0, index + 1).join('／'); }
function ensureLearnedNode(inst, key, label, parentKey) {
    const store = inst.__mapNSceneStore ||= emptyStore(); store.learnedLocations ||= {};
    store.learnedLocations[key] ||= { id:key, label, parent:parentKey || ROOT, aliases:[label], learned:true };
    const rec = store.learnedLocations[key]; rec.label=label; rec.parent=parentKey||ROOT; rec.aliases=uniq([...(rec.aliases||[]),label]); return rec;
}
function mergeLearnedLocations(inst) {
    const learned=(inst.__mapNSceneStore||emptyStore()).learnedLocations||{};
    for(const rec of Object.values(learned)){
        if(!inst.nodeMap[rec.id]) inst.nodeMap[rec.id]={id:rec.id,displayName:rec.label,aliases:rec.aliases||[rec.label],content:'剧情中确认的地点',type:'location',children:[],parent:rec.parent||ROOT,isWater:/海|河|湖|江|溪|潭|湾|岸|滩/.test(rec.label),isMountain:/山|峰|岭|崖|谷/.test(rec.label),learned:true};
        const n=inst.nodeMap[rec.id]; n.displayName=rec.label; n.parent=rec.parent||ROOT; n.children||=[]; n.aliases=uniq([...(n.aliases||[]),...(rec.aliases||[]),rec.label]);
        for(const a of n.aliases) if(!inst.alias.has(a)) inst.alias.set(a,rec.id); inst.discovered.add(rec.id);
    }
    for(const rec of Object.values(learned)){ const p=rec.parent||ROOT; if(p===ROOT){inst.root.children||=[];if(!inst.root.children.includes(rec.id))inst.root.children.push(rec.id);} else if(inst.nodeMap[p]){const k=inst.nodeMap[p].children||=[];if(!k.includes(rec.id))k.push(rec.id);} }
}
function learnLocationChain(inst,parts,setCurrent=true){let parent=ROOT;for(let i=0;i<parts.length;i++){const key=locKey(parts,i);ensureLearnedNode(inst,key,parts[i],parent);parent=key;}mergeLearnedLocations(inst);saveStore(inst);const leaf=locKey(parts,parts.length-1);if(setCurrent){inst.currentPos=leaf;inst.path=inst.pathTo(leaf);}return leaf;}

// Semantic classes. Lexicons provide language cues, but no individual example is a special case.
const INTENT_OR_REMOTE = /(?:准备|打算|计划|想(?:要)?|将要|要去|前往|赶往|去找|寻找|寻访|拜访|探望|看望|等待?|等候|听说|听闻|据说|传闻|提及|提起|谈及|谈起|说起|想到|想起|回忆|记得|梦见|担心|惦记|写信|传信|派人|托人|打听|询问.*下落)/;
const PERCEPTION_OR_ACTION = /(?:说|道|问|答|喊|叫|笑|哭|看|瞥|盯|望|点头|摇头|皱眉|开口|伸手|抬手|拍|扶|拉|推|递|接|站|坐|蹲|跪|躺|靠|走来|过来|赶到|来到|进来|出现|凑近|靠近|上前|跟着|跟在|身旁|旁边|面前|身后|身边|眼前|怀里|屋里|院里|门口|桌旁|对面)/;
const HUMAN_HEAD = '(?:男子|男人|汉子|女子|女人|少女|少年|老人|老者|妇人|青年|年轻人|孩童|孩子|修士|武者|剑客|僧人|道人|道士|书生|客人|伙计|侍从|随从|护卫|侍卫)';
const ATTRIBUTE = '(?:穿着[^，。！？!?；;]{1,12}|身着[^，。！？!?；;]{1,12}|披着[^，。！？!?；;]{1,12}|戴着[^，。！？!?；;]{1,10}|蒙着[^，。！？!?；;]{1,10}|手持[^，。！？!?；;]{1,10}|背着[^，。！？!?；;]{1,10}|高大|矮小|魁梧|瘦削|清瘦|年迈|年轻|中年|受伤|昏迷|蒙面|独眼|跛脚|白发|灰发|黑衣|白衣|青衣|红衣|灰衣|紫衣)';
const SOCIAL_TITLE = '(?:公子|小姐|少爷|夫人|先生|大人|前辈|道友|真人|长老|堂主|舵主|管事|掌柜|老板|村长|族长|师父|师傅|师兄|师姐|师弟|师妹|师叔|师伯|师姑|师祖|郎中|医师|大夫|将军|校尉|捕头|船长|船主|少主|家主|宗主|门主|寨主|城主|护法|统领|队长|婶|叔|伯|爷|婆|姨|姑|嫂|哥|姐|弟|妹)';
const GENERIC_TITLE_RE = new RegExp(`^${SOCIAL_TITLE}$`,'u');
const DESC_RE = new RegExp(`^(?:${ATTRIBUTE}(?:的)?){1,2}${HUMAN_HEAD}$`,'u');
const SPECIFIC_TITLE_RE = new RegExp(`^[\\p{Script=Han}]{1,2}${SOCIAL_TITLE}$`,'u');
const NAME_RE = /^[\p{Script=Han}]{2,4}$/u;
const LEADING_NOISE = /^(?:那位?|这位?|一名|一位|一个|那个|这个|旁边的|身旁的|对面的|门口的|身后的|眼前的)+/u;

function sentences(text){return String(text||'').split(/(?<=[。！？!?；;\n])/).map(x=>x.trim()).filter(Boolean);}
function cleanCandidate(s){s=String(s||'').trim().replace(LEADING_NOISE,'').replace(/^[，。！？!?；;：“”‘’「」『』\s]+|[，。！？!?；;：“”‘’「」『』\s]+$/g,'');return s.length>=2&&s.length<=18?s:null;}
function contextAround(s,name,left=18,right=20){const i=s.indexOf(name);return i<0?{left:'',right:''}:{left:s.slice(Math.max(0,i-left),i),right:s.slice(i+name.length,i+name.length+right)};}
function isRemoteMention(s,name){const {left,right}=contextAround(s,name);return INTENT_OR_REMOTE.test(left)||/^(?:的家|家中|住处|那里|那边|下落)/.test(right);}
function isObservable(s,name){if(isRemoteMention(s,name))return false;const {left,right}=contextAround(s,name);return PERCEPTION_OR_ACTION.test(left+right)||/(?:与|和|同|跟)\s*(?:你|我)|(?:你|我)\s*(?:身旁|身边|面前|对面)/.test(left+right);}
function specificity(kind){return kind==='name'?4:kind==='specific-title'?3:kind==='description'?2:0;}

function extractCandidates(inst,text){
    const out=[];const add=(raw,kind,start=-1)=>{const name=cleanCandidate(raw);if(!name||GENERIC_TITLE_RE.test(name))return;out.push({name,kind,start});};
    // World-book aliases are authoritative identity candidates.
    for(const id of inst.resolveMentions(text,'character')||[]){const n=inst.nodeMap[id];const aliases=n?.aliases||[id];for(const a of aliases)if(String(text).includes(a))add(a,'name',String(text).indexOf(a));}
    // Description phrases are structure-based: attribute phrase + human head noun.
    const descRe=new RegExp(`(?:那位?|这位?|一名|一位|一个)?((?:${ATTRIBUTE}(?:的)?){1,2}${HUMAN_HEAD})`,'gu');
    for(const m of String(text).matchAll(descRe))add(m[1],'description',m.index);
    // A surname/name component immediately attached to a social title is specific; bare titles are references only.
    const titleRe=new RegExp(`(?:那位?|这位?)?([\\p{Script=Han}]{1,2}${SOCIAL_TITLE})`,'gu');
    for(const m of String(text).matchAll(titleRe))add(m[1],'specific-title',m.index);
    // Explicit naming constructions only. Do not harvest arbitrary Han substrings as names.
    const nameRes=[/(?:名叫|叫作|叫做|唤作|姓名(?:是|为)?|自报名号(?:是|为)?|自报姓名(?:是|为)?|自称为?|姓甚名谁[^，。！？!?；;]{0,8}(?:答|道|说)?)[：:\s“「『]*([\p{Script=Han}]{2,4})/gu,/(?:此人|此女|此子|此老|他|她|其人)?\s*(?:正是|乃是)\s*([\p{Script=Han}]{2,4})(?=[，。！？!?；;：“”‘’「」『』\s])/gu];
    for(const re of nameRes)for(const m of String(text).matchAll(re))if(NAME_RE.test(m[1]))add(m[1],'name',m.index);
    return out;
}

function visibleCandidates(inst,text){const ss=sentences(text),out=[];for(const c of extractCandidates(inst,text)){if(ss.some(s=>s.includes(c.name)&&isObservable(s,c.name)))out.push({...c,score:specificity(c.kind)});}return out;}

function relationEvidence(text,a,b){
    const ai=text.indexOf(a.name),bi=text.indexOf(b.name);if(ai<0||bi<0)return 0;const dist=Math.abs(ai-bi);if(dist>220)return 0;let score=0;
    // Identity reveal / renaming constructions are strong evidence.
    const lo=Math.min(ai,bi),hi=Math.max(ai+a.name.length,bi+b.name.length);const bridge=text.slice(Math.max(0,lo-20),Math.min(text.length,hi+24));
    if(/(?:原来|其实|正是|乃是|名叫|叫作|叫做|唤作|姓|名为|自称)/.test(bridge))score+=3;
    // Same leading family-name marker between a specific social title and a full identity is useful but insufficient alone.
    if(a.kind==='specific-title'&&b.kind==='name'&&a.name[0]===b.name[0])score+=2;
    if(b.kind==='specific-title'&&a.kind==='name'&&a.name[0]===b.name[0])score+=2;
    // A descriptive placeholder followed nearby by a more specific address/name can be a candidate link, but only with discourse continuity.
    if((a.kind==='description')!==(b.kind==='description')&&dist<120&&/(?:那|这|其|他|她|闻言|随即|随后|又|转头|回头)/.test(bridge))score+=2;
    return score;
}

function resolveSceneEntities(inst,text){
    const store=inst.__mapNSceneStore||=emptyStore();store.knownCharacters||={};const candidates=visibleCandidates(inst,text);const entities=[];
    for(const c of candidates){let best=null,bestScore=0;for(const e of entities){const s=relationEvidence(text,e,c);if(s>bestScore){best=e;bestScore=s;}}
        if(best&&bestScore>=3){best.aliases=uniq([...best.aliases,c.name]);if(c.score>best.score){best.name=c.name;best.kind=c.kind;best.score=c.score;}}
        else entities.push({name:c.name,kind:c.kind,score:c.score,aliases:[c.name]});
    }
    // Durable identity memory is deliberately narrow: only explicit/full identities and non-generic specific titles.
    for(const e of entities){if(e.kind==='name'){const old=store.knownCharacters[e.name]||{name:e.name,aliases:[]};old.aliases=uniq([...old.aliases,...e.aliases.filter(a=>!DESC_RE.test(a)&&!GENERIC_TITLE_RE.test(a))]);store.knownCharacters[e.name]=old;}}
    saveStore(inst);return uniq(entities.map(e=>e.name)).slice(0,12);
}

function displayName(inst,id){return inst.nodeMap[id]?.displayName||inst.nodeMap[id]?.id||id;}
function patchDisplay(inst){if(inst.__mapNDisplayPatched)return;inst.__mapNDisplayPatched=true;const r=inst.render.bind(inst);inst.render=function(){r();const pos=this.container?.querySelector?.('#mapN-pos .hl');if(pos&&this.currentPos)pos.textContent=displayName(this,this.currentPos);const label=this.container?.querySelector?.('.mapN-characters .label');if(label)label.textContent='👤 在场人物：';};}

async function install(){
    for(let i=0;i<100&&!window.MapNInstance;i++)await wait(100);const inst=window.MapNInstance;if(!inst||inst.__sceneScanner111)return;inst.__sceneScanner111=true;
    inst.__mapNSceneStore=loadStore(inst);mergeLearnedLocations(inst);patchDisplay(inst);
    const build=inst.build.bind(inst);inst.build=function(entries){build(entries);mergeLearnedLocations(this);};
    const process=inst.process.bind(inst);inst.process=function(text,isUser=false){if(!text)return;const prev=[...(this.currentChars||[])];process(text,isUser);mergeLearnedLocations(this);if(isUser){this.currentChars=prev;this.save();return;}const chain=parseHeaderLocation(text);if(chain)learnLocationChain(this,chain,true);this.currentChars=resolveSceneEntities(this,text);this.currentChars.forEach(x=>this.encountered.add(x));this.save();if(this.container?.classList.contains('open'))this.render();};
    const chat=inst.ctx?.chat||[];let latestAI=null;for(const m of chat){if(!m?.mes||m.is_user)continue;const chain=parseHeaderLocation(String(m.mes));if(chain)learnLocationChain(inst,chain,false);latestAI=m;}if(latestAI?.mes){const chain=parseHeaderLocation(String(latestAI.mes));if(chain)learnLocationChain(inst,chain,true);inst.currentChars=resolveSceneEntities(inst,String(latestAI.mes));}
    inst.save();inst.render();console.log('[Map-N] scene scanner v1.1.1 installed');
}
install();
