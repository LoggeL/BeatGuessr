/**
 * Backend connectivity for Buzzer mode.
 * The socket.io client is only loaded from the CDN when a backend exists,
 * so the static GitHub Pages build never pays for it.
 */

const SOCKET_IO_CDN = 'https://cdn.socket.io/4.7.2/socket.io.min.js';

/** Static GitHub Pages hosting can never have a socket server. */
export function backendPossible() {
    return !window.location.hostname.endsWith('github.io');
}

let socketPromise = null;

/**
 * Load the socket.io client and connect to the current origin.
 * Resolves with a connected socket or null when unavailable.
 * The returned socket auto-reconnects; callers should watch
 * 'connect'/'disconnect' for availability changes.
 */
export function connectSocket() {
    if (socketPromise) return socketPromise;

    socketPromise = (async () => {
        if (!backendPossible()) return null;

        try {
            await loadScript(SOCKET_IO_CDN);
        } catch {
            return null;
        }
        if (typeof window.io === 'undefined') return null;

        const socket = window.io(window.location.origin, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 3,
            reconnectionDelay: 1000,
            timeout: 2000,
        });

        const connected = await new Promise(resolve => {
            const timer = setTimeout(() => resolve(false), 4000);
            socket.once('connect', () => { clearTimeout(timer); resolve(true); });
            socket.once('connect_error', () => { clearTimeout(timer); resolve(false); });
        });

        if (!connected) {
            socket.close();
            return null;
        }
        return socket;
    })();

    return socketPromise;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
    });
}
