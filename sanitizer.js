// Map-N sanitizer v1.0.0
// Final-pass cleanup for malformed learned locations and obvious person false positives.

const sanitizeWait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = '世界舆图';
const uniq = arr => [...new Set((arr || []).map(x => String(x).trim()).filter(Boolean))];

const TRAILING_CLOSE_ONLY_RE = /^[^（(]*[）)]$/u;
const BAD_PERSON_EXACT_RE = /^(?:东西|洞口|沟口|路口|门口|谷口|村口|镇口|城门|山口|河口|海口|这里|那里|这边|那边|老爷|老爷子|众人|大家)$/u;
const BAD_PERSON_ACTION_RE = /^(?:拐过|走过|穿过|绕过|越过|来到|进入|走进|回到|离开|走出|经过).{1,4}$/u;
const BAD_PERSON_PLACE_END_RE = /(?:沟|洞|洞口|路|路口|谷|谷口|山|岭|崖|滩|洼地|河|湖|海|村|镇|城|屋|院|门口)$/u;

function isBrokenQualifierNode(node) {
    if (!node || node.type !== 'location') return false;
    const label = String(node.displayName || node.id || '').trim();
    // A lone closing parenthesis with no opening mate is a fragment leaked from a parenthetical
    // status qualifier, e.g. "乱石滩)". These must not become standalone map nodes.
    return TRAILING_CLOSE_ONLY_RE.test(label) && !/[（(]/u.test(label);
}

function removeLocationNode(inst, id) {
    const node = inst.nodeMap?.[id];
    if (!node) return false;
    const fallback = node.parent && node.parent !== id ? node.parent : ROOT;

    for (const n of Object.values(inst.nodeMap || {})) {
        if (Array.isArray(n?.children)) n.children = n.children.filter(x => x !== id);
    }
    if (Array.isArray(inst.root?.children)) inst.root.children = inst.root.children.filter(x => x !== id);

    if (inst.alias instanceof Map) {
        for (const [a, target] of [...inst.alias.entries()]) if (target === id) inst.alias.delete(a);
    }
    inst.discovered?.delete?.(id);
    delete inst.nodeMap[id];

    const learned = inst.__mapNSceneStore?.learnedLocations;
    if (learned && typeof learned === 'object') {
        for (const [k, rec] of Object.entries(learned)) {
            if (k === id || rec?.id === id) delete learned[k];
        }
    }

    if (inst.currentPos === id) inst.currentPos = fallback !== ROOT && inst.nodeMap?.[fallback] ? fallback : null;
    if (Array.isArray(inst.path) && inst.path.includes(id)) {
        inst.path = inst.currentPos && inst.nodeMap?.[inst.currentPos] ? inst.pathTo(inst.currentPos) : [ROOT];
    }
    return true;
}

function sanitizeLocations(inst) {
    let changed = false;
    for (const [id, node] of Object.entries({ ...(inst.nodeMap || {}) })) {
        if (isBrokenQualifierNode(node)) changed = removeLocationNode(inst, id) || changed;
    }
    if (changed) {
        try {
            const key = `${inst.memoryKey}:scene-v2`;
            if (inst.__mapNSceneStore) localStorage.setItem(key, JSON.stringify(inst.__mapNSceneStore));
        } catch (e) { console.warn('[Map-N] 地点清理保存失败', e); }
    }
    return changed;
}

function isObviouslyNotPerson(name) {
    const s = String(name || '').trim();
    if (!s) return true;
    if (BAD_PERSON_EXACT_RE.test(s)) return true;
    if (BAD_PERSON_ACTION_RE.test(s)) return true;
    // Place-like words without a strong person marker should not survive as visible characters.
    if (s.length >= 2 && BAD_PERSON_PLACE_END_RE.test(s) && !/^(?:老|小|阿)[\p{Script=Han}]{1,2}$/u.test(s)) return true;
    return false;
}

function sanitizePeople(inst) {
    const before = uniq(inst.currentChars || []);
    const after = before.filter(x => !isObviouslyNotPerson(x));
    if (after.length === before.length) return false;
    inst.currentChars = after;
    const presence = inst.__mapNPresenceState;
    if (presence && Array.isArray(presence.current)) {
        presence.current = uniq(presence.current).filter(x => !isObviouslyNotPerson(x));
        try { localStorage.setItem(`${inst.memoryKey}:presence-v1`, JSON.stringify(presence)); } catch {}
    }
    return true;
}

function sanitizeAll(inst) {
    const a = sanitizeLocations(inst);
    const b = sanitizePeople(inst);
    if (a || b) inst.save?.();
    return a || b;
}

async function installSanitizer() {
    for (let i = 0; i < 120 && !window.MapNInstance; i++) await sanitizeWait(100);
    const inst = window.MapNInstance;
    if (!inst || inst.__mapNSanitizer100) return;
    inst.__mapNSanitizer100 = true;

    // Final wrapper: run after scanner/presence/data-manager so leaked fragments cannot persist.
    const previousProcess = inst.process.bind(inst);
    inst.process = function(text, isUser = false) {
        previousProcess(text, isUser);
        sanitizeAll(this);
        if (this.container?.classList.contains('open')) this.render();
    };

    const previousBuild = inst.build.bind(inst);
    inst.build = function(entries) {
        previousBuild(entries);
        sanitizeLocations(this);
    };

    sanitizeAll(inst);
    inst.render?.();
    console.log('[Map-N] sanitizer v1.0.0 installed');
}

installSanitizer();
