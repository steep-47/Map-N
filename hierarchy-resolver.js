// Map-N geographic hierarchy resolver v1.4.0
// Works with both worldbook ids and scene-scanner path ids (e.g. 沉陆／石峪／石峪西侧旧谷道).
const ROOT='世界舆图',wait=ms=>new Promise(r=>setTimeout(r,ms));
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const GEO=/(?:峪|谷|沟|峡|岭|山|峰|崖|坡|坳|洼|滩|河|江|溪|潭|湖|海|湾|岛|原|林|泽|谷道|山道|官道|古道|栈道|小道|道路|路|径|桥|洞|窟|村|镇|城|寨|庄)$/u;
const MOD=/^(?:东|西|南|北|东北|西北|东南|西南|上|下|内|外|前|后|左|右)(?:侧|段|部|缘)?/u;
function ns(i){return Object.values(i.nodeMap||{}).filter(n=>n?.type==='location');}
function label(n){return String(n?.displayName||String(n?.id||'').split('／').at(-1)||'').trim();}
function chain(id){return String(id||'').split('／').map(x=>x.trim()).filter(Boolean);}
function cyc(i,c,p){let x=p,s=new Set();while(x&&x!==ROOT&&!s.has(x)){if(x===c)return true;s.add(x);x=i.nodeMap?.[x]?.parent;}return false;}
function rebuild(i){const all=ns(i);i.root||={id:ROOT,children:[],parent:null};i.root.children=[];for(const n of all)n.children=[];for(const n of all){const p=n.parent;if(p&&p!==ROOT&&i.nodeMap?.[p]?.type==='location'&&!cyc(i,n.id,p))i.nodeMap[p].children.push(n.id);else{n.parent=ROOT;i.root.children.push(n.id);}}for(const n of all)n.children=uniq(n.children);i.root.children=uniq(i.root.children);}
function explicit(c,p){const txt=String(c.content||''),pn=esc(label(p)),cn=esc(label(c));return [new RegExp(`(?:位于|地处|坐落于?|处于|属于|隶属于?|辖于|在)\\s*[^。；;，,]{0,24}${pn}(?:内|中|境内)?`),new RegExp(`${pn}[^。；;]{0,24}(?:包括|包含|涵盖|下辖|辖有|设有)[^。；;]{0,24}${cn}`)].some(r=>r.test(txt))?100:0;}
function structural(c,p){const ci=chain(c.id),pi=chain(p.id),cn=label(c),pn=label(p);if(c.id===p.id)return 0;
 // Scene scanner already encoded an ancestry path in the id. Respect it before any fuzzy inference.
 if(ci.length>pi.length&&ci.slice(0,pi.length).join('／')===pi.join('／'))return 90+pi.length;
 // Same branch, but one node may be worldbook id and the other a learned path id. Compare leaf labels.
 if(cn.startsWith(pn)&&cn.length>pn.length&&GEO.test(cn)&&GEO.test(pn)){const tail=cn.slice(pn.length);return (MOD.test(tail)||GEO.test(pn))?70+pn.length:60+pn.length;}
 return 0;}
function reconcile(i){const all=ns(i);let ch=0;for(const c of all){let best=null;for(const p of all){if(c===p||cyc(i,c.id,p.id))continue;const score=Math.max(explicit(c,p),structural(c,p));if(!score)continue;if(!best||score>best.score||(score===best.score&&chain(p.id).length>chain(best.p.id).length)||(score===best.score&&chain(p.id).length===chain(best.p.id).length&&label(p).length>label(best.p).length))best={p,score};}if(best&&c.parent!==best.p.id){c.parent=best.p.id;ch++;}}
 if(ch){rebuild(i);if(i.currentPos&&i.nodeMap?.[i.currentPos])i.path=i.pathTo(i.currentPos);i.save?.();}return ch;}
async function install(){for(let x=0;x<160&&!window.MapNInstance;x++)await wait(50);const i=window.MapNInstance;if(!i||i.__hierarchy140)return;i.__hierarchy140=true;const b=i.build.bind(i);i.build=function(e){b(e);reconcile(this);};const p=i.process.bind(i);i.process=function(t,u=false){p(t,u);reconcile(this);if(this.container?.classList.contains('open'))this.render?.();};
 // scene-scanner is loaded before us; wait a tick so learned nodes have been merged, then reconcile again.
 setTimeout(()=>{reconcile(i);i.render?.();},0);console.log('[Map-N] hierarchy resolver v1.4.0 installed');}install();
