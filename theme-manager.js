// Map-N theme manager v1.1.0
// Auto-follows SillyTavern by default, with persistent manual light/dark overrides.

const tmWait = ms => new Promise(r => setTimeout(r, ms));
const THEME_KEY = 'mapN:theme-mode-v1';

function parseRgb(value) {
    const m = String(value || '').match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function luminance(rgb) {
    if (!rgb) return 0;
    const c = rgb.map(v => {
        v /= 255;
        return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
    });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
function pageIsLight() {
    const probes = [document.querySelector('#chat'),document.querySelector('#sheld'),document.querySelector('#form_sheld'),document.body,document.documentElement].filter(Boolean);
    for (const el of probes) {
        const bg=getComputedStyle(el).backgroundColor, rgb=parseRgb(bg);
        if (!rgb) continue;
        if (rgb[0]+rgb[1]+rgb[2]===0 && bg.includes('0)')) continue;
        return luminance(rgb) > .48;
    }
    return false;
}
function getMode(){const v=localStorage.getItem(THEME_KEY);return ['auto','light','dark'].includes(v)?v:'auto'}
function setMode(mode){if(!['auto','light','dark'].includes(mode))mode='auto';localStorage.setItem(THEME_KEY,mode);window.dispatchEvent(new CustomEvent('mapn-theme-mode-changed',{detail:{mode}}));const inst=window.MapNInstance;if(inst)applyMapNTheme(inst);return mode}
function resolvedTheme(){const mode=getMode();return mode==='auto'?(pageIsLight()?'light':'dark'):mode}

function ensureLightStyles() {
    if (document.querySelector('#mapN-light-theme-style')) return;
    const style = document.createElement('style');
    style.id = 'mapN-light-theme-style';
    style.textContent = `
#mapN-container.mapN-light{background:#fcf9f5!important;color:#403f42!important;border-color:#dfd8d0!important;box-shadow:0 8px 34px rgba(82,60,45,.18)!important}
#mapN-container.mapN-light .mapN-header{background:#fcf9f5!important;border-bottom-color:#ebe3dc!important}
#mapN-container.mapN-light .mapN-header h2{color:#3d3b3b!important}
#mapN-container.mapN-light .mapN-header h2 span{color:#c56775!important}
#mapN-container.mapN-light .mapN-tools button{background:#f5efea!important;border-color:#ded5ce!important;color:#55575c!important}
#mapN-container.mapN-light .mapN-tools button:hover,#mapN-container.mapN-light .mapN-tools button:active{background:#eee5df!important;border-color:#c56775!important;color:#313338!important}
#mapN-container.mapN-light #mapN-current{background:#f8ecee!important;border-color:#d9a7af!important;color:#b95768!important}
#mapN-container.mapN-light #mapN-close-btn{background:#fff6f5!important;border-color:#e6c7c7!important;color:#9d5a5a!important}
#mapN-container.mapN-light #mapN-close-btn:hover{border-color:#c85b5b!important;color:#a73e3e!important}
#mapN-container.mapN-light .mapN-tools button::after{color:#77797d!important}
#mapN-container.mapN-light .mapN-breadcrumb{color:#797a7e!important;border-bottom-color:#e9e1da!important}
#mapN-container.mapN-light .mapN-breadcrumb .sep{color:#b8afa8!important}
#mapN-container.mapN-light .mapN-breadcrumb .crumb{color:#b95768!important}
#mapN-container.mapN-light .mapN-breadcrumb .crumb:hover{color:#9e4051!important}
#mapN-container.mapN-light .mapN-breadcrumb .crumb.current{color:#424347!important}
#mapN-container.mapN-light .mapN-status{color:#8d8986!important}
#mapN-container.mapN-light .mapN-status.error{color:#c84646!important}
#mapN-container.mapN-light .mapN-grid{background:#fffaf6!important;border-color:#e6ddd5!important}
#mapN-container.mapN-light .mapN-map-title{color:#4b4c50!important;border-bottom-color:#eee5de!important}
#mapN-container.mapN-light .mapN-map-node{background:#fbf6f2!important;border-color:#e4dbd3!important;color:#414348!important}
#mapN-container.mapN-light .mapN-map-node:hover{background:#f6ece9!important;border-color:#ce7b88!important}
#mapN-container.mapN-light .mapN-map-node.current{background:#faecee!important;border-color:#c56775!important;color:#a84657!important}
#mapN-container.mapN-light .mapN-map-node .water,#mapN-container.mapN-light .mapN-bottom .water{color:#4e79a7!important}
#mapN-container.mapN-light .mapN-map-node .mountain,#mapN-container.mapN-light .mapN-bottom .mountain{color:#9a742e!important}
#mapN-container.mapN-light .mapN-map-node .location,#mapN-container.mapN-light .mapN-bottom .location{color:#a46b32!important}
#mapN-container.mapN-light .mapN-empty,#mapN-container.mapN-light .mapN-more{color:#aaa19a!important}
#mapN-container.mapN-light .mapN-bottom{border-top-color:#eae1da!important;border-bottom-color:#eae1da!important}
#mapN-container.mapN-light .mapN-bottom .item{color:#717277!important}
#mapN-container.mapN-light .mapN-bottom .item:hover{background:#f3e9e4!important;color:#b95768!important}
#mapN-container.mapN-light .mapN-bottom .item.current{background:#faecee!important;color:#b95768!important}
#mapN-container.mapN-light .mapN-bottom .item.muted{color:#bbb1aa!important}
#mapN-container.mapN-light .mapN-pos{color:#747579!important}
#mapN-container.mapN-light .mapN-current-link{color:#b95768!important}
#mapN-container.mapN-light .mapN-characters{color:#77787c!important;border-top-color:#eae1da!important}
#mapN-container.mapN-light .mapN-characters .label{color:#77787c!important}
#mapN-container.mapN-light .mapN-characters .name{color:#a86f34!important}
#mapN-container.mapN-light #mapN-data-panel{background:#fffaf6!important;border-color:#dfd6ce!important;color:#45464a!important;box-shadow:0 6px 24px rgba(82,60,45,.16)!important}
#mapN-container.mapN-light #mapN-data-panel button{background:#f6efea!important;border-color:#dfd6ce!important;color:#4c4e52!important}
#mapN-container.mapN-light #mapN-data-panel button:hover,#mapN-container.mapN-light #mapN-data-panel button:active{background:#efe5df!important;border-color:#c97a87!important}
#mapN-container.mapN-light #mapN-data-panel .mapN-theme-choice.active{background:#f8e9ec!important;border-color:#c56775!important;color:#a84657!important}
#mapN-container.mapN-dark #mapN-data-panel .mapN-theme-choice.active{border-color:#58a6ff!important;color:#79c0ff!important;background:#162337!important}
`;
    document.head.appendChild(style);
}
function applyMapNTheme(inst) {
    if (!inst?.container) return;
    ensureLightStyles();
    const theme=resolvedTheme(), light=theme==='light';
    inst.container.classList.toggle('mapN-light',light);inst.container.classList.toggle('mapN-dark',!light);
    inst.container.dataset.mapnTheme=theme;inst.container.dataset.mapnThemeMode=getMode();
    window.dispatchEvent(new CustomEvent('mapn-theme-applied',{detail:{mode:getMode(),theme}}));
}
window.MapNTheme={getMode,setMode,apply:()=>window.MapNInstance&&applyMapNTheme(window.MapNInstance),resolvedTheme};

async function installThemeManager() {
    for(let i=0;i<120&&!window.MapNInstance;i++)await tmWait(100);const inst=window.MapNInstance;if(!inst||inst.__mapNThemeManager)return;inst.__mapNThemeManager=true;applyMapNTheme(inst);
    const refresh=()=>{if(getMode()==='auto')setTimeout(()=>applyMapNTheme(inst),60)};
    const observer=new MutationObserver(refresh);observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});if(document.body)observer.observe(document.body,{attributes:true,attributeFilter:['class','style','data-theme']});
    const oldToggle=inst.toggle?.bind(inst);if(oldToggle)inst.toggle=function(...args){applyMapNTheme(this);return oldToggle(...args)};
    const oldRender=inst.render?.bind(inst);if(oldRender)inst.render=function(...args){const r=oldRender(...args);applyMapNTheme(this);return r};
    console.log(`[Map-N] theme manager installed: ${getMode()} -> ${inst.container.dataset.mapnTheme}`);
}
installThemeManager();
