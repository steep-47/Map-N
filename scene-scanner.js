// Map-N scene scanner v1.1.0
// Persistent cognitive locations + conservative visible-character entity resolution.

const wait = ms => new Promise(r => setTimeout(r, ms));
const uniq = arr => [...new Set((arr || []).map(x => String(x).trim()).filter(Boolean))];
const ROOT = '世界舆图';
const MEMORY_VERSION = 2;

function scopeStoreKey(inst) { return `${inst.memoryKey}:scene-v2`; }
function emptyStore() { return { version: MEMORY_VERSION, learnedLocations: {}, knownCharacters: {} }; }
function loadStore(inst) {
    try { return { ...emptyStore(), ...(JSON.parse(localStorage.getItem(scopeStoreKey(inst)) || 'null') || {}) }; }
    catch { return emptyStore(); }
}
function saveStore(inst) {
    try { localStorage.setItem(scopeStoreKey(inst), JSON.stringify(inst.__mapNSceneStore || emptyStore())); }
    catch (e) { console.warn('[Map-N] 场景记忆保存失败', e); }
}

function parseHeaderLocation(text) {
    const head = String(text || '').split(/\n/).slice(0, 6).join('\n');
    // Only accept a timestamp-like left side. A generic [foo | bar] is not a location header.
    const m = head.match(/[【\[]\s*((?:\d{1,6}年)?\d{1,2}月\d{1,2}日[^|】\]\n]{0,30}|\d{1,2}:\d{2}[^|】\]\n]{0,20})\s*\|\s*([^】\]\n]+)[】\]]/);
    if (!m) return null;
    const parts = m[2].trim().split(/\s*[·•›>→/／]+\s*/).map(x => x.trim()).filter(x => x.length >= 2 && x.length <= 30);
    return parts.length ? parts : null;
}

function locKey(parts, index) { return parts.slice(0, index + 1).join('／'); }
function ensureLearnedNode(inst, key, label, parentKey) {
    const store = inst.__mapNSceneStore ||= emptyStore();
    store.learnedLocations ||= {};
    store.learnedLocations[key] ||= { id:key, label, parent:parentKey || ROOT, aliases:[label], learned:true };
    const rec = store.learnedLocations[key];
    rec.label = label; rec.parent = parentKey || ROOT; rec.aliases = uniq([...(rec.aliases || []), label]);
    return rec;
}

function mergeLearnedLocations(inst) {
    const store = inst.__mapNSceneStore || emptyStore();
    const learned = store.learnedLocations || {};
    for (const rec of Object.values(learned)) {
        const id = rec.id;
        if (!inst.nodeMap[id]) inst.nodeMap[id] = {
            id, displayName:rec.label, aliases:rec.aliases || [rec.label], content:'剧情中确认的地点', type:'location', children:[], parent:rec.parent || ROOT,
            isWater:/海|河|湖|江|溪|潭|湾|岸|滩/.test(rec.label), isMountain:/山|峰|岭|崖|谷/.test(rec.label), learned:true
        };
        const node = inst.nodeMap[id];
        node.displayName = rec.label; node.parent = rec.parent || ROOT; node.children ||= []; node.aliases = uniq([...(node.aliases || []), ...(rec.aliases || []), rec.label]);
        for (const a of node.aliases) if (!inst.alias.has(a)) inst.alias.set(a, id);
        inst.discovered.add(id);
    }
    for (const rec of Object.values(learned)) {
        const id = rec.id, parent = rec.parent || ROOT;
        if (parent === ROOT) { inst.root.children ||= []; if (!inst.root.children.includes(id)) inst.root.children.push(id); }
        else if (inst.nodeMap[parent]) { const kids = inst.nodeMap[parent].children ||= []; if (!kids.includes(id)) kids.push(id); }
    }
}

function learnLocationChain(inst, parts, setCurrent = true) {
    let parent = ROOT;
    for (let i = 0; i < parts.length; i++) {
        const key = locKey(parts, i);
        ensureLearnedNode(inst, key, parts[i], parent);
        parent = key;
    }
    mergeLearnedLocations(inst); saveStore(inst);
    const leaf = locKey(parts, parts.length - 1);
    if (setCurrent) { inst.currentPos = leaf; inst.path = inst.pathTo(leaf); }
    return leaf;
}

const ABSENT_CUES = /(?:准备|打算|想要?|要去|准备去|打算去|前往|赶往|去找|寻找|寻访|拜访|看望|等待?|等.*回来|听说|据说|传闻|提起|谈起|说起|想到|想起|回忆|记得|梦见|担心|惦记|写信给|传信给|派人找|叫人找|问起|打听|听闻)/;
const PRESENT_CUES = /(?:说|道|问|答|喊|叫|骂|笑|哭|看|瞥|盯|望|点头|摇头|皱眉|开口|伸手|抬手|拍|扶|拉|推|递|接|站|坐|蹲|跪|躺|靠|走来|过来|赶到|来到|进来|出现|凑近|靠近|上前|跟着|跟在|身旁|旁边|面前|身后|身边|眼前|怀里|屋里|院里|门口)/;
const GENERIC_TITLE = /^(?:公子|小姐|少爷|夫人|姑娘|先生|大人|前辈|道友|师兄|师姐|师弟|师妹|掌柜|老板|村长|族长|郎中|医师|船夫|伙计|侍卫|弟子|修士)$/;
const DESC_NAME = /^(?:(?:白|黑|青|红|蓝|灰|紫|绿|黄)衣|粗壮(?:的)?|瘦削(?:的)?|瘦些的|高大(?:的)?|矮小(?:的)?|年轻(?:的)?|年老(?:的)?|受伤的|昏迷的|蒙面(?:的)?|持剑(?:的)?|背刀(?:的)?)(?:男子|汉子|女子|少女|少年|老人|老者|妇人|姑娘|年轻人|青年|修士|剑客)$/;
const SPECIFIC_TITLE = /^(?:[\p{Script=Han}]{1,2}(?:公子|小姐|少爷|夫人|婶|叔|伯|爷|婆|姨|姑|嫂|哥|姐|弟|妹|掌柜|师兄|师姐|师弟|师妹)|老[一二三四五六七八九十\p{Script=Han}])$/u;
const FULL_NAME = /^[\p{Script=Han}]{2,4}$/u;

function sentences(text) { return String(text || '').split(/(?<=[。！？!?；;\n])/).map(x => x.trim()).filter(Boolean); }
function nearby(sentence, name) { const i=sentence.indexOf(name); return i<0 ? '' : sentence.slice(Math.max(0,i-14), i+name.length+16); }
function isAbsent(sentence, name) { const i=sentence.indexOf(name); if(i<0)return true; return ABSENT_CUES.test(sentence.slice(Math.max(0,i-16),i)); }
function isVisible(sentence, name) { return !isAbsent(sentence,name) && PRESENT_CUES.test(nearby(sentence,name)); }
function rankName(name, kind) { if (kind==='name') return 4; if (kind==='specific') return 3; if (kind==='description') return 2; return 1; }

function rawCandidates(inst, text) {
    const out=[]; const add=(name,kind)=>{ name=String(name||'').trim(); if(name.length>=2&&name.length<=10) out.push({name,kind}); };
    for (const x of inst.resolveMentions(text,'character') || []) add(x,'name');
    const patterns=[
        [/[\p{Script=Han}]{1,2}(?:公子|小姐|少爷|夫人|婶|叔|伯|爷|婆|姨|姑|嫂|哥|姐|弟|妹|掌柜|师兄|师姐|师弟|师妹)/gu,'specific'],
        [/老[一二三四五六七八九十]|老[\p{Script=Han}](?=[，。！？!?；;：:\s“”‘’]|说|道|问|答|看|笑|走|来|去|在|站|坐|扶|喊|叫|赶)/gu,'specific'],
        [/(?:(?:白|黑|青|红|蓝|灰|紫|绿|黄)衣|粗壮(?:的)?|瘦削(?:的)?|瘦些的|高大(?:的)?|矮小(?:的)?|年轻(?:的)?|年老(?:的)?|受伤的|昏迷的|蒙面(?:的)?|持剑(?:的)?|背刀(?:的)?)(?:男子|汉子|女子|少女|少年|老人|老者|妇人|姑娘|年轻人|青年|修士|剑客)/gu,'description']
    ];
    for (const [re,kind] of patterns) for (const m of String(text).matchAll(re)) add(m[0],kind);
    // Generic titles are reference clues only; never create an entity by themselves.
    return out.filter(x=>!GENERIC_TITLE.test(x.name));
}

function likelyFullNames(text) {
    const out=[];
    // Full names require strong syntactic evidence; avoid harvesting arbitrary 2-4 Han chunks.
    const re=/(?:名叫|叫作|叫做|姓甚名谁|自报姓名为|自称|唤作|乃是|正是)\s*[“「『]?([\p{Script=Han}]{2,4})[”」』]?/gu;
    for(const m of String(text).matchAll(re)) if(FULL_NAME.test(m[1])&&!GENERIC_TITLE.test(m[1])) out.push(m[1]);
    return uniq(out);
}

function resolveSceneEntities(inst,text) {
    const store=inst.__mapNSceneStore ||= emptyStore(); store.knownCharacters ||= {};
    const cands=rawCandidates(inst,text); for(const n of likelyFullNames(text)) cands.push({name:n,kind:'name'});
    const visible=[];
    for(const c of cands) if(sentences(text).some(s=>s.includes(c.name)&&isVisible(s,c.name))) visible.push({...c,score:rankName(c.name,c.kind)});
    // Alias upgrade inside the current response. Conservative: only merge when a more-specific title/name
    // appears close to a visible descriptive entity or when a title shares the same surname.
    const entities=[];
    for(const c of visible){
        let target=null;
        for(const e of entities){
            const sameSurname = c.kind==='name' && e.name.endsWith('公子') && c.name[0]===e.name[0];
            const upgradeDescription = e.kind==='description' && c.kind==='specific' && text.indexOf(c.name)>text.indexOf(e.name) && Math.abs(text.indexOf(c.name)-text.indexOf(e.name))<180;
            const upgradeSpecific = e.kind==='specific' && c.kind==='name' && e.name[0]===c.name[0];
            if(sameSurname||upgradeDescription||upgradeSpecific){target=e;break;}
        }
        if(!target) entities.push({name:c.name,kind:c.kind,score:c.score,aliases:[c.name]});
        else { target.aliases=uniq([...target.aliases,c.name]); if(c.score>target.score){target.name=c.name;target.kind=c.kind;target.score=c.score;} }
    }
    // Persist only confirmed identity aliases, never generic titles or descriptions as global unique keys.
    for(const e of entities){
        if(e.kind==='name' || e.kind==='specific'){
            const key=e.name; const old=store.knownCharacters[key]||{name:key,aliases:[]}; old.aliases=uniq([...old.aliases,...e.aliases.filter(a=>!DESC_NAME.test(a)&&!GENERIC_TITLE.test(a))]); store.knownCharacters[key]=old;
        }
    }
    saveStore(inst);
    return entities.map(e=>e.name).slice(0,12);
}

function displayName(inst,id){ return inst.nodeMap[id]?.displayName || inst.nodeMap[id]?.id || id; }
function patchDisplay(inst){
    if(inst.__mapNDisplayPatched)return; inst.__mapNDisplayPatched=true;
    const originalRender=inst.render.bind(inst);
    inst.render=function(){ originalRender();
        const pos=this.container?.querySelector?.('#mapN-pos .hl'); if(pos&&this.currentPos) pos.textContent=displayName(this,this.currentPos);
        const bc=this.container?.querySelector?.('#mapN-breadcrumb'); if(bc) for(const el of bc.querySelectorAll('.crumb')){ const id=el.dataset?.id; if(id&&this.nodeMap[id]) el.textContent=displayName(this,id); }
        const label=this.container?.querySelector?.('.mapN-characters .label'); if(label) label.textContent='👤 在场人物：';
    };
}

async function install(){
    for(let i=0;i<100&&!window.MapNInstance;i++) await wait(100);
    const inst=window.MapNInstance; if(!inst||inst.__sceneScanner1100)return; inst.__sceneScanner1100=true;
    inst.__mapNSceneStore=loadStore(inst); mergeLearnedLocations(inst); patchDisplay(inst);
    const originalBuild=inst.build.bind(inst);
    inst.build=function(entries){ originalBuild(entries); mergeLearnedLocations(this); };
    const originalProcess=inst.process.bind(inst);
    inst.process=function(text,isUser=false){
        if(!text)return; const prev=[...(this.currentChars||[])]; originalProcess(text,isUser); mergeLearnedLocations(this);
        if(isUser){ this.currentChars=prev; this.save(); return; }
        const chain=parseHeaderLocation(text); if(chain) learnLocationChain(this,chain,true);
        this.currentChars=resolveSceneEntities(this,text); this.currentChars.forEach(x=>this.encountered.add(x)); this.save();
        if(this.container?.classList.contains('open')) this.render();
    };
    // Historical AI messages learn durable locations; only the latest AI message defines current position/visible people.
    const chat=inst.ctx?.chat||[]; let latestAI=null;
    for(const m of chat){ if(!m?.mes||m.is_user)continue; const chain=parseHeaderLocation(String(m.mes)); if(chain) learnLocationChain(inst,chain,false); latestAI=m; }
    if(latestAI?.mes){ const chain=parseHeaderLocation(String(latestAI.mes)); if(chain) learnLocationChain(inst,chain,true); inst.currentChars=resolveSceneEntities(inst,String(latestAI.mes)); }
    inst.save(); inst.render();
    console.log('[Map-N] scene scanner v1.1.0 installed');
}
install();
