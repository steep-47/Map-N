// Map-N canonicalizer v1.0.0
// Canonicalizes malformed entity keys at ingestion instead of deleting nodes after the fact.

const canonWait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = '世界舆图';
const canonUniq = arr => [...new Set((arr || []).map(x => String(x).trim()).filter(Boolean))];

function stripDanglingBrackets(value) {
    let s = String(value || '').trim();
    // Repair generation fragments such as "乱石滩)" / "铁线草洼地）".
    // Only remove an unmatched closer; balanced parentheses remain meaningful text.
    while (/[）)]$/u.test(s)) {
        const opens = (s.match(/[（(]/gu) || []).length;
        const closes = (s.match(/[）)]/gu) || []).length;
        if (closes <= opens) break;
        s = s.slice(0, -1).trim();
    }
    while (/^[（(]/u.test(s)) {
        const opens = (s.match(/[（(]/gu) || []).length;
        const closes = (s.match(/[）)]/gu) || []).length;
        if (opens <= closes) break;
        s = s.slice(1).trim();
    }
    return s;
}

function canonicalWorldKey(value) {
    return stripDanglingBrackets(String(value || '').replace(/^[\s,，;；:：]+|[\s,，;；:：]+$/gu, '')).trim();
}

function normalizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    const clone = { ...entry };
    if (Array.isArray(entry.key)) clone.key = canonUniq(entry.key.map(canonicalWorldKey)).filter(x => x.length >= 2);
    if (Array.isArray(entry.keys)) clone.keys = canonUniq(entry.keys.map(canonicalWorldKey)).filter(x => x.length >= 2);
    return clone;
}

function migrateRuntimeIds(inst) {
    const fix = id => id === ROOT ? ROOT : canonicalWorldKey(id);
    if (inst.discovered instanceof Set) inst.discovered = new Set([...inst.discovered].map(fix).filter(Boolean));
    inst.discovered?.add?.(ROOT);
    if (inst.currentPos) inst.currentPos = fix(inst.currentPos);
    if (Array.isArray(inst.path)) inst.path = canonUniq(inst.path.map(fix).filter(Boolean));
    if (!inst.path?.length || inst.path[0] !== ROOT) inst.path = [ROOT];
}

async function installCanonicalizer() {
    for (let i = 0; i < 120 && !window.MapNInstance; i++) await canonWait(50);
    const inst = window.MapNInstance;
    if (!inst || inst.__mapNCanonicalizer100) return;
    inst.__mapNCanonicalizer100 = true;

    const originalEntryKeys = inst.entryKeys.bind(inst);
    inst.entryKeys = function(entry) {
        return canonUniq(originalEntryKeys(normalizeEntry(entry)).map(canonicalWorldKey)).filter(x => x.length >= 2);
    };

    const originalBuild = inst.build.bind(inst);
    inst.build = function(entries) {
        migrateRuntimeIds(this);
        const normalized = (entries || []).map(normalizeEntry);
        originalBuild(normalized);
        migrateRuntimeIds(this);
    };

    // Rebuild once if Map-N already consumed worldbook entries before this patch attached.
    if (Array.isArray(inst.entries) && inst.entries.length) {
        const snapshot = inst.entries.map(normalizeEntry);
        inst.entries = snapshot;
        inst.build(snapshot);
        inst.save?.();
        inst.render?.();
    }

    console.log('[Map-N] canonicalizer v1.0.0 installed');
}

installCanonicalizer();
