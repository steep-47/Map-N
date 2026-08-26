// Map-N geographic hierarchy resolver v1.0.0
// Reconciles parent/child geography after the core worldbook parser has built nodes.

const MAPN_ROOT = '世界舆图';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const rxEscape = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unique = arr => [...new Set((arr || []).filter(Boolean))];

function locationNodes(inst) {
    return Object.values(inst.nodeMap || {}).filter(n => n?.type === 'location');
}

function aliasesOf(node) {
    return unique([node?.displayName, node?.id, ...(node?.aliases || [])])
        .map(x => String(x || '').trim())
        .filter(x => x.length >= 2)
        .sort((a, b) => b.length - a.length);
}

function relationScore(child, parent) {
    if (!child || !parent || child === parent) return 0;
    const cc = String(child.content || '');
    const pc = String(parent.content || '');
    let best = 0;

    for (const parentName of aliasesOf(parent)) {
        const p = rxEscape(parentName);

        // Child -> parent statements: "A 属于/位于 B", "A 是 B 中的一片区域".
        const childToParent = [
            new RegExp(`(?:位于|地处|坐落(?:于|在)?|处于|处在|隶属(?:于)?|属于|归属(?:于)?|划归|辖于|纳入)\\s*[^。；;，,]{0,20}${p}(?:境内|区域|地区|海域|范围|之中|以内|内|中)?`),
            new RegExp(`(?:是|为)\\s*${p}(?:之中|之内|中|内|境内|海域内|区域内)?(?:的)?\\s*(?:一片|一处|一个|其中)?[^。；;，,]{0,12}(?:区域|地区|海域|地带|部分|组成部分|辖区|地点)`),
            new RegExp(`${p}(?:之中|之内|中|内|境内|海域内|区域内)(?:的)?\\s*(?:一片|一处|一个|其中)?[^。；;，,]{0,12}(?:区域|地区|海域|地带|部分|地点)`)
        ];
        if (childToParent.some(re => re.test(cc))) best = Math.max(best, 5);

        // A weaker but still useful possessive/containment statement in the child's own entry.
        if (new RegExp(`${p}[^。；;]{0,16}(?:下辖|辖下|范围内|内部|其中)`).test(cc)) best = Math.max(best, 3);
    }

    // Parent -> child statements: "B 包含 A", "B 下辖 A", "B 由 A、C 构成".
    for (const childName of aliasesOf(child)) {
        const c = rxEscape(childName);
        const parentToChild = [
            new RegExp(`(?:包括|包含|涵盖|下辖|辖有|管辖|拥有|设有|分为)[^。；;]{0,28}${c}`),
            new RegExp(`(?:由|主要由)[^。；;]{0,36}${c}[^。；;]{0,36}(?:组成|构成)`),
            new RegExp(`(?:境内|区域内|海域内|其中|其内)[^。；;]{0,20}(?:有|分布着|分布有|包括)[^。；;]{0,24}${c}`)
        ];
        if (parentToChild.some(re => re.test(pc))) best = Math.max(best, 4);
    }

    return best;
}

function wouldCycle(inst, childId, parentId) {
    let x = parentId;
    const seen = new Set();
    while (x && x !== MAPN_ROOT && !seen.has(x)) {
        if (x === childId) return true;
        seen.add(x);
        x = inst.nodeMap?.[x]?.parent;
    }
    return false;
}

function rebuildChildren(inst) {
    const nodes = locationNodes(inst);
    inst.root ||= { id: MAPN_ROOT, children: [], parent: null };
    inst.root.children = [];
    for (const n of nodes) n.children = [];

    for (const n of nodes) {
        const p = n.parent;
        if (p && p !== MAPN_ROOT && inst.nodeMap?.[p]?.type === 'location' && !wouldCycle(inst, n.id, p)) {
            inst.nodeMap[p].children.push(n.id);
        } else {
            n.parent = MAPN_ROOT;
            inst.root.children.push(n.id);
        }
    }

    for (const n of nodes) n.children = unique(n.children).sort((a,b) => String(a).localeCompare(String(b), 'zh-CN'));
    inst.root.children = unique(inst.root.children).sort((a,b) => String(a).localeCompare(String(b), 'zh-CN'));
}

function reconcileHierarchy(inst) {
    const nodes = locationNodes(inst);
    if (!nodes.length) return 0;
    let changed = 0;

    for (const child of nodes) {
        // Scene-header learned chains already contain explicit structural evidence; preserve them.
        if (child.learned && child.parent && child.parent !== MAPN_ROOT) continue;

        let best = null;
        for (const parent of nodes) {
            if (parent === child) continue;
            const score = relationScore(child, parent);
            if (!score || wouldCycle(inst, child.id, parent.id)) continue;
            if (!best || score > best.score || (score === best.score && aliasesOf(parent)[0]?.length > aliasesOf(best.parent)[0]?.length)) {
                best = { parent, score };
            }
        }

        // Require reasonably explicit evidence. Do not infer hierarchy from mere co-occurrence.
        if (best && best.score >= 4 && child.parent !== best.parent.id) {
            child.parent = best.parent.id;
            changed++;
        }
    }

    if (changed) {
        rebuildChildren(inst);
        if (inst.currentPos && inst.nodeMap?.[inst.currentPos]) inst.path = inst.pathTo(inst.currentPos);
        inst.save?.();
    }
    return changed;
}

async function installHierarchyResolver() {
    for (let i = 0; i < 100 && !window.MapNInstance; i++) await delay(100);
    const inst = window.MapNInstance;
    if (!inst || inst.__mapNHierarchyResolver) return;
    inst.__mapNHierarchyResolver = true;

    const previousBuild = inst.build.bind(inst);
    inst.build = function(entries) {
        previousBuild(entries);
        reconcileHierarchy(this);
    };

    const changed = reconcileHierarchy(inst);
    if (changed && inst.container?.classList.contains('open')) inst.render();
    console.log(`[Map-N] hierarchy resolver installed; corrected ${changed} relation(s).`);
}

installHierarchyResolver();
