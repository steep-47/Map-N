// Map-N refresh loading indicator v1.0.0
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function install(){
  for(let i=0;i<160&&!window.MapNInstance;i++)await wait(25);
  const inst=window.MapNInstance;if(!inst||inst.__loadingIndicator100)return;inst.__loadingIndicator100=true;
  const bind=()=>{
    const btn=inst.container?.querySelector?.('#mapN-refresh');
    if(!btn||btn.__mapNLoadingBound)return false;
    btn.__mapNLoadingBound=true;
    const original=btn.onclick;
    btn.onclick=async e=>{
      if(btn.classList.contains('is-loading'))return;
      btn.classList.add('is-loading');btn.setAttribute('aria-busy','true');btn.title='正在刷新…';
      // Give the browser one frame to paint the spinner before worldbook/history work begins.
      await new Promise(requestAnimationFrame);
      try{await original?.call(btn,e);}finally{btn.classList.remove('is-loading');btn.removeAttribute('aria-busy');btn.title='重新读取当前世界书';}
    };
    return true;
  };
  bind();setTimeout(bind,300);
  console.log('[Map-N] refresh loading indicator v1.0.0 installed');
}
install();
