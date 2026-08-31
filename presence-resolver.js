// Map-N presence resolver v1.1.0
// Converts per-message visible-character candidates into an end-of-scene presence state.

const presenceWait = ms => new Promise(r => setTimeout(r, ms));
const presenceUniq = arr => [...new Set((arr || []).map(x => String(x).trim()).filter(Boolean))];
const PRESENCE_VERSION = 2;

const SCENE_MOVE_RE = /(?:你|你们|众人|几人|一行人|两人|三人|大家|他们|她们|一众人|一伙人)[^。！？!?；;\n]{0,20}(?:来到|抵达|到达|进入|走进|赶到|回到|返回|离开|出了|走出|进了|去了|赶往|前往|移步|转到|转入|抬到|扶到|送到|带到|搬到|移到)[^。！？!?；;\n]{0,24}/u;
const SELF_MOVE_RE = /(?:你|我)[^。！？!?；;\n]{0,16}(?:来到|抵达|到达|进入|走进|赶到|回到|返回|离开|出了|走出|进了|去了|赶往|前往|移步|转到|转入)[^。！？!?；;\n]{0,24}/u;
const HARD_TRANSITION_RE = /(?:转眼|不多时|片刻后|一会儿后|随后|之后|待到|等到)[^。！？!?；;\n]{0,12}(?:来到|到了|进入|回到|抵达|赶到|走进|出了|离开)/u;
const EXIT_RE = /(?:离开(?:了)?|走了|走开|离去|离场|退下|退了出去|告辞|转身离开|转身离去|出了门|走出(?:去)?|先回去了|回去了|独自离开|自行离开|被带走|被抬走|被送走)/u;
const ACCOMPANY_RE = /(?:跟着|跟随|随同|随行|同行|一同|一起|陪着|陪同|随着|跟在|扶着|搀着|抬着|背着|抱着|带着)/u;
const ARRIVAL_RE = /(?:赶到|来到|过来|进来|走来|出现|迎出来|迎上来|凑过来|靠过来|跟上|追上|返回|回来)/u;
const STAY_RE = /(?:留下|留在|仍在|还在|守在|站在|坐在|待在|等在|守着|陪着)/u;
const REMOTE_RE = /(?:准备|打算|计划|想要|要去|去找|寻找|拜访|探望|看望|听说|听闻|据说|提起|谈起|想起|回忆|打听|询问)/u;

function presenceStoreKey(inst) { return `${inst.memoryKey}:presence-v1`; }
function emptyPresence() { return { version:PRESENCE_VERSION, current:[], lastLocation:null }; }
function loadPresence(inst) {
    try {
        const d = JSON.parse(localStorage.getItem(presenceStoreKey(inst)) || 'null');
        // v1 may contain false positives produced by the old person parser. Do not carry those
        // across the parser upgrade; the latest AI message is re-evaluated immediately below.
        return d && typeof d === 'object' && d.version === PRESENCE_VERSION ? d : emptyPresence();
    } catch { return emptyPresence(); }
}
function savePresence(inst, state) {
    try { state.version=PRESENCE_VERSION; localStorage.setItem(presenceStoreKey(inst), JSON.stringify(state)); } catch (e) { console.warn('[Map-N] 在场状态保存失败', e); }
}

function headerLocation(text) {
    const head = String(text || '').split(/\n/).slice(0, 6).join('\n');
    const m = head.match(/[【\[]\s*[^|｜】\]\n]{1,60}\s*[|｜]\s*([^】\]\n]+)[】\]]/u);
    return m ? m[1].trim() : null;
}

function segments(text) {
    const src = String(text || '');
    const out = [];
    let start = 0;
    const re = /(?:\n{2,}|(?<=[。！？!?；;]))/gu;
    for (const m of src.matchAll(re)) {
        const end = (m.index || 0) + m[0].length;
        const s = src.slice(start, end).trim();
        if (s) out.push({ text: s, start, end });
        start = end;
    }
    const tail = src.slice(start).trim();
    if (tail) out.push({ text: tail, start, end: src.length });
    return out;
}

function findLastTransition(seg, locationChanged) {
    let idx = locationChanged ? 0 : -1;
    for (let i = 0; i < seg.length; i++) {
        const s = seg[i].text;
        if (SCENE_MOVE_RE.test(s) || SELF_MOVE_RE.test(s) || HARD_TRANSITION_RE.test(s)) idx = i;
    }
    return idx;
}

function localContext(text, name, radius = 22) {
    const i = text.indexOf(name);
    if (i < 0) return '';
    return text.slice(Math.max(0, i - radius), Math.min(text.length, i + name.length + radius));
}

function isExplicitExit(segment, name) {
    if (!segment.includes(name)) return false;
    const ctx = localContext(segment, name, 24);
    return EXIT_RE.test(ctx) && !STAY_RE.test(ctx);
}
function isExplicitArrival(segment, name) {
    if (!segment.includes(name)) return false;
    const ctx = localContext(segment, name, 24);
    return (ARRIVAL_RE.test(ctx) || STAY_RE.test(ctx)) && !REMOTE_RE.test(ctx);
}
function accompaniesTransition(segment, name) {
    if (!segment.includes(name)) return false;
    const ctx = localContext(segment, name, 28);
    return ACCOMPANY_RE.test(ctx) && !REMOTE_RE.test(ctx);
}

function lastMentionIndex(seg, name) {
    for (let i = seg.length - 1; i >= 0; i--) if (seg[i].text.includes(name)) return i;
    return -1;
}

function resolvePresence(inst, text, rawCandidates) {
    const state = inst.__mapNPresenceState ||= loadPresence(inst);
    const prev = presenceUniq(state.current || []);
    const raw = presenceUniq(rawCandidates || []);
    const seg = segments(text);
    const loc = headerLocation(text);
    const locationChanged = !!(loc && state.lastLocation && loc !== state.lastLocation);
    const transition = findLastTransition(seg, locationChanged);

    let present = new Set(prev);

    if (transition >= 0) {
        const inherited = new Set();
        const transitionText = seg[transition]?.text || '';
        for (const name of prev) {
            if (accompaniesTransition(transitionText, name)) inherited.add(name);
        }
        present = inherited;

        for (const name of raw) {
            const last = lastMentionIndex(seg, name);
            if (last >= transition) present.add(name);
        }
    } else {
        for (const name of raw) present.add(name);
    }

    for (const part of seg) {
        const allNames = presenceUniq([...present, ...raw]);
        for (const name of allNames) {
            if (!part.text.includes(name)) continue;
            if (isExplicitArrival(part.text, name)) present.add(name);
            if (isExplicitExit(part.text, name)) present.delete(name);
        }
    }

    if (transition >= 0) {
        for (const name of [...present]) {
            const last = lastMentionIndex(seg, name);
            if (last >= 0 && last < transition && !accompaniesTransition(seg[transition]?.text || '', name)) present.delete(name);
        }
    }

    state.version = PRESENCE_VERSION;
    state.current = presenceUniq([...present]).slice(0, 12);
    if (loc) state.lastLocation = loc;
    savePresence(inst, state);
    return state.current;
}

function resetPresence(inst) {
    inst.__mapNPresenceState = emptyPresence();
    savePresence(inst, inst.__mapNPresenceState);
}

async function installPresenceResolver() {
    for (let i = 0; i < 120 && !window.MapNInstance; i++) await presenceWait(100);
    const inst = window.MapNInstance;
    if (!inst || inst.__mapNPresenceResolver110) return;

    for (let i = 0; i < 80 && !inst.__sceneScanner120; i++) await presenceWait(100);
    if (inst.__mapNPresenceResolver110) return;
    inst.__mapNPresenceResolver110 = true;
    inst.__mapNPresenceState = loadPresence(inst);

    const previousProcess = inst.process.bind(inst);
    inst.process = function(text, isUser = false) {
        const before = [...(this.currentChars || [])];
        previousProcess(text, isUser);
        if (isUser || !text) {
            this.currentChars = isUser ? before : this.currentChars;
            return;
        }
        const raw = [...(this.currentChars || [])];
        this.currentChars = resolvePresence(this, String(text), raw);
        this.currentChars.forEach(x => this.encountered.add(x));
        this.save();
        if (this.container?.classList.contains('open')) this.render();
    };

    const chat = inst.ctx?.chat || [];
    let latest = null;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i]?.mes && !chat[i].is_user) { latest = chat[i]; break; }
    }
    if (latest?.mes) {
        const raw = [...(inst.currentChars || [])];
        inst.currentChars = resolvePresence(inst, String(latest.mes), raw);
        inst.save();
        inst.render();
    }

    const es = inst.ctx?.eventSource;
    const et = inst.ctx?.eventTypes || inst.ctx?.event_types;
    if (es && et) {
        const clear = () => resetPresence(inst);
        if (et.CHAT_CHANGED) es.on(et.CHAT_CHANGED, clear);
        if (et.CHARACTER_SELECTED) es.on(et.CHARACTER_SELECTED, clear);
    }

    console.log('[Map-N] presence resolver v1.1.0 installed');
}

installPresenceResolver();
