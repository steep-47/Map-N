// Map-N geographic hierarchy resolver v1.3.0
const MAPN_ROOT='世界舆图';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const unique=a=>[...new Set((a||[]).filter(Boolean))];
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const TERRAIN_SUFFIX=/(?:峪|谷|沟|峡|岭|山|峰|崖|坡|坳|洼|滩|河|江|溪|潭|湖|海|湾|岛|原|林|泽|谷道|山道|官道|古道|栈道|小道|道路|路|径|桥|洞|窟|村|镇|城|寨|庄)$/u;
const BROAD_TERRAIN=/(?:峪|谷|沟|峡|岭|山|峰|崖|坡|坳|洼|滩|河|江|溪|潭|湖|海|湾|岛|原|林|泽)$/u;
const ROUTE_TERRAIN=/(?:谷道|山道|官道|古道|栈道|小道|道路|路|径)$/u;
const SIDE_PREFIX=/^(?:东|西|南|北|东北|西北|东南|西南|上|下|内|外|前|后|左|右)(?:侧|段|部|缘)?/u;
function nodes(inst){return Object.values(inst.nodeMap||{}).filter(n=>n?.type==='location');}
function name(n){return String(n?.displayName||n?.id||'').trim();}
function wouldCycle(inst,c,p){let x=p,s=new Set();while(x&&x!==MAPN_ROOT&&!s.has(x)){if(x===c)return true;s.add(x);x=inst.nodeMap?.[x]?.parent;}return false;}
function rebuild(inst){const ns=nodes(inst);inst.root||={id:MAPN_ROOT,children:[],parent:null};inst.root.children=[];for(const n of ns)n.children=[];for(const n of ns){const p=n.parent;if(p&&p!==MAPN_ROOT&&inst.nodeMap?.[p]?.type==='location'&&!wouldCycle(inst,n.id,p))inst.nodeMap[p].children.push(n.id);else{n.parent=MAPN_ROOT;inst.root.children.push(n.id);}}for(const n of ns)n.children=unique(n.children);inst.root.children=unique(inst.root.children);}
function explicitScore(child,parent){const c=String(child.content||''),pn=esc(name(parent)),cn=esc(name(child));const rs=[new RegExp(`(?:位于|地处|坐落于?|处于|处在|属于|隶属于?|辖于|在)\\s*[^。；;，,]{0,24}${pn}(?:内|中|境内|区域|地区)?`),new RegExp(`${pn}[^。；;]{0,24}(?:包括|包含|涵盖|下辖|辖有|设有)[^。；;]{0,24}${cn}`)];return rs.some(r=>r.test(c))?10:0;}
function compoundScore(child,parent){const cn=name(child),pn=name(parent);if(!cn||!pn||cn===pn||pn.length<2||cn.length<=pn.length)return 0;if(!TERRAIN_SUFFIX.test(cn)||!TERRAIN_SUFFIX.test(pn))return 0;if(!cn.startsWith(pn))return 0;const tail=cn.slice(pn.length);if(!tail)return 0;if(SIDE_PREFIX.test(tail)||ROUTE_TERRAIN.test(cn)||BROAD_TERRAIN.test(pn))return 8+Math.min(4,pn.length/4);return 6+Math.min(3,pn.length/5);}
function reconcile(inst){const ns=nodes(inst);let changed=0;for(const child of ns){let best=null;for(const parent of ns){if(parent===child||wouldCycle(inst,child.id,parent.id))continue;const score=Math.max(explicitScore(child,parent),compoundScore(child,parent));if(!score)continue;if(!best||score>best.score||(score===best.score&&name(parent).length>name(best.parent).length))best={parent,score};}if(best&&child.parent!==best.parent.id){child.parent=best.parent.id;changed++;}}if(changed){rebuild(inst);if(inst.currentPos&&inst.nodeMap?.[inst.currentPos])inst.path=inst.pathTo(inst.currentPos);inst.save?.();}return changed;}
async function install(){for(let i=0;i<120&&!window.MapNInstance;i++)await delay(50);const inst=window.MapNInstance;if(!inst||inst.__hierarchy130)return;inst.__hierarchy130=true;const oldBuild=inst.build.bind(inst);inst.build=function(entries){oldBuild(entries);reconcile(this);};const oldProcess=inst.process.bind(inst);inst.process=function(text,isUser=false){oldProcess(text,isUser);reconcile(this);if(this.container?.classList.contains('open'))this.render?.();};reconcile(inst);inst.render?.();console.log('[Map-N] hierarchy resolver v1.3.0 installed');}
install();
