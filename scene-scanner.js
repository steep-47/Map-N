// Map-N scene scanner v1.0.9
// Adds structured location-header parsing and lightweight scene-character extraction.

const wait = ms => new Promise(r => setTimeout(r, ms));
const uniq = arr => [...new Set((arr || []).map(x => String(x).trim()).filter(Boolean))];

function parseHeaderLocation(text) {
    const head = String(text || '').split(/\n/).slice(0, 4).join('\n');
    const m = head.match(/[【\[]\s*[^】\]\n]*?\|\s*([^】\]\n]+)[】\]]/);
    if (!m) return null;
    const parts = m[1].trim().split(/\s*[·•›>→/／]+\s*/).map(x => x.trim()).filter(x => x.length >= 2);
    return parts.length ? parts : null;
}

function ensureLocation(inst, id, parent) {
    id = String(id || '').trim();
    if (!id) return null;
    if (!inst.nodeMap[id]) {
        inst.nodeMap[id] = {
            id,
            aliases: [id],
            content: '剧情中识别的地点',
            type: 'location',
            children: [],
            parent: parent || '世界舆图',
            isWater: /海|河|湖|江|溪|潭|湾|岸|滩/.test(id),
            isMountain: /山|峰|岭|崖|谷/.test(id),
        };
    }
    const node = inst.nodeMap[id];
    if (node.type !== 'location') return null;
    node.parent = parent || node.parent || '世界舆图';
    node.children ||= [];
    node.aliases ||= [id];
    inst.alias.set(id, id);
    inst.discovered.add(id);
    return id;
}

function learnLocationChain(inst, parts) {
    let parent = '世界舆图';
    for (const id of parts) {
        ensureLocation(inst, id, parent);
        if (parent === '世界舆图') {
            inst.root.children ||= [];
            if (!inst.root.children.includes(id)) inst.root.children.push(id);
        } else if (inst.nodeMap[parent]) {
            const kids = inst.nodeMap[parent].children ||= [];
            if (!kids.includes(id)) kids.push(id);
        }
        parent = id;
    }
    const leaf = parts.at(-1);
    inst.currentPos = leaf;
    inst.path = inst.pathTo(leaf);
    return leaf;
}

function scanCharacters(inst, text) {
    const found = inst.resolveMentions(text, 'character');
    const add = value => {
        let s = String(value || '').replace(/^[，。、“”‘’：:\s]+|[，。、“”‘’：:\s]+$/g, '').trim();
        if (s.length >= 2 && s.length <= 8 && !found.includes(s)) found.push(s);
    };

    // Common Chinese informal names/titles: 老五、老刘、桂婶、周叔 etc.
    for (const m of text.matchAll(/老[一二三四五六七八九十\p{Script=Han}]{1,2}/gu)) add(m[0]);
    for (const m of text.matchAll(/[\p{Script=Han}]{1,3}(?:婶|叔|伯|爷|婆)/gu)) add(m[0]);
    for (const m of text.matchAll(/(?:村长|族长|掌柜|老板|师父|师兄|师姐|师弟|师妹)老?[\p{Script=Han}]{1,3}/gu)) add(m[0]);

    // Unnamed but scene-relevant people.
    for (const m of text.matchAll(/(?:粗壮|瘦削|瘦些的|高大|矮小|年轻|年老|受伤的|昏迷的)?(?:汉子|男子|女子|少女|少年|老人|老者|妇人|姑娘|年轻人|青年|孩童|孩子)/gu)) add(m[0]);
    for (const m of text.matchAll(/(?:药铺|客栈|酒楼|码头|村里)?(?:伙计|郎中|医师|船夫|渔民|猎户|士兵|侍卫|弟子|修士)/gu)) add(m[0]);

    return uniq(found).slice(0, 12);
}

async function install() {
    for (let i = 0; i < 100 && !window.MapNInstance; i++) await wait(100);
    const inst = window.MapNInstance;
    if (!inst || inst.__sceneScanner109) return;
    inst.__sceneScanner109 = true;

    const originalProcess = inst.process.bind(inst);
    inst.process = function (text, isUser = false) {
        if (!text) return;

        // Keep the core's normal location discovery, but never let a user message
        // become the final source of current scene characters.
        const previousChars = [...(this.currentChars || [])];
        originalProcess(text, isUser);
        if (isUser) {
            this.currentChars = previousChars;
            this.save();
            return;
        }

        // Structured header is authoritative for current position.
        const chain = parseHeaderLocation(text);
        if (chain) learnLocationChain(this, chain);

        // Scene characters combine world-book aliases with names/titles in prose.
        this.currentChars = scanCharacters(this, text);
        this.currentChars.forEach(x => this.encountered.add(x));
        this.save();
        if (this.container?.classList.contains('open')) this.render();
    };

    // Re-scan existing history once with the enhanced rules.
    const chat = inst.ctx?.chat || [];
    for (const m of chat) if (m?.mes) inst.process(String(m.mes), !!m.is_user);
    inst.render();
    console.log('[Map-N] scene scanner v1.0.9 installed');
}

install();
