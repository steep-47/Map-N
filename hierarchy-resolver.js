// Map-N geographic hierarchy resolver v1.1.0
// Canonicalize worldbook geography first, then infer hierarchy from both local and global relation text.

const MAPN_ROOT = '世界舆图';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const rxEscape = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unique = arr => [...new Set((arr || []).filter(Boolean))];
const GEO_SUFFIX_RE = /(?:城|镇|村|寨|庄|港|岛|洲|州|郡|府|县|国|域|界|海|河|江|湖|湾|溪|潭|山|峰|岭|谷|原|林|泽|关|隘|堡|宫|殿|寺|观|塔|洞|窟|坊|街|巷|桥|渡|码头|营地|遗迹|秘境|禁地|宗|门|海域|山系)$/;
const GENERIC_COMMENT_RE = /^(?:世界板块总览|世界主要板块|地图|世界地图|天下诸地|区域关系|空间关系|世界关系|地理关系)$/;
const GENERIC_ALIAS_RE = /^(?:北方海域|南方海域|东方海域|西方海域|未知区域|未知海域|远海|近海|区域|地区|地点|海域|城镇|村落|板块|地图|大陆)$/;

function rawKeys(entry) {
    return unique([...(Array.isArray(entry?.key) ? entry.key : []), ...(Array.isArray(entry?.keys) ? entry.keys : [])]
        .map(x => String(x || '').trim()).filter(Boolean));
}
function splitKeyTerms(entry) {
    const out = [];
    for (const raw of rawKeys(entry)) {
        for (const part of raw.split(/[，,、；;|｜\n\r]+/)) {
            const s = part.trim();
            if (s.length >= 2 && s.length <= 24 && !/\s{2,}/.test(s)) out.push(s);
        }
    }
    return unique(out);
}
function canonicalFromEntry(inst, entry) {
    const content = String(entry?.content || '');
    const comment = String(entry?.comment || '').trim();
    if (comment && comment.length >= 2 && comment.length <= 24 && !GENERIC_COMMENT_RE.test(comment) && inst.classify?.(comment, content) === 'location') return comment;
    const terms = splitKeyTerms(entry).filter(x => !GENERIC_ALIAS_RE.test(x));
    for (const t of terms) if (GEO_SUFFIX_RE.test(t) && inst.classify?.(t, content) === 'location') return t;
    return null;
}
function locationNodes(inst) { return Object.values(inst.nodeMap || {}).filter(n => n?.type === 'location'); }
function aliasesOf(node) {
    return unique([node?.displayName, node?.id, ...(node?.aliases || [])])
        .map(x => String(x || '').trim()).filter(x => x.length >= 2).sort((a,b) => b.length - a.length);
}

function normalizeWorldbookGeography(inst) {
    const entries = Array.isArray(inst.entries) ? inst.entries : [];
    if (!entries.length) return 0;
    const canonicalEntries = [];
    const canonicalNames = new Set();
    for (const e of entries) {
        const name = canonicalFromEntry(inst, e);
        if (!name) continue;
        canonicalEntries.push({ entry:e, name }); canonicalNames.add(name);
    }
    let changed = 0;
    for (const {entry,name} of canonicalEntries) {
        const content = String(entry.content || '');
        const terms = splitKeyTerms(entry).filter(x => !GENERIC_ALIAS_RE.test(x));
        const aliases = unique([name, ...terms.filter(x => !canonicalNames.has(x) || x === name)]);
        let node = inst.nodeMap?.[name];
        if (!node) {
            node = { id:name, displayName:name, aliases:[...aliases], content, type:'location', children:[], parent:null,
                isWater:/海|河|湖|江|溪|潭|湾|水域|水库/.test(name+content), isMountain:/山|峰|岭|山脉|丘陵|崖|谷/.test(name+content) };
            inst.nodeMap[name] = node; changed++;
        } else {
            node.displayName = name;
            node.aliases = unique([...(node.aliases || []), ...aliases]);
            if (!node.content || node.content === '剧情中确认的地点') node.content = content;
        }
        // Remove malformed core nodes created from a composite trigger key of this same entry.
        for (const raw of rawKeys(entry)) {
            if (raw === name) continue;
            const bad = inst.nodeMap?.[raw];
            if (bad?.type === 'location' && String(bad.content || '') === content) {
                if (bad.parent && bad.parent !== MAPN_ROOT && inst.nodeMap?.[bad.parent]) inst.nodeMap[bad.parent].children = (inst.nodeMap[bad.parent].children || []).filter(x => x !== raw);
                delete inst.nodeMap[raw]; changed++;
            }
        }
    }
    // Rebuild aliases after canonicalization. A canonical place name always wins over being another entry's trigger alias.
    inst.alias = new Map();
    for (const n of Object.values(inst.nodeMap || {})) {
        if (!n?.aliases) continue;
        for (const a of unique([n.id, n.displayName, ...n.aliases])) {
            const s = String(a || '').trim();
            if (!s || (canonicalNames.has(s) && s !== n.id)) continue;
            if (!inst.alias.has(s)) inst.alias.set(s, n.id);
        }
    }
    for (const name of canonicalNames) if (inst.nodeMap?.[name]) inst.alias.set(name, name);
    return changed;
}

function globalCorpus(inst) {
    return (inst.entries || []).map(e => String(e?.content || '')).filter(Boolean).join('\n');
}
function relationScore(inst, child, parent) {
    if (!child || !parent || child === parent) return 0;
    const cc = String(child.content || ''), pc = String(parent.content || ''), all = globalCorpus(inst);
    let best = 0;
    for (const parentName of aliasesOf(parent)) {
        const p = rxEscape(parentName);
        const local = [
            new RegExp(`(?:位于|地处|坐落(?:于|在)?|处于|处在|隶属(?:于)?|属于|归属(?:于)?|划归|辖于|纳入)\\s*[^。；;，,]{0,20}${p}(?:境内|区域|地区|海域|范围|之中|以内|内|中)?`),
            new RegExp(`(?:是|为)\\s*${p}(?:之中|之内|中|内|境内|海域内|区域内)?(?:的)?\\s*(?:一片|一处|一个|其中)?[^。；;，,]{0,12}(?:区域|地区|海域|地带|部分|组成部分|辖区|地点)`),
            new RegExp(`${p}(?:之中|之内|中|内|境内|海域内|区域内)(?:的)?\\s*(?:一片|一处|一个|其中)?[^。；;，,]{0,12}(?:区域|地区|海域|地带|部分|地点)`)
        ];
        if (local.some(re => re.test(cc))) best = Math.max(best, 6);
        for (const childName of aliasesOf(child)) {
            const c = rxEscape(childName);
            const globalDirect = [
                new RegExp(`${c}[^。；;]{0,10}(?:隶属(?:于)?|属于|归属(?:于)?|划归|辖于|位于|处于|在)\\s*[^。；;]{0,12}${p}(?:境内|地区|区域|海域|之中|内|中)?`),
                new RegExp(`${p}[^。；;]{0,12}(?:包括|包含|涵盖|下辖|辖有|管辖|拥有|设有)[^。；;]{0,20}${c}`),
                new RegExp(`(?:包括|包含|涵盖|下辖|辖有|管辖|拥有|设有)[^。；;]{0,20}${c}[^。；;]{0,16}(?:属于|位于)?[^。；;]{0,10}${p}`)
            ];
            if (globalDirect.some(re => re.test(all))) best = Math.max(best, 7);
        }
    }
    for (const childName of aliasesOf(child)) {
        const c = rxEscape(childName);
        const parentLocal = [
            new RegExp(`(?:包括|包含|涵盖|下辖|辖有|管辖|拥有|设有|分为)[^。；;]{0,28}${c}`),
            new RegExp(`(?:由|主要由)[^。；;]{0,36}${c}[^。；;]{0,36}(?:组成|构成)`),
            new RegExp(`(?:境内|区域内|海域内|其中|其内)[^。；;]{0,20}(?:有|分布着|分布有|包括)[^。；;]{0,24}${c}`)
        ];
        if (parentLocal.some(re => re.test(pc))) best = Math.max(best, 5);
    }
    return best;
}
function wouldCycle(inst, childId, parentId) {
    let x=parentId; const seen=new Set();
    while(x && x!==MAPN_ROOT && !seen.has(x)){ if(x===childId)return true; seen.add(x); x=inst.nodeMap?.[x]?.parent; }
    return false;
}
function rebuildChildren(inst) {
    const nodes=locationNodes(inst); inst.root ||= {id:MAPN_ROOT,children:[],parent:null}; inst.root.children=[];
    for(const n of nodes)n.children=[];
    for(const n of nodes){const p=n.parent;if(p&&p!==MAPN_ROOT&&inst.nodeMap?.[p]?.type==='location'&&!wouldCycle(inst,n.id,p))inst.nodeMap[p].children.push(n.id);else{n.parent=MAPN_ROOT;inst.root.children.push(n.id);}}
    for(const n of nodes)n.children=unique(n.children).sort((a,b)=>String(a).localeCompare(String(b),'zh-CN'));
    inst.root.children=unique(inst.root.children).sort((a,b)=>String(a).localeCompare(String(b),'zh-CN'));
}
function reconcileHierarchy(inst) {
    const normalized=normalizeWorldbookGeography(inst); const nodes=locationNodes(inst); if(!nodes.length)return normalized;
    let changed=normalized;
    for(const child of nodes){
        if(child.learned&&child.parent&&child.parent!==MAPN_ROOT)continue;
        let best=null;
        for(const parent of nodes){if(parent===child)continue;const score=relationScore(inst,child,parent);if(!score||wouldCycle(inst,child.id,parent.id))continue;if(!best||score>best.score||(score===best.score&&aliasesOf(parent)[0]?.length>aliasesOf(best.parent)[0]?.length))best={parent,score};}
        if(best&&best.score>=5&&child.parent!==best.parent.id){child.parent=best.parent.id;changed++;}
    }
    if(changed){rebuildChildren(inst);if(inst.currentPos&&inst.nodeMap?.[inst.currentPos])inst.path=inst.pathTo(inst.currentPos);inst.save?.();}
    return changed;
}
async function installHierarchyResolver(){
    for(let i=0;i<100&&!window.MapNInstance;i++)await delay(100);const inst=window.MapNInstance;if(!inst||inst.__mapNHierarchyResolver110)return;inst.__mapNHierarchyResolver110=true;
    const previousBuild=inst.build.bind(inst);inst.build=function(entries){previousBuild(entries);reconcileHierarchy(this);};
    const changed=reconcileHierarchy(inst);if(changed&&inst.container?.classList.contains('open'))inst.render();
    console.log(`[Map-N] hierarchy resolver v1.1.0 installed; normalized/corrected ${changed} item(s).`);
}
installHierarchyResolver();
