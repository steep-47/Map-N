// Map-N theme manager v1.0.0
// Follows the actual SillyTavern page luminance instead of the OS color-scheme preference.

const tmWait = ms => new Promise(r => setTimeout(r, ms));

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
    const probes = [
        document.querySelector('#chat'),
        document.querySelector('#sheld'),
        document.querySelector('#form_sheld'),
        document.body,
        document.documentElement,
    ].filter(Boolean);
    for (const el of probes) {
        const rgb = parseRgb(getComputedStyle(el).backgroundColor);
        if (!rgb) continue;
        // Ignore fully transparent / effectively black fallback layers when a later probe is usable.
        if (rgb[0] + rgb[1] + rgb[2] === 0 && getComputedStyle(el).backgroundColor.includes('0)')) continue;
        return luminance(rgb) > .48;
    }
    return false;
}

function ensureLightStyles() {
    if (document.querySelector('#mapN-light-theme-style')) return;
    const style = document.createElement('style');
    style.id = 'mapN-light-theme-style';
    style.textContent = `
#mapN-container.mapN-light{
  background:#fbfaf8!important;color:#3f4248!important;border-color:#ddd8d1!important;
  box-shadow:0 8px 34px rgba(70,55,45,.20)!important;
}
#mapN-container.mapN-light .mapN-header{background:#fbfaf8!important;border-bottom-color:#e9e4de!important}
#mapN-container.mapN-light .mapN-header h2{color:#3d3b3b!important}
#mapN-container.mapN-light .mapN-header h2 span{color:#c56775!important}
#mapN-container.mapN-light .mapN-tools button{background:#f4f1ee!important;border-color:#ddd7d2!important;color:#555b63!important}
#mapN-container.mapN-light .mapN-tools button:hover,#mapN-container.mapN-light .mapN-tools button:active{background:#ebe6e2!important;border-color:#c56775!important;color:#31363c!important}
#mapN-container.mapN-light #mapN-current{background:#f7edef!important;border-color:#d9a7af!important;color:#b95768!important}
#mapN-container.mapN-light #mapN-close-btn{background:#fff7f7!important;border-color:#e6c7c7!important;color:#9d5a5a!important}
#mapN-container.mapN-light #mapN-close-btn:hover{border-color:#c85b5b!important;color:#a73e3e!important}
#mapN-container.mapN-light .mapN-tools button::after{color:#777b81!important}
#mapN-container.mapN-light .mapN-breadcrumb{color:#797d83!important;border-bottom-color:#e8e3de!important}
#mapN-container.mapN-light .mapN-breadcrumb .sep{color:#b8b1aa!important}
#mapN-container.mapN-light .mapN-breadcrumb .crumb{color:#b95768!important}
#mapN-container.mapN-light .mapN-breadcrumb .crumb:hover{color:#9e4051!important}
#mapN-container.mapN-light .mapN-breadcrumb .crumb.current{color:#42464c!important}
#mapN-container.mapN-light .mapN-status{color:#8b8b8b!important}
#mapN-container.mapN-light .mapN-status.error{color:#c84646!important}
#mapN-container.mapN-light .mapN-grid{background:#fffdfb!important;border-color:#e5e0da!important}
#mapN-container.mapN-light .mapN-map-title{color:#4b4e53!important;border-bottom-color:#ece7e2!important}
#mapN-container.mapN-light .mapN-map-node{background:#faf8f6!important;border-color:#e3ded8!important;color:#41464d!important}
#mapN-container.mapN-light .mapN-map-node:hover{background:#f5eeee!important;border-color:#ce7b88!important}
#mapN-container.mapN-light .mapN-map-node.current{background:#faedef!important;border-color:#c56775!important;color:#a84657!important}
#mapN-container.mapN-light .mapN-map-node .water,#mapN-container.mapN-light .mapN-bottom .water{color:#4e79a7!important}
#mapN-container.mapN-light .mapN-map-node .mountain,#mapN-container.mapN-light .mapN-bottom .mountain{color:#9a742e!important}
#mapN-container.mapN-light .mapN-map-node .location,#mapN-container.mapN-light .mapN-bottom .location{color:#a46b32!important}
#mapN-container.mapN-light .mapN-empty,#mapN-container.mapN-light .mapN-more{color:#aaa39c!important}
#mapN-container.mapN-light .mapN-bottom{border-top-color:#e9e4df!important;border-bottom-color:#e9e4df!important}
#mapN-container.mapN-light .mapN-bottom .item{color:#71767c!important}
#mapN-container.mapN-light .mapN-bottom .item:hover{background:#f2ece8!important;color:#b95768!important}
#mapN-container.mapN-light .mapN-bottom .item.current{background:#faedef!important;color:#b95768!important}
#mapN-container.mapN-light .mapN-bottom .item.muted{color:#bbb4ad!important}
#mapN-container.mapN-light .mapN-pos{color:#74787e!important}
#mapN-container.mapN-light .mapN-current-link{color:#b95768!important}
#mapN-container.mapN-light .mapN-characters{color:#777b80!important;border-top-color:#e9e4df!important}
#mapN-container.mapN-light .mapN-characters .label{color:#777b80!important}
#mapN-container.mapN-light .mapN-characters .name{color:#a86f34!important}
#mapN-container.mapN-light #mapN-data-panel{background:#fffdfb!important;border-color:#ded8d2!important;color:#45494f!important;box-shadow:0 6px 24px rgba(70,55,45,.18)!important}
#mapN-container.mapN-light #mapN-data-panel button{background:#f5f1ee!important;border-color:#ded8d2!important;color:#4c5157!important}
#mapN-container.mapN-light #mapN-data-panel button:hover,#mapN-container.mapN-light #mapN-data-panel button:active{background:#eee7e4!important;border-color:#c97a87!important}
`;
    document.head.appendChild(style);
}

function applyMapNTheme(inst) {
    if (!inst?.container) return;
    ensureLightStyles();
    const light = pageIsLight();
    inst.container.classList.toggle('mapN-light', light);
    inst.container.classList.toggle('mapN-dark', !light);
    inst.container.dataset.mapnTheme = light ? 'light' : 'dark';
}

async function installThemeManager() {
    for (let i = 0; i < 120 && !window.MapNInstance; i++) await tmWait(100);
    const inst = window.MapNInstance;
    if (!inst || inst.__mapNThemeManager) return;
    inst.__mapNThemeManager = true;
    applyMapNTheme(inst);

    const refresh = () => setTimeout(() => applyMapNTheme(inst), 60);
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes:true, attributeFilter:['class','style','data-theme'] });
    if (document.body) observer.observe(document.body, { attributes:true, attributeFilter:['class','style','data-theme'] });

    const oldToggle = inst.toggle?.bind(inst);
    if (oldToggle) inst.toggle = function(...args) { applyMapNTheme(this); return oldToggle(...args); };
    const oldRender = inst.render?.bind(inst);
    if (oldRender) inst.render = function(...args) { const r = oldRender(...args); applyMapNTheme(this); return r; };

    console.log(`[Map-N] theme manager installed: ${inst.container.dataset.mapnTheme}`);
}
installThemeManager();
