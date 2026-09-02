// Map-N worldbook geography parser v2.0.0
// Keep Map-N's original live engine; only compile worldbook geography into safe named-location entries.
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const GEO_SUFFIX=/(?:大陆|陆|洲|州|郡|府|县|国|皇朝|王朝|帝国|王国|城|镇|村|寨|庄|港|岛|群岛|海|海域|河|江|湖|湾|溪|潭|山系|山脉|山|峰|岭|谷|原|荒原|林|泽|关|隘|堡|宫|殿|寺|观|塔|洞|窟|坊|街|巷|桥|渡|码头|营地|遗迹|秘境|禁地)$/u;
function entryKeys(e){return uniq([...(Array.isArray(e?.key)?e.key:[]),...(Array.isArray(e?.keys)?e.keys:[])]).map(x=>String(x).trim()).filter(x=>x.length>=2)}
function text(e){return String(e?.content||'').replace(/\s+/gu,' ').trim()}
function comment(e){return String(e?.comment||'').trim()}
function subjectNames(e){
  const ks=entryKeys(e),cm=comment(e),t=text(e),out=[];
  // Normal named entries: the entry title/comment names the subject itself.
  if(ks.includes(cm)&&GEO_SUFFIX.test(cm))out.push(cm);
  // Overview/list entries may declare their listed names as actual proper place names.
  if(/(?:固有地名|正式地名|地名)[^。；;]{0,20}(?:板块|区域|地点)?/u.test(t)||/(?:板块|区域)[^。；;]{0,20}(?:构成|组成)[^。；;]{0,40}(?:固有地名|地名)/u.test(t)){
    for(const k of ks)if(GEO_SUFFIX.test(k))out.push(k);
  }
  return uniq(out);
}
function collect(entries){const out=[];for(const e of entries)for(const n of subjectNames(e))if(!out.includes(n))out.push(n);return out}
function relationScore(child,parent,entries){
  const c=esc(child),p=esc(parent);let best=0;
  for(const e of entries){const t=text(e);if(!t.includes(child)||!t.includes(parent))continue;
    const rules=[
      [400,new RegExp(`${c}[^。；;]{0,24}(?:位于|地处|坐落于?|处于|属于|隶属于?|辖于)\\s*${p}(?:境内|地区|区域|中部|北部|南部|东部|西部|中|内|中的)?`,'u')],
      [390,new RegExp(`${c}[^。；;]{0,40}(?:只是|是|为)[^。；;]{0,20}${p}(?:诸国|诸城|诸地)[^。；;]{0,20}(?:中的?一个|之一)?`,'u')],
      [370,new RegExp(`${p}[^。；;]{0,40}(?:包括|包含|涵盖|下辖|辖有|设有)[^。；;]{0,20}${c}`,'u')]
    ];
    for(const [s,re] of rules)if(re.test(t))best=Math.max(best,s);
  }
  return best;
}
function directParents(names,entries){
  const candidates=new Map();
  for(const c of names){const a=[];for(const p of names){if(c===p)continue;const score=relationScore(c,p,entries);if(score)a.push({parent:p,score})}candidates.set(c,a)}
  // If one candidate parent is itself below another candidate parent, prefer the nearer descendant.
  const reaches=(from,target,seen=new Set())=>{if(from===target)return true;if(seen.has(from))return false;seen.add(from);for(const x of candidates.get(from)||[])if(reaches(x.parent,target,seen))return true;return false};
  const out=new Map();
  for(const c of names){let a=[...(candidates.get(c)||[])];if(!a.length)continue;a=a.filter(x=>!a.some(y=>y!==x&&reaches(y.parent,x.parent)));a.sort((x,y)=>y.score-x.score||y.parent.length-x.parent.length);if(a[0])out.set(c,a[0].parent)}
  return out;
}
function aliasesFor(name,entries){const out=[name];for(const e of entries){if(!subjectNames(e).includes(name))continue;for(const k of entryKeys(e))if(k!==name&&(name.includes(k)||k.includes(name)))out.push(k)}return uniq(out)}
function compile(entries){
  const names=collect(entries),parents=directParents(names,entries),geo=[];
  for(const n of names){const own=entries.filter(e=>subjectNames(e).includes(n)),body=uniq(own.map(text).filter(Boolean));const aliases=aliasesFor(n,entries);geo.push({uid:`mapn-geo:${n}`,key:aliases,keys:aliases,comment:n,content:`${parents.has(n)?`${n}位于${parents.get(n)}。\\n`:''}${body.join('\\n')}`,__mapNGeo:true,__mapNParent:parents.get(n)||null})}
  return geo;
}
async function install(){
  for(let n=0;n<180&&!window.MapNInstance;n++)await wait(50);
  const i=window.MapNInstance;if(!i||i.__worldbookGeoParser200)return;i.__worldbookGeoParser200=true;
  const original=i.build.bind(i);
  i.build=function(entries){
    const raw=Array.isArray(entries)?entries:[];
    const geo=compile(raw);
    // Preserve only entries the original engine itself identifies as characters. Other non-geographic worldbook entries are evidence, not map nodes.
    const chars=raw.filter(e=>{const ks=this.entryKeys?.(e)||entryKeys(e);return ks.length&&this.classify?.(ks[0],String(e?.content||''))==='character'});
    this.__mapNRawWorldEntries=raw;this.__mapNGeoEntries=geo;
    return original([...chars,...geo]);
  };
  if(Array.isArray(i.entries)&&i.entries.length){const raw=i.__mapNRawWorldEntries||[...i.entries];i.build(raw);i.save?.();i.render?.()}
  console.log('[Map-N] worldbook geography parser v2.0.0 installed');
}
install();
