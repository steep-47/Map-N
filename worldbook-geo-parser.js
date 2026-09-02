// Map-N worldbook geography parser v1.0.0
// Pre-build semantic layer: worldbook entries -> geographic entities -> explicit relations.
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const GEO=/(?:大陆|陆地|陆|洲|州|郡|府|县|国|皇朝|王朝|帝国|王国|城|镇|村|寨|庄|港|岛|群岛|海|海域|河|江|湖|湾|溪|潭|山系|山脉|山|峰|岭|谷|原|荒原|林|泽|关|隘|堡|宫|殿|寺|观|塔|洞|窟|坊|街|巷|桥|渡|码头|营地|遗迹|秘境|禁地)$/u;
const META=/(?:随机|生成|创建|规则|机制|模板|格式|要求|说明|指南|流程|概率|权重|选项|候选|出生地|开局|角色|人物|NPC|系统|设定)$/u;
const GEO_CUE=/(?:位于|地处|坐落|属于|隶属|辖于|境内|下辖|辖有|包括|包含|涵盖|由.+构成|板块|区域|地区|地理|地形|诸国)/u;
function keys(e){return uniq([...(Array.isArray(e?.key)?e.key:[]),...(Array.isArray(e?.keys)?e.keys:[])]).map(x=>String(x).trim()).filter(x=>x.length>=2)}
function text(e){return String(e?.content||'').replace(/\s+/gu,' ').trim()}
function isEntityName(name,body){if(!name||META.test(name))return false;if(GEO.test(name))return true;const q=esc(name);return GEO_CUE.test(body)&&(new RegExp(`${q}[^。；;]{0,36}(?:位于|属于|隶属|辖有|下辖|板块|区域|地区|国家)`).test(body)||new RegExp(`(?:位于|属于|隶属|辖于|包括|包含|下辖|辖有)[^。；;]{0,36}${q}`).test(body))}
function candidates(entries){const set=new Set();for(const e of entries){const b=text(e);for(const k of keys(e))if(isEntityName(k,b))set.add(k)}return [...set].sort((a,b)=>b.length-a.length)}
function relation(child,parent,entries){const c=esc(child),p=esc(parent);for(const e of entries){const b=text(e);if(!b.includes(child)||!b.includes(parent))continue;const pats=[new RegExp(`${c}[^。；;]{0,48}(?:位于|地处|坐落于?|属于|隶属于?|辖于|是|为)[^。；;]{0,48}${p}`),new RegExp(`${p}[^。；;]{0,56}(?:包括|包含|涵盖|下辖|辖有|设有|诸国|由)[^。；;]{0,56}${c}`)];if(pats.some(r=>r.test(b)))return true}return false}
function synthesize(entries){const names=candidates(entries),out=[];for(const name of names){const related=entries.filter(e=>keys(e).includes(name)||text(e).includes(name));const own=related.find(e=>keys(e).includes(name));const aliases=uniq(related.flatMap(keys).filter(k=>k===name||(!META.test(k)&&isEntityName(k,text(own||{})))));let parent=null;for(const p of names){if(p===name)continue;if(relation(name,p,entries)){parent=p;break}}const body=uniq(related.map(text).filter(Boolean)).join('\n');out.push({uid:`mapn-geo:${name}`,key:uniq([name,...aliases]),keys:uniq([name,...aliases]),content:parent?`${name}位于${parent}。\n${body}`:body,__mapNGeo:true,__mapNParent:parent})}return out}
function install(){const i=window.MapNInstance;if(!i||i.__worldbookGeoParser100)return false;i.__worldbookGeoParser100=true;const original=i.build.bind(i);i.build=function(entries){const raw=Array.isArray(entries)?entries:[];const geo=synthesize(raw);const nonGeo=raw.filter(e=>{const ks=keys(e),b=text(e);return !ks.some(k=>isEntityName(k,b))});original([...nonGeo,...geo]);};if(Array.isArray(i.entries)&&i.entries.length){const raw=[...i.entries];i.entries=raw;i.build(raw);i.save?.();i.render?.()}console.log('[Map-N] worldbook geography parser v1.0.0 installed');return true}
(async()=>{for(let n=0;n<180;n++){if(install())return;await wait(50)}})();
