// Map-N strict entity resolver v1.0.1
// Re-parses visible people from positive evidence instead of deleting false positives afterward.

const entityWait = ms => new Promise(r => setTimeout(r, ms));
const entityUniq = arr => [...new Set((arr || []).map(x => String(x).trim()).filter(Boolean))];

const ACTION = '(?:说|道|问|答|喊|叫|笑|哭|看|瞥|盯|望|点头|摇头|皱眉|开口|伸手|抬手|拍|扶|拉|推|递|接|站|坐|蹲|跪|躺|靠|走来|过来|赶到|来到|进来|出现|凑近|靠近|上前|跟着|跟在|低声|轻声|沉声|在|正|又|便|却|也)';
const REMOTE = /(?:准备|打算|计划|想要|要去|前往|赶往|去找|寻找|拜访|探望|看望|听说|听闻|据说|提起|谈起|想到|想起|回忆|打听|询问)/u;
const RELATION_RE = /(?:你|我|他|她|咱)(?:爷爷|奶奶|外公|外婆|父亲|母亲|爹|娘|爸爸|妈妈|哥哥|姐姐|弟弟|妹妹|叔叔|伯伯|婶婶|姑姑|姨妈|舅舅|师父|师傅)/gu;
const FAMILIAR_RE = /(?:^|[，。！？!?；;：:\s“”‘’「」『』])((?:老|小|阿)[\p{Script=Han}])(?=$|[，。！？!?；;：:\s“”‘’「」『』])/gu;
// High-confidence surname set for discovering previously unknown names. Worldbook characters do not
// depend on this list; they are resolved canonically first. Ambiguous lexical surnames are omitted
// on purpose so ordinary phrases such as “东西”“路口” cannot become people just because they are 2-4 Han characters.
const SURNAME = '(?:赵|钱|孙|李|周|吴|郑|王|冯|陈|褚|卫|蒋|沈|韩|杨|朱|秦|尤|许|何|吕|施|张|孔|曹|严|华|金|魏|陶|姜|戚|谢|邹|喻|柏|窦|章|云|苏|潘|葛|奚|范|彭|郎|鲁|韦|昌|马|苗|方|俞|任|袁|柳|鲍|史|唐|费|廉|岑|薛|雷|贺|倪|汤|滕|殷|罗|毕|郝|邬|安|常|乐|于|时|傅|皮|卞|齐|康|伍|余|元|卜|顾|孟|平|黄|和|穆|萧|尹|姚|邵|湛|汪|祁|毛|禹|狄|米|贝|明|臧|计|伏|成|戴|谈|宋|茅|庞|熊|纪|舒|屈|项|祝|董|梁|杜|阮|蓝|闵|席|季|麻|强|贾|娄|危|江|童|颜|郭|梅|盛|林|刁|钟|徐|邱|骆|高|夏|蔡|田|樊|胡|凌|霍|虞|万|支|柯|昝|管|卢|莫|经|房|裘|缪|干|解|应|宗|丁|宣|贲|邓|郁|单|杭|洪|包|诸|左|石|崔|吉|龚|程|邢|裴|陆|荣|翁|荀|羊|惠|甄|曲|封|芮|羿|储|靳|汲|邴|糜|松|井|段|富|巫|乌|焦|巴|弓|牧|隗|车|侯|宓|蓬|全|郗|班|仰|秋|仲|伊|宫|宁|仇|栾|暴|甘|钭|厉|戎|祖|武|符|刘|景|詹|束|龙|叶|幸|司|韶|郜|黎|蓟|薄|印|宿|蒲|邰|鄂|索|咸|赖|卓|蔺|屠|蒙|池|乔|阴|胥|能|苍|双|闻|莘|党|翟|谭|贡|劳|逄|姬|申|扶|堵|冉|宰|郦|雍|郤|璩|桑|桂|濮|牛|寿|通|边|扈|燕|冀|郏|浦|尚|农|温|别|庄|晏|柴|瞿|阎|充|慕|连|茹|习|宦|艾|鱼|容|易|慎|戈|廖|庾|终|暨|居|衡|步|都|耿|满|弘|匡|寇|广|禄|阙|欧阳|司马|上官|诸葛|夏侯|皇甫|尉迟|公孙|慕容|令狐|宇文|长孙|司徒|司空)';
const SUBJECT_RE = new RegExp(`(?:^|[。！？!?；;\n“”「『])\\s*(${SURNAME}[\\p{Script=Han}]{1,2})(?=${ACTION})`,'gu');
const ATTRIBUTION_RE = new RegExp(`(${SURNAME}[\\p{Script=Han}]{1,2})[^。！？!?；;]{0,8}(?:说|道|问|答|喊|叫)[：:]?`,'gu');
const EXPLICIT_NAME_RE = new RegExp(`(?:名叫|叫作|叫做|唤作|姓名(?:是|为)?|自称为?)[：:\\s“「『]*(${SURNAME}[\\p{Script=Han}]{1,2})`,'gu');

function localContext(text, name, radius = 20) {
    const i = text.indexOf(name);
    if (i < 0) return '';
    return text.slice(Math.max(0, i - radius), Math.min(text.length, i + name.length + radius));
}
function observable(text, name) {
    const ctx = localContext(text, name, 24);
    return !REMOTE.test(ctx) && new RegExp(ACTION,'u').test(ctx);
}
function strictPeople(inst, text) {
    const src = String(text || '');
    const out = [];
    const add = n => { n=String(n||'').trim(); if(n && !out.includes(n)) out.push(n); };

    // Worldbook characters are trusted canonical entities.
    for (const id of inst.resolveMentions?.(src, 'character') || []) {
        const n = inst.nodeMap?.[id];
        const label = n?.displayName || id;
        if (observable(src, label) || src.includes(label)) add(label);
    }

    for (const m of src.matchAll(RELATION_RE)) if (observable(src, m[0])) add(m[0]);
    for (const m of src.matchAll(FAMILIAR_RE)) if (observable(src, m[1])) add(m[1]);
    for (const re of [EXPLICIT_NAME_RE, SUBJECT_RE, ATTRIBUTION_RE]) {
        for (const m of src.matchAll(re)) if (observable(src, m[1])) add(m[1]);
    }
    return entityUniq(out).slice(0, 12);
}

async function installStrictEntityResolver() {
    for (let i = 0; i < 120 && !window.MapNInstance; i++) await entityWait(50);
    const inst = window.MapNInstance;
    if (!inst || inst.__mapNStrictEntity101) return;
    for (let i = 0; i < 120 && !inst.__sceneScanner120; i++) await entityWait(50);
    if (inst.__mapNStrictEntity101) return;
    inst.__mapNStrictEntity101 = true;

    // Presence v2 may contain names produced by the old permissive parser. Reset that state before
    // presence-resolver installs, then rebuild it from the latest AI message using strict candidates.
    try { localStorage.removeItem(`${inst.memoryKey}:presence-v1`); } catch {}
    delete inst.__mapNPresenceState;

    const previousProcess = inst.process.bind(inst);
    inst.process = function(text, isUser = false) {
        const before = [...(this.currentChars || [])];
        previousProcess(text, isUser);
        if (isUser || !text) { if (isUser) this.currentChars = before; return; }
        this.currentChars = strictPeople(this, String(text));
        this.currentChars.forEach(x => this.encountered.add(x));
        this.save?.();
        if (this.container?.classList.contains('open')) this.render?.();
    };

    const chat = inst.ctx?.chat || [];
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (m?.mes && !m.is_user) { inst.currentChars = strictPeople(inst, String(m.mes)); break; }
    }
    inst.save?.();
    inst.render?.();
    console.log('[Map-N] strict entity resolver v1.0.1 installed');
}

installStrictEntityResolver();
