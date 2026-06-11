/**
 * Minimal DOM helpers: hyperscript-style element builder and inline SVG icons.
 */

/**
 * Create an element.
 * el('button', { class: 'btn', onclick: fn, disabled: true }, 'Label', icon('play'))
 */
export function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(props || {})) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') {
            node.className = value;
        } else if (key === 'dataset') {
            Object.assign(node.dataset, value);
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(node.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) {
            node.setAttribute(key, '');
            if (key in node) node[key] = true;
        } else {
            node.setAttribute(key, value);
        }
    }

    append(node, children);
    return node;
}

function append(node, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
        child.forEach(c => append(node, c));
    } else if (child instanceof Node) {
        node.appendChild(child);
    } else {
        node.appendChild(document.createTextNode(String(child)));
    }
}

/** Replace all children of a node. */
export function setChildren(node, ...children) {
    node.innerHTML = '';
    append(node, children);
    return node;
}

/* Filled 24x24 icon paths (Material Design style, rendered with currentColor). */
const ICON_PATHS = {
    play: 'M8 5v14l11-7z',
    pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
    music: 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z',
    mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7.01 7.01 0 0 0 19 11h-2z',
    calendar: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z',
    bell: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    bolt: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12L13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15L11 21z',
    arrowRight: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
    volume: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.47 4.47 0 0 0 16.5 12z',
    close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    lock: 'M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4V6z',
    trophy: 'M19 4h-2V2H7v2H5a2 2 0 0 0-2 2v2c0 2.5 1.84 4.56 4.24 4.94A6.01 6.01 0 0 0 11 16.92V19H8v2h8v-2h-3v-2.08a6.01 6.01 0 0 0 3.76-3.98C19.16 12.56 21 10.5 21 8V6a2 2 0 0 0-2-2zM5 8V6h2v4.82A3 3 0 0 1 5 8zm14 0a3 3 0 0 1-2 2.82V6h2v2z',
    check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    users: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05A4.22 4.22 0 0 1 17 16.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    refresh: 'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z',
    skip: 'M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z',
    eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
};

/** Create an inline SVG icon that inherits currentColor. */
export function icon(name, cls = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', `icon${cls ? ' ' + cls : ''}`);
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', ICON_PATHS[name] || ICON_PATHS.music);
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    return svg;
}

/** Format seconds as m:ss */
export function formatTime(seconds) {
    if (!Number.isFinite(seconds)) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}
