// Map-N refresh loading indicator v1.2.0
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function install(){
  for(let i=0;i<160&&!window.MapNInstance;i++)await wait(25);
  const inst=window.MapNInstance;if(!inst||inst.__loadingIndicator120)return;inst.__loadingIndicator120=true;
  const bind=()=>{
    const btn=inst.container?.querySelector?.('#mapN-refresh'),grid=inst.container?.querySelector?.('#mapN-grid');
    if(!btn||!grid||btn.__mapNLoadingBound)return false;
    btn.__mapNLoadingBound=true;
    // Restore the refresh button as a normal, static control. Loading feedback belongs to the map itself.
    btn.textContent='↻';
    const original=btn.onclick;
    const overlay=document.createElement('div');overlay.className='mapN-loading-overlay';overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML='<div class="mapN-loading-box"><span class="mapN-loading-spinner" aria-hidden="true"></span><span class="mapN-loading-text">正在刷新地图…</span></div>';
    grid.appendChild(overlay);
    btn.onclick=async e=>{
      if(grid.classList.contains('is-loading'))return;
      grid.classList.add('is-loading');overlay.setAttribute('aria-hidden','false');btn.disabled=true;btn.setAttribute('aria-busy','true');
      const started=performance.now();
      await new Promise(requestAnimationFrame);
      try{await original?.call(btn,e);}finally{
        const remain=450-(performance.now()-started);if(remain>0)await wait(remain);
        grid.classList.remove('is-loading');overlay.setAttribute('aria-hidden','true');btn.disabled=false;btn.removeAttribute('aria-busy');
      }
    };
    return true;
  };
  bind();setTimeout(bind,300);
  console.log('[Map-N] refresh loading indicator v1.2.0 installed');
}
install();
