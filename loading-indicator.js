// Map-N refresh loading indicator v1.1.0
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function install(){
  for(let i=0;i<160&&!window.MapNInstance;i++)await wait(25);
  const inst=window.MapNInstance;if(!inst||inst.__loadingIndicator110)return;inst.__loadingIndicator110=true;
  const bind=()=>{
    const btn=inst.container?.querySelector?.('#mapN-refresh');
    if(!btn||btn.__mapNLoadingBound)return false;
    btn.__mapNLoadingBound=true;
    const original=btn.onclick;
    // Keep the mobile ::after label static; rotate only the refresh glyph itself.
    const glyph=document.createElement('span');glyph.className='mapN-refresh-glyph';glyph.textContent='↻';
    btn.textContent='';btn.appendChild(glyph);
    btn.onclick=async e=>{
      if(btn.classList.contains('is-loading'))return;
      btn.classList.add('is-loading');btn.setAttribute('aria-busy','true');btn.title='正在刷新…';
      const anim=glyph.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:700,iterations:Infinity,easing:'linear'});
      const started=performance.now();
      await new Promise(requestAnimationFrame);
      try{await original?.call(btn,e);}finally{
        // A very fast refresh otherwise finishes before the eye can perceive the motion.
        const remain=450-(performance.now()-started);if(remain>0)await wait(remain);
        anim.cancel();btn.classList.remove('is-loading');btn.removeAttribute('aria-busy');btn.title='重新读取当前世界书';
      }
    };
    return true;
  };
  bind();setTimeout(bind,300);
  console.log('[Map-N] refresh loading indicator v1.1.0 installed');
}
install();
