// Map-N scene scanner v1.0.10
// Structured location headers + conservative PRESENT-character tracking.

const wait = ms => new Promise(r => setTimeout(r, ms));
const uniq = arr => [...new Set((arr || []).map(x => String(x).trim()).filter(Boolean))];

function parseHeaderLocation(text) {
    const head = String(text || '').split(/\n/).slice(0, 6).join('\n');
    const m = head.match(/[【\[]\s*[^】\]\n]*?\|\s*([^】\]\n]+)[】\]]/);
    if (!m) return null;
    const parts = m[1].trim().split(/\s*[·•›>→/／]+\s*/).map(x => x.trim()).filter(x => x.length >= 2);
    return parts.length ? parts : null;
}

function ensureLocation(inst, id, parent) {
    id = String(id || '').trim();
    if (!id) return null;
    if (!inst.nodeMap[id]) {
        inst.nodeMap[id] = { id, aliases:[id], content:'剧情中识别的地点', type:'location', children:[], parent:parent || '世界舆图', isWater:/海|河|湖|江|溪|潭|湾|岸|滩/.test(id), isMountain:/山|峰|岭|崖|谷/.test(id) };
    }
    const node = inst.nodeMap[id];
    if (node.type !== 'location') return null;
    node.parent = parent || node.parent || '世界舆图';
    node.children ||= []; node.aliases ||= [id];
    inst.alias.set(id, id); inst.discovered.add(id);
    return id;
}

function learnLocationChain(inst, parts) {
    let parent = '世界舆图';
    for (const id of parts) {
        ensureLocation(inst, id, parent);
        if (parent === '世界舆图') { inst.root.children ||= []; if (!inst.root.children.includes(id)) inst.root.children.push(id); }
        else if (inst.nodeMap[parent]) { const kids = inst.nodeMap[parent].children ||= []; if (!kids.includes(id)) kids.push(id); }
        parent = id;
    }
    const leaf = parts.at(-1);
    inst.currentPos = leaf;
    inst.path = inst.pathTo(leaf);
    return leaf;
}

const ABSENT_CUES = /(?:准备|打算|想要?|要去|准备去|打算去|前往|赶往|去找|寻找|寻访|拜访|看望|等(?:待)?|等.*回来|听说|据说|传闻|提起|谈起|说起|想到|想起|回忆|记得|梦见|担心|惦记|写信给|传信给|派人找|叫人找|问起|打听|听闻)/;
const LEAVE_CUES = /(?:离开|走了|走远|告辞|退下|转身离去|转身走|出了门|出门去了|回家|回去了|赶往|前往|去了)/;
const PRESENT_CUES = /(?:说|道|问|答|喊|叫|骂|笑|哭|看(?:了|着)?|瞥|盯|望|点头|摇头|皱眉|开口|闭嘴|伸手|抬手|拍|扶|拉|推|递|接|站|坐|蹲|跪|躺|靠|走来|过来|赶到|来到|进来|出现|凑近|靠近|上前|跟着|跟在|身旁|旁边|面前|身后|身边|眼前|怀里|屋里|院里|门口)/;
const BAD_END = /(?:家|屋|房|门|话|事|声|手|头|脸|身|边|旁|处|那里|这边|那边)$/;

function sentences(text) { return String(text || '').split(/(?<=[。！？!?；;\n])/).map(x => x.trim()).filter(Boolean); }

function cleanName(raw) {
    let s = String(raw || '').replace(/[“”‘’"'，。！？!?；;：:\s]/g, '').trim();
    s = s.replace(/^(?:看|望|问|叫|喊|找|等|跟|向|朝|对|和|与|同|让|把|被|给|替|帮|听|见|见到|看到|瞧见|发现)+/, '');
    s = s.replace(/(?:赶到|赶来|走来|过来|来到|说道|说|道|问道|问|答道|答|开口|点头|摇头|笑道|笑|皱眉|看着|看了|看|望着|望|离开|走了|回去|回来|在|去)$/g, '');
    if (s.length < 2 || s.length > 8 || BAD_END.test(s)) return null;
    return s;
}

function candidateNames(inst, text) {
    const out = [];
    // World-book character aliases are high-quality candidates, but still need presence evidence.
    for (const x of inst.resolveMentions(text, 'character') || []) out.push(x);
    const patterns = [
        /老[一二三四五六七八九十]|老[\p{Script=Han}](?=[，。！？!?；;：:\s“”‘’]|(?:说|道|问|答|看|笑|走|来|去|在|站|坐|蹲|扶|拉|喊|叫|皱|点|摇|赶|开))/gu,
        /[\p{Script=Han}]{1,2}(?:婶|叔|伯|爷|婆|姨|姑|嫂|哥|姐|弟|妹)(?=[，。！？!?；;：:\s“”‘’]|(?:说|道|问|答|看|笑|走|来|去|在|站|坐|蹲|扶|拉|喊|叫|皱|点|摇|赶|开))/gu,
        /(?:村长|族长|掌柜|老板|师父|郎中|医师|船夫|伙计|侍卫|弟子|修士)(?:老?[\p{Script=Han}]{1,2})?/gu,
        /(?:粗壮(?:的)?|瘦削(?:的)?|瘦些的|高大(?:的)?|矮小(?:的)?|年轻(?:的)?|年老(?:的)?|受伤的|昏迷的)?(?:汉子|男子|女子|少女|少年|老人|老者|妇人|姑娘|年轻人|青年|孩童|孩子)/gu
    ];
    for (const re of patterns) for (const m of String(text).matchAll(re)) { const n = cleanName(m[0]); if (n) out.push(n); }
    return uniq(out);
}

function hasAbsentContext(sentence, name) {
    const i = sentence.indexOf(name); if (i < 0) return false;
    const left = sentence.slice(Math.max(0, i - 14), i);
    const right = sentence.slice(i + name.length, i + name.length + 12);
    return ABSENT_CUES.test(left) || /(?:家|住处|那里|那边)/.test(right.slice(0,4));
}

function hasPresentContext(sentence, name) {
    const i = sentence.indexOf(name); if (i < 0) return false;
    const left = sentence.slice(Math.max(0, i - 10), i);
    const right = sentence.slice(i + name.length, i + name.length + 14);
    if (hasAbsentContext(sentence, name)) return false;
    // Direct speech/action around the candidate or explicit spatial co-presence.
    return PRESENT_CUES.test(right) || /(?:身旁|旁边|面前|身后|身边|眼前|跟着|跟在|同你|与你|和你)/.test(left + right);
}

function scanPresentCharacters(inst, text) {
    const present = new Set();
    const candidates = candidateNames(inst, text);
    for (const s of sentences(text)) {
        for (const name of candidates) {
            if (!s.includes(name)) continue;
            if (hasPresentContext(s, name)) present.add(name);
            if (LEAVE_CUES.test(s.slice(s.indexOf(name) + name.length))) present.delete(name);
        }
    }
    return [...present].slice(0, 12);
}

function relabel(inst) {
    const el = inst.container?.querySelector?.('.mapN-characters .label');
    if (el) el.textContent = '👤 在场人物：';
}

async function install() {
    for (let i = 0; i < 100 && !window.MapNInstance; i++) await wait(100);
    const inst = window.MapNInstance;
    if (!inst || inst.__sceneScanner110) return;
    inst.__sceneScanner110 = true;
    const originalProcess = inst.process.bind(inst);
    inst.process = function(text, isUser = false) {
        if (!text) return;
        const previousChars = [...(this.currentChars || [])];
        originalProcess(text, isUser);
        if (isUser) { this.currentChars = previousChars; this.save(); return; }
        const chain = parseHeaderLocation(text);
        if (chain) learnLocationChain(this, chain);
        this.currentChars = scanPresentCharacters(this, text);
        this.currentChars.forEach(x => this.encountered.add(x));
        this.save();
        if (this.container?.classList.contains('open')) { this.render(); relabel(this); }
    };
    const chat = inst.ctx?.chat || [];
    for (const m of chat) if (m?.mes) inst.process(String(m.mes), !!m.is_user);
    inst.render(); relabel(inst);
    console.log('[Map-N] scene scanner v1.0.10 installed');
}
install();
