/**
 * BeatGuessr – application bootstrap and screen router.
 */
import { el } from './lib/dom.js';
import { loadSongs } from './lib/songs.js';
import { connectSocket } from './lib/net.js';
import { createHomeScreen } from './screens/home.js';
import { createSetupScreen } from './screens/setup.js';
import { createClassicScreen } from './screens/classic.js';
import { createTimelineScreen } from './screens/timeline.js';
import { createBuzzerHostScreen } from './screens/buzzer-host.js';
import { createBuzzerPlayerScreen } from './screens/buzzer-player.js';

const SCREENS = {
    home: createHomeScreen,
    setup: createSetupScreen,
    classic: createClassicScreen,
    timeline: createTimelineScreen,
    'buzzer-host': createBuzzerHostScreen,
    'buzzer-player': createBuzzerPlayerScreen,
};

const app = document.getElementById('app');
let activeView = null;

async function boot() {
    const { songs, apiAvailable } = await loadSongs();

    // Buzzer mode needs the Flask backend; only dial out when it exists.
    const socket = apiAvailable ? await connectSocket() : null;

    const ctx = {
        songs,
        apiAvailable,
        socket,
        navigate(name, props = {}) {
            const factory = SCREENS[name];
            if (!factory) return;
            if (activeView && activeView.destroy) activeView.destroy();
            activeView = factory(ctx, props);
            app.innerHTML = '';
            app.appendChild(activeView.element);
            window.scrollTo(0, 0);
        },
    };

    if (songs.length === 0) {
        app.innerHTML = '';
        app.appendChild(el('div', { class: 'screen home-screen' },
            el('div', { class: 'home-inner' },
                el('h1', { class: 'hero-title' }, 'BeatGuessr'),
                el('p', { class: 'notice' },
                    'Keine Songdaten gefunden. Stelle sicher, dass data/songs.json vorhanden ist, oder starte den Flask-Server.'),
            )));
        return;
    }

    ctx.navigate('home');
}

boot();
