// Map-N worldbook geography parser v2.1.0
// Compile worldbook geography once: named entities + explicit semantic parent edges.
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const GEO_SUFFIX=/(?:大陆|陆|洲|州|郡|府|县|国|皇朝|王朝|帝国|王国|城|镇|村|寨|庄|港|岛|群岛|海|海域|河|江|湖|湾|溪|潭|山系|山脉|山|峰|岭|谷|原|荒原|林|泽|关|隘|堡|宫|殿|寺|观|塔|洞|窟|坊|街|巷|桥|渡|码头|营地|遗迹|秘境|禁地)$/u;
function entryKeys(e){return uniq([...(Array.isArray(e?.key)?e.key:[]),...(Array.isArray(e?.keys)?e.keys:[])]).map(x=>String(x).trim()).filter(x=>x.length>=2)}
function text(e){return String(e?.content||'').replace(/\s+/gu,' ').trim()}
function comment(e){return String(e?.comment||'').trim()}
function primarySubject(e){const cm=comment(e),ks=entryKeys(e);return cm&&ks.includes(cm)&&GEO_SUFFIX.test(cm)?cm:null}
function declaredNames(e){const ks=entryKeys(e),t=text(e),out=[];const s=primarySubject(e);if(s)out.push(s);if(/(?:板块|区域|地域|地点)[^。；;]{0,80}(?:固有地名|正式地名)|(?:固有地名|正式地名)[^。；;]{0,80}(?:板块|区域|地域|地点)/u.test(t))for(const k of ks)if(GEO_SUFFIX.test(k))out.push(k);return uniq(out)}
function collect(entries){const out=[];for(const e of entries)for(const n of declaredNames(e))if(!out.includes(n))out.push(n);return out}
function evidence(child,parent,e){const t=text(e),c=esc(child),p=esc(parent),subject=primarySubject(e);let score=0;
 const rules=[
  [500,new RegExp(`${c}[^。；;]{0,30}(?:位于|地处|坐落于?|处于|属于|隶属于?|辖于)\\s*${p}(?:境内|地区|区域|之中|中部|北部|南部|东部|西部|中|内|中的)?`,'u')],
  [490,new RegExp(`${c}[^。；;]{0,45}(?:只是|是|为)[^。；;]{0,24}${p}(?:诸国|诸城|诸地|诸岛|区域|海域)[^。；;]{0,24}(?:中的?一个|之一)?`,'u')],
  [470,new RegExp(`${p}[^。；;]{0,35}(?:包括|包含|涵盖|下辖|辖有|设有)[^。；;]{0,24}${c}`,'u')]
 ];
 for(const [s,re] of rules)if(re.test(t))score=Math.max(score,s);
 // In a named parent entry, phrases such as “X只是其中一片海域/一个区域” use the entry subject as the omitted parent.
 if(subject===parent&&child!==parent&&t.includes(child)&&new RegExp(`${c}[^。；;]{0,24}(?:只是|仅是|属于)?(?:其中|其内|境内)[^。；;]{0,24}(?:之一|一片|一个|一处|区域|海域|地域)`,'u').test(t))score=Math.max(score,460);
 return score}
function parentGraph(names,entries){const cand=new Map(names.map(n=>[n,[]]));for(const c of names)for(const p of names){if(c===p)continue;let s=0;for(const e of entries)s=Math.max(s,evidence(c,p,e));if(s)cand.get(c).push({parent:p,score:s})}
 const reaches=(from,target,seen=new Set())=>{if(from===target)return true;if(seen.has(from))return false;seen.add(from);for(const x of cand.get(from)||[])if(reaches(x.parent,target,new Set(seen)))return true;return false};
 const out=new Map();for(const c of names){let a=[...(cand.get(c)||[])];a=a.filter(x=>!a.some(y=>y!==x&&reaches(y.parent,x.parent)));a.sort((x,y)=>y.score-x.score||y.parent.length-x.parent.length);out.set(c,a[0]?.parent||null)}return out}
function aliasesFor(name,entries){const out=[name];for(const e of entries){if(primarySubject(e)!==name)continue;for(const k of entryKeys(e))if(k!==name&&(name.includes(k)||k.includes(name)))out.push(k)}return uniq(out)}
function compile(entries){const names=collect(entries),parents=parentGraph(names,entries),geo=[];for(const n of names){const own=entries.filter(e=>declaredNames(e).includes(n)),body=uniq(own.map(text).filter(Boolean)),aliases=aliasesFor(n,entries),p=parents.get(n)||null;geo.push({uid:`mapn-geo:${n}`,key:aliases,keys:aliases,comment:n,content:`${p?`${n}位于${p}。 `:''}${body.join(' ')}`,__mapNGeo:true,__mapNParent:p})}return{geo,parents}}
function applyCompiledParents(i,parents){i.__mapNCompiledParents=new Map(parents);for(const [id,p] of parents){const n=i.nodeMap?.[id];if(n?.type==='location')n.parent=p&&i.nodeMap?.[p]?.type==='location'?p:'世界舆图'}i.root={id:'世界舆图',children:[],parent:null};for(const n of Object.values(i.nodeMap||{}))if(n?.type==='location')n.children=[];for(const n of Object.values(i.nodeMap||{})){if(n?.type!=='location')continue;if(n.parent&&n.parent!=='世界舆图'&&i.nodeMap?.[n.parent]?.type==='location')i.nodeMap[n.parent].children.push(n.id);else{n.parent='世界舆图';i.root.children.push(n.id)}}for(const n of Object.values(i.nodeMap||{}))if(n?.type==='location')n.children=uniq(n.children);i.root.children=uniq(i.root.children)}
async function install(){for(let n=0;n<180&&!window.MapNInstance;n++)await wait(50);const i=window.MapNInstance;if(!i||i.__worldbookGeoParser210)return;i.__worldbookGeoParser210=true;const original=i.build.bind(i);i.build=function(entries){const raw=Array.isArray(entries)?entries:[],{geo,parents}=compile(raw);const chars=raw.filter(e=>{const ks=this.entryKeys?.(e)||entryKeys(e);return ks.length&&this.classify?.(ks[0],String(e?.content||''))==='character'});this.__mapNRawWorldEntries=raw;this.__mapNGeoEntries=geo;original([...chars,...geo]);applyCompiledParents(this,parents)};if(Array.isArray(i.entries)&&i.entries.length){const raw=i.__mapNRawWorldEntries||[...i.entries];i.build(raw);i.save?.();i.render?.()}console.log('[Map-N] worldbook geography parser v2.1.0 installed')}
install();
