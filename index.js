// Map-N bootstrap v1.3.1
async function waitForElement(selector, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el) return el;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
}
function installWandEntry() {
    const menu = document.querySelector('#extensionsMenu');
    if (!menu || document.querySelector('#mapN-wand-container')) return false;
    const container = document.createElement('div'); container.id='mapN-wand-container'; container.className='extension_container';
    const entry=document.createElement('div'); entry.id='mapN-wand-entry'; entry.className='list-group-item flex-container flexGap5 interactable'; entry.tabIndex=0; entry.title='打开 Map-N';
    const icon=document.createElement('i'); icon.className='fa-solid fa-map-location-dot fa-fw'; const text=document.createElement('span'); text.textContent='Map-N'; entry.append(icon,text);
    entry.addEventListener('click',()=>{window.MapNInstance?.toggle?.();menu.style.display='none'}); entry.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();entry.click()}});
    container.appendChild(entry);menu.appendChild(container);const wandButton=document.querySelector('#extensionsMenuButton');if(wandButton)wandButton.style.display='';document.querySelector('#mapN-float-btn')?.remove();return true;
}
try {
    const { getContext }=await import('/scripts/extensions.js'); if(typeof getContext!=='function')throw new Error('SillyTavern /scripts/extensions.js 未导出 getContext');
    window.SillyTavern=window.SillyTavern||{};window.SillyTavern.getContext=getContext;
    await import('./Map-N.js?v=1.3.1');
    await import('./scene-scanner.js?v=1.3.1');
    await import('./hierarchy-resolver.js?v=1.3.1');
    await import('./presence-resolver.js?v=1.3.1');
    await import('./data-manager.js?v=1.3.1');
    await waitForElement('#extensionsMenu');installWandEntry();setTimeout(()=>{document.querySelector('#mapN-float-btn')?.remove();installWandEntry()},800);
} catch(error){console.error('[Map-N] 启动失败：',error)}
