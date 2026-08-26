// Map-N bootstrap v1.0.3
// Visible-first bootstrap: prove that SillyTavern loaded this entry before importing any API.

const makeButton = (id, text, border, color, title, onClick) => {
    let button = document.getElementById(id);
    if (button) return button;
    button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.textContent = text;
    button.title = title;
    Object.assign(button.style, {
        position: 'fixed',
        right: '12px',
        bottom: '70px',
        width: '44px',
        height: '44px',
        zIndex: '100000',
        borderRadius: '50%',
        border: `1px solid ${border}`,
        background: '#1c2333',
        color,
        fontSize: '18px',
    });
    if (onClick) button.addEventListener('click', onClick);
    document.body.appendChild(button);
    return button;
};

// If this appears, manifest -> index.js loading works.
const bootButton = makeButton(
    'mapN-bootstrap-status',
    '🗺️…',
    '#58a6ff',
    '#58a6ff',
    'Map-N 正在启动',
    null,
);

try {
    // Dynamic import is intentionally inside try/catch so import failures are visible.
    const mod = await import('../../../extensions.js');
    const getContext = mod?.getContext;
    if (typeof getContext !== 'function') {
        throw new Error('SillyTavern extensions.js 未导出 getContext');
    }

    window.SillyTavern = window.SillyTavern || {};
    window.SillyTavern.getContext = getContext;

    await import('./Map-N.js');

    // Core creates its own map button. Remove the temporary bootstrap indicator.
    bootButton?.remove();
} catch (error) {
    console.error('[Map-N] 启动失败：', error);
    if (bootButton) {
        bootButton.id = 'mapN-bootstrap-error';
        bootButton.textContent = '🗺️!';
        bootButton.title = 'Map-N 启动失败，点击查看错误';
        bootButton.style.borderColor = '#f85149';
        bootButton.style.color = '#f85149';
        bootButton.addEventListener('click', () => {
            alert(`Map-N 启动失败：\n${error?.message || String(error)}`);
        });
    }
}
