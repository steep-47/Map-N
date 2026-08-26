// Map-N bootstrap v1.0.5
// Integrate Map-N into SillyTavern's native magic-wand extensions menu.

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

    const container = document.createElement('div');
    container.id = 'mapN-wand-container';
    container.className = 'extension_container';

    const entry = document.createElement('div');
    entry.id = 'mapN-wand-entry';
    entry.className = 'list-group-item flex-container flexGap5 interactable';
    entry.tabIndex = 0;
    entry.title = '打开 Map-N';

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-map-location-dot fa-fw';

    const text = document.createElement('span');
    text.textContent = 'Map-N';

    entry.append(icon, text);
    entry.addEventListener('click', () => {
        window.MapNInstance?.toggle?.();
        menu.style.display = 'none';
    });
    entry.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            entry.click();
        }
    });

    container.appendChild(entry);
    menu.appendChild(container);

    const wandButton = document.querySelector('#extensionsMenuButton');
    if (wandButton) wandButton.style.display = '';

    // Map-N now lives in the native wand menu; never keep a floating launcher.
    document.querySelector('#mapN-float-btn')?.remove();
    return true;
}

try {
    const { getContext } = await import('/scripts/extensions.js');
    if (typeof getContext !== 'function') {
        throw new Error('SillyTavern /scripts/extensions.js 未导出 getContext');
    }

    window.SillyTavern = window.SillyTavern || {};
    window.SillyTavern.getContext = getContext;

    await import('./Map-N.js?v=1.0.5');

    await waitForElement('#extensionsMenu');
    installWandEntry();

    // Core v1.0.1 still creates its old floating button during init, so remove it
    // again after a short delay and ensure the wand entry remains installed.
    setTimeout(() => {
        document.querySelector('#mapN-float-btn')?.remove();
        installWandEntry();
    }, 800);
} catch (error) {
    console.error('[Map-N] 启动失败：', error);
}
