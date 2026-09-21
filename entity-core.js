// Map-N entity core v2.4.0
// Single source of truth for location canonicalization, header parsing and hierarchy ranking.
const TIME_PREFIX_RE=/^\s*(?:(?:\d{1,6}年\d{1,2}月\d{1,2}日)|(?:\d{1,6}[-/.]\d{1,2}[-/.]\d{1,2})|(?:\d{1,2}月\d{1,2}日))?(?:\s*(?:周[一二三四五六日天]|星期[一二三四五六日天]))?(?:\s*(?:上午|下午|晚上|夜间|凌晨|清晨|早上|中午|傍晚))?(?:\s*\d{1,2}:\d{2}(?::\d{2})?)?\s*[|｜]\s*/u;
const BARE_TIME_PREFIX_RE=/^\s*\d{1,2}:\d{2}(?::\d{2})?\s*[|｜]\s*/u;
const TIME_META_RE=/(?:\d{1,6}年\d{1,2}月\d{1,2}日|\d{1,6}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}月\d{1,2}日|\b\d{1,2}:\d{2}(?::\d{2})?\b|(?:时间|时刻)\s*[：:|｜])/u;
const TIME_VALUE_RE=/^\s*(?:(?:\d{1,6}年\d{1,2}月\d{1,2}日|\d{1,6}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}月\d{1,2}日)\s*)?(?:(?:周|星期)[一二三四五六日天]\s*)?(?:(?:上午|下午|晚上|夜间|凌晨|清晨|早上|中午|傍晚)\s*)?\d{1,2}:\d{2}(?::\d{2})?\s*$/u;
const LOCATION_LABEL_RE=/^(当前(?:所在)?(?:地点|位置)|场景(?:地点|位置)?|所在(?:地点|位置)|所在地|地点|位置|Location|Place|Scene)\s*(?:[：:|｜=＝—–-]\s*|\s+)(.+?)\s*$/iu;
const STRONG_LOCATION_LABEL_RE=/^(?:当前(?:所在)?(?:地点|位置)|所在(?:地点|位置)|所在地|地点|位置|Location|Place)$/iu;
const CONTAINER_SUFFIX_RE=/(?:大陆|陆|洲|州|郡|府|县|国|皇朝|王朝|帝国|王国|域|界|城|镇|村|寨|庄|港|岛|群岛|海|海域|湾|湖|河|江|山系|山脉|山|岭|峪|谷|峡|沟|原|荒原|林|泽)$/u;
const COMPOSITE_PARENT_RE=/(?:大陆|陆|洲|州|郡|府|县|国|皇朝|王朝|帝国|王国|域|界|城|镇|村|寨|庄|港|岛|群岛|海域)$/u;
const ROUTE_SUFFIX_RE=/(?:谷道|山道|官道|古道|栈道|小道|道路|路|径)$/u;
const LOCAL_DETAIL_SUFFIX_RE=/(?:墙根|洞口|门口|路口|谷口|沟口|村口|镇口|城门|崖根|树下|屋里|屋内|院里|院内|旁|旁边|边缘|北缘|南缘|东缘|西缘)$/u;
const PLACE_SUFFIX_RE=/(?:港|溪|潭|峰|崖|坡|坳|洼|滩|关|隘|堡|宫|殿|寺|观|塔|洞|窟|坊|街|巷|桥|渡|码头|营地|遗迹|秘境|禁地|屋|宅|院|府邸|铺|店|客栈|馆|楼|阁|堂|亭|台|场|园|圃|段|缘)$/u;
const DIR_PREFIX_RE=/^(?:东|西|南|北|东北|西北|东南|西南|上|下|内|外|前|后|左|右)(?:侧|段|部|缘)?/u;
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
function stripTimestampPrefix(value){let s=String(value||'').trim();for(let i=0;i<2;i++){const n=s.replace(TIME_PREFIX_RE,'').replace(BARE_TIME_PREFIX_RE,'').trim();if(n===s)break;s=n;}return s;}
function stripOuterBrackets(s){return String(s||'').trim().replace(/^[【[]\s*/u,'').replace(/\s*[】\]]$/u,'').trim();}
function stripParentheticalQualifier(s){const v=String(s||'').trim(),i=v.search(/[（(]/u);return i>=2?v.slice(0,i).trim():v;}
function stripDanglingCloser(s){let v=String(s||'').trim();while(/[）)]$/u.test(v)){const o=(v.match(/[（(]/gu)||[]).length,c=(v.match(/[）)]/gu)||[]).length;if(c<=o)break;v=v.slice(0,-1).trim();}return v;}
function normalizeLocationSegment(s){return stripDanglingCloser(stripParentheticalQualifier(stripTimestampPrefix(stripOuterBrackets(s)))).replace(/^[,，;；:：\s]+|[,，;；:：\s]+$/gu,'').trim();}
function splitCompositeLocationSegment(value){
 const src=normalizeLocationSegment(value);if(!src)return[];
 const route=src.match(/^(.{2,}(?:谷道|山道|官道|古道|栈道|小道|道路|路|径))((?:东|西|南|北|中|上|下|内|外|前|后)(?:侧|段|部|缘))$/u);if(route)return[route[1],route[2]];
 const out=[];let rest=src;
 for(let guard=0;guard<8;guard++){
  let cut=0;
  for(let n=2;n<=rest.length-2;n++){
   const head=rest.slice(0,n),tail=rest.slice(n);
   if(COMPOSITE_PARENT_RE.test(head)&&placeKind(tail)!=='unknown'){cut=n;break;}
  }
  if(!cut)break;
  out.push(rest.slice(0,cut));rest=rest.slice(cut);
 }
 out.push(rest);return out.filter(Boolean);
}
function expandLocationParts(parts){return(Array.isArray(parts)?parts:[parts]).flatMap(splitCompositeLocationSegment).filter(x=>x.length>=2&&x.length<=40&&!/^\d{1,2}:\d{2}(?::\d{2})?$/u.test(x));}
function normalizeLocationParts(raw){const src=stripTimestampPrefix(stripOuterBrackets(raw));if(!src)return[];return expandLocationParts(src.split(/\s*[·•›>→/／]+\s*/u));}
function cleanMetaLine(line){return String(line||'').trim().replace(/^\s*(?:>\s*|#{1,6}\s*|[-*+]\s+)/u,'').replace(/\*\*/gu,'').trim();}
function locationShape(parts,raw=''){if(!parts?.length)return false;if(/[。！？!?；;]/u.test(raw))return false;if(parts.length>=2)return true;return placeKind(parts[0])!=='unknown';}
function labeledLocation(line){let raw=stripOuterBrackets(cleanMetaLine(line)).trim();const pin=raw.match(/^[📍🧭]\s*(.+)$/u);if(pin){const parts=normalizeLocationParts(pin[1]);return parts.length?parts:null;}const m=raw.match(LOCATION_LABEL_RE);if(!m)return null;const parts=normalizeLocationParts(m[2]);if(!parts.length)return null;return STRONG_LOCATION_LABEL_RE.test(m[1])||locationShape(parts,m[2])?parts:null;}
function timeMeta(line){const s=stripOuterBrackets(cleanMetaLine(line));return s.length<=80&&TIME_META_RE.test(s)&&!/[。！？!?；;]/u.test(s);}
function timedLocation(line){
 const raw=stripOuterBrackets(cleanMetaLine(line)).trim(),parts=raw.split(/\s*[|｜]\s*/u);if(parts.length!==2)return null;
 const left=parts[0].trim(),right=parts[1].trim(),lt=TIME_VALUE_RE.test(left),rt=TIME_VALUE_RE.test(right);
 const candidate=lt&&!rt?right:rt&&!lt?left:'';if(!candidate)return null;
 const p=normalizeLocationParts(candidate);return locationShape(p,candidate)?p:null;
}
function parseHeaderLocations(text){
 const lines=String(text||'').split(/\n/).slice(0,240).map(cleanMetaLine).filter(Boolean),out=[],seen=new Set();
 const add=p=>{if(!p?.length)return;const key=p.join('／');if(seen.has(key))return;seen.add(key);out.push(p);};
 for(let n=0;n<lines.length;n++){
  const line=lines[n];let p=labeledLocation(line)||timedLocation(line);
  if(!p&&(TIME_PREFIX_RE.test(line)||BARE_TIME_PREFIX_RE.test(line)))p=normalizeLocationParts(line);
  if(p?.length){add(p);continue;}
  if(timeMeta(line)){
   for(let k=n+1;k<=Math.min(n+2,lines.length-1);k++){
    const candidate=stripOuterBrackets(lines[k]).replace(/^[📍🧭]\s*/u,'').trim(),next=normalizeLocationParts(candidate);
    if(locationShape(next,candidate)){add(next);break;}
   }
  }
 }
 return out;
}
function parseHeaderLocation(text){const all=parseHeaderLocations(text);return all.length?all.at(-1):null;}
function placeKind(name){const s=normalizeLocationSegment(name);if(LOCAL_DETAIL_SUFFIX_RE.test(s))return'local-detail';if(ROUTE_SUFFIX_RE.test(s))return'route';if(/(?:段|缘)$/u.test(s))return'segment';if(CONTAINER_SUFFIX_RE.test(s))return'container';if(PLACE_SUFFIX_RE.test(s))return'place';return'unknown';}
function parentScore(child,parent){const c=normalizeLocationSegment(child),p=normalizeLocationSegment(parent);if(!c||!p||c===p||c.length<=p.length||!c.startsWith(p))return 0;const ck=placeKind(c),pk=placeKind(p),tail=c.slice(p.length);let score=40+p.length;if(DIR_PREFIX_RE.test(tail))score+=12;if(pk==='container'&&['route','segment','local-detail','place'].includes(ck))score+=18;if(pk==='route'&&['segment','local-detail'].includes(ck))score+=22;return score;}
function hierarchyRelationScore(child,parent,{explicit=false,pathDepth=0}={}){const semantic=parentScore(child,parent);if(semantic>0)return 3000+semantic+normalizeLocationSegment(parent).length*4;if(pathDepth>0)return 2000+pathDepth*10+String(parent||'').length;return explicit?1000+normalizeLocationSegment(parent).length:0;}
const api={normalizeLocationSegment,normalizeLocationParts,splitCompositeLocationSegment,expandLocationParts,parseHeaderLocations,parseHeaderLocation,placeKind,parentScore,hierarchyRelationScore};globalThis.MapNEntityCore=api;export {normalizeLocationSegment,normalizeLocationParts,splitCompositeLocationSegment,expandLocationParts,parseHeaderLocations,parseHeaderLocation,placeKind,parentScore,hierarchyRelationScore};
