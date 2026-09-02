// Map-N refresh loading indicator v1.3.0
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function install(){
  for(let i=0;i<160&&!window.MapNInstance;i++)await wait(25);
  const inst=window.MapNInstance;if(!inst||inst.__loadingIndicator130)return;inst.__loadingIndicator130=true;
  const bind=()=>{
    const btn=inst.container?.querySelector?.('#mapN-refresh'),grid=inst.container?.querySelector?.('#mapN-grid');
    if(!btn||!grid||btn.__mapNLoadingBound)return false;
    btn.__mapNLoadingBound=true;
    btn.textContent='↻';
    const original=btn.onclick;
    btn.onclick=async e=>{
      if(grid.classList.contains('is-loading'))return;
      grid.classList.add('is-loading');btn.disabled=true;btn.setAttribute('aria-busy','true');
      const started=performance.now();
      await new Promise(requestAnimationFrame);
      try{await original?.call(btn,e);}finally{
        const remain=550-(performance.now()-started);if(remain>0)await wait(remain);
        grid.classList.remove('is-loading');btn.disabled=false;btn.removeAttribute('aria-busy');
      }
    };
    return true;
  };
  bind();setTimeout(bind,300);
  console.log('[Map-N] refresh loading indicator v1.3.0 installed');
}
install();
