// Map-N bootstrap v1.0.2
// SillyTavern loads extension JavaScript as an ES module. Import the official
// context API here, then expose it for the legacy Map-N core before loading it.
import { getContext } from '../../../extensions.js';

try {
    window.SillyTavern = window.SillyTavern || {};
    if (typeof window.SillyTavern.getContext !== 'function') {
        window.SillyTavern.getContext = getContext;
    }

    await import('./Map-N.js');
} catch (error) {
    console.error('[Map-N] 启动失败：', error);

    // Never fail invisibly: leave a visible diagnostic button on the page.
    if (!document.getElementById('mapN-bootstrap-error')) {
        const button = document.createElement('button');
        button.id = 'mapN-bootstrap-error';
        button.type = 'button';
        button.textContent = '🗺️!';
        button.title = 'Map-N 启动失败，点击查看错误';
        Object.assign(button.style, {
            position: 'fixed',
            right: '12px',
            bottom: '70px',
            width: '44px',
            height: '44px',
            zIndex: '100000',
            borderRadius: '50%',
            border: '1px solid #f85149',
            background: '#1c2333',
            color: '#f85149',
            fontSize: '18px',
        });
        button.addEventListener('click', () => {
            alert(`Map-N 启动失败：\n${error?.message || String(error)}`);
        });
        document.body.appendChild(button);
    }
}
