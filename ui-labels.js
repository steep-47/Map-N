// Map-N UI labels v1.0.0
// Presentation-only shortening: keep canonical location ids/names untouched, shorten child labels relative to the current parent.
const ROOT='世界舆图';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function clean(s){return String(s||'').trim();}

// Only shorten when the full child name literally starts with the current parent name.
// Never mutate canonical ids, aliases, storage, hierarchy or currentPos.
function relativeLabel(full,parent){
  const f=clean(full),p=clean(parent);
  if(!f||!p||p===ROOT||f===p||!f.startsWith(p))return f;
  let tail=f.slice(p.length).replace(/^[·•›>→/／\s:：\-—]+/u,'').trim();
  // Avoid producing an empty or meaningless one-character label.
  if(!tail||tail.length<2)return f;
  return tail;
}

function fullName(inst,id){
  if(!id)return'';
  const n=inst.nodeMap?.[id];
  return clean(n?.displayName||String(id).split('／').at(-1)||id);
}

function currentParentName(inst){
  const id=inst.path?.at?.(-1);
  return id&&id!==ROOT?fullName(inst,id):'';
}

function applyCardLabels(inst){
  const parent=currentParentName(inst);
  if(!parent||!inst.container)return;
  const children=inst.children?.()||[];
  const byFull=new Map(children.map(id=>[fullName(inst,id),id]));
  for(const el of inst.container.querySelectorAll('.mapN-map-node .node-name')){
    const original=clean(el.dataset.mapnFullName||el.textContent);
    const full=byFull.has(original)?original:(children.map(fullName.bind(null,inst)).find(x=>x===original)||original);
    const short=relativeLabel(full,parent);
    el.dataset.mapnFullName=full;
    el.textContent=short;
    el.title=full;
    const button=el.closest('.mapN-map-node');
    if(button)button.title=full;
  }
}

function applyBottomLabels(inst){
  const parent=currentParentName(inst);
  if(!parent||!inst.container)return;
  const children=(inst.children?.()||[]).map(id=>({id,full:fullName(inst,id)})).sort((a,b)=>b.full.length-a.full.length);
  for(const el of inst.container.querySelectorAll('.mapN-bottom .item')){
    const original=clean(el.dataset.mapnFullText||el.textContent);
    let next=original,matched='';
    for(const c of children){
      if(original.includes(c.full)){
        const short=relativeLabel(c.full,parent);
        if(short!==c.full){next=original.replace(c.full,short);matched=c.full;}
        break;
      }
    }
    el.dataset.mapnFullText=original;
    el.textContent=next;
    if(matched)el.title=matched;
  }
}

function injectStyle(){
  if(document.querySelector('#mapN-relative-label-style'))return;
  const s=document.createElement('style');
  s.id='mapN-relative-label-style';
  s.textContent=`
    .mapN-map-node .node-name{
      white-space:normal!important;
      overflow:hidden!important;
      text-overflow:clip!important;
      display:-webkit-box!important;
      -webkit-box-orient:vertical!important;
      -webkit-line-clamp:2!important;
      line-clamp:2!important;
      line-height:1.28!important;
      overflow-wrap:anywhere;
    }
    .mapN-map-node{min-height:38px}
    @media(max-width:600px){
      .mapN-map-node{min-height:42px!important;align-items:flex-start!important}
      .mapN-map-node .node-name{font-size:11.5px;line-height:1.25!important}
      .mapN-bottom .item{max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    }
  `;
  document.head.appendChild(s);
}

function apply(inst){applyCardLabels(inst);applyBottomLabels(inst);}

async function install(){
  for(let i=0;i<160&&!window.MapNInstance;i++)await wait(50);
  const inst=window.MapNInstance;
  if(!inst||inst.__relativeLabels100)return;
  inst.__relativeLabels100=true;
  injectStyle();
  const render=inst.render.bind(inst);
  inst.render=function(...args){
    const result=render(...args);
    try{apply(this);}catch(e){console.warn('[Map-N] 相对地名显示失败',e);}
    return result;
  };
  apply(inst);
  console.log('[Map-N] relative UI labels v1.0.0 installed');
}

if(typeof window!=='undefined')install();
export {relativeLabel};
