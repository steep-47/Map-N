// Map-N UI labels v1.1.0
// Presentation-only shortening: keep canonical location ids/names untouched, shorten labels relative to their visible parent context.
const ROOT='世界舆图';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function clean(s){return String(s||'').trim();}

function relativeLabel(full,parent){
  const f=clean(full),p=clean(parent);
  if(!f||!p||p===ROOT||f===p||!f.startsWith(p))return f;
  const tail=f.slice(p.length).replace(/^[·•›>→/／\s:：\-—]+/u,'').trim();
  return tail&&tail.length>=2?tail:f;
}

function fullName(inst,id){
  if(!id)return'';
  if(id===ROOT)return ROOT;
  const n=inst.nodeMap?.[id];
  return clean(n?.displayName||String(id).split('／').at(-1)||id);
}

function pathNames(inst){return (inst.path||[]).map(id=>fullName(inst,id));}
function currentParentName(inst){const names=pathNames(inst);return names.length>=2?names.at(-1):'';}

function applyCardLabels(inst){
  const parent=currentParentName(inst);
  if(!parent||!inst.container)return;
  const children=inst.children?.()||[];
  const childNames=children.map(id=>fullName(inst,id));
  for(const el of inst.container.querySelectorAll('.mapN-map-node .node-name')){
    const rendered=clean(el.textContent);
    const stored=clean(el.dataset.mapnFullName);
    const full=stored||childNames.find(x=>x===rendered)||rendered;
    el.dataset.mapnFullName=full;
    el.textContent=relativeLabel(full,parent);
    el.title=full;
    const button=el.closest('.mapN-map-node');if(button)button.title=full;
  }
}

function applyBottomLabels(inst){
  const parent=currentParentName(inst);
  if(!parent||!inst.container)return;
  const children=(inst.children?.()||[]).map(id=>({id,full:fullName(inst,id)})).sort((a,b)=>b.full.length-a.full.length);
  for(const el of inst.container.querySelectorAll('.mapN-bottom .item')){
    const original=clean(el.dataset.mapnFullText||el.textContent);
    let next=original,matched='';
    for(const c of children){if(original.includes(c.full)){const short=relativeLabel(c.full,parent);if(short!==c.full){next=original.replace(c.full,short);matched=c.full;}break;}}
    el.dataset.mapnFullText=original;el.textContent=next;if(matched)el.title=matched;
  }
}

// Breadcrumb is contextual by definition: each segment is displayed relative to the previous segment.
function applyBreadcrumbLabels(inst){
  if(!inst.container)return;
  const ids=inst.path||[],names=pathNames(inst),crumbs=[...inst.container.querySelectorAll('.mapN-breadcrumb .crumb')];
  for(let i=0;i<crumbs.length&&i<names.length;i++){
    const el=crumbs[i],full=names[i],parent=i>0?names[i-1]:'';
    el.dataset.mapnFullName=full;
    el.textContent=i===0?full:relativeLabel(full,parent);
    el.title=full;
  }
}

// The map-frame title is the current node, so display it relative to its parent in the path.
function applyMapTitle(inst){
  if(!inst.container)return;
  const title=inst.container.querySelector('.mapN-map-title');if(!title)return;
  const names=pathNames(inst),full=names.at(-1)||clean(title.textContent),parent=names.length>=2?names.at(-2):'';
  title.dataset.mapnFullName=full;
  title.textContent=parent?relativeLabel(full,parent):full;
  title.title=full;
}

function injectStyle(){
  if(document.querySelector('#mapN-relative-label-style'))return;
  const s=document.createElement('style');s.id='mapN-relative-label-style';s.textContent=`
    .mapN-map-node .node-name{white-space:normal!important;overflow:hidden!important;text-overflow:clip!important;display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;line-clamp:2!important;line-height:1.28!important;overflow-wrap:anywhere}
    .mapN-map-node{min-height:38px}
    .mapN-breadcrumb .crumb{max-width:34vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}
    .mapN-map-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    @media(max-width:600px){.mapN-map-node{min-height:42px!important;align-items:flex-start!important}.mapN-map-node .node-name{font-size:11.5px;line-height:1.25!important}.mapN-bottom .item{max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mapN-breadcrumb .crumb{max-width:24vw}.mapN-map-title{font-size:12px}}
  `;document.head.appendChild(s);
}

function apply(inst){applyBreadcrumbLabels(inst);applyMapTitle(inst);applyCardLabels(inst);applyBottomLabels(inst);}

async function install(){
  for(let i=0;i<160&&!window.MapNInstance;i++)await wait(50);
  const inst=window.MapNInstance;if(!inst||inst.__relativeLabels110)return;
  inst.__relativeLabels110=true;injectStyle();
  const render=inst.render.bind(inst);
  inst.render=function(...args){const result=render(...args);try{apply(this);}catch(e){console.warn('[Map-N] 相对地名显示失败',e);}return result;};
  apply(inst);console.log('[Map-N] relative UI labels v1.1.0 installed');
}
if(typeof window!=='undefined')install();
export {relativeLabel};
