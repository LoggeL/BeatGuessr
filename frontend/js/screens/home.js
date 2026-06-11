/**
 * Home screen: mode selection and room join.
 */
import { el, icon } from '../lib/dom.js';

const MODES = [
    {
        id: 'classic',
        icon: 'mic',
        title: 'Classic',
        meta: '1–4 Spieler · ein Gerät',
        text: 'Erkenne Titel & Künstler und bewerte dich selbst. Endlosmodus – solo oder reihum.',
    },
    {
        id: 'timeline',
        icon: 'calendar',
        title: 'Timeline',
        meta: '2–4 Spieler · ein Gerät',
        text: 'Sortiere Songs chronologisch in deine Sammlung. Wer zuerst 10 Karten hat, gewinnt.',
    },
    {
        id: 'buzzer',
        icon: 'bell',
        title: 'Buzzer',
        meta: 'beliebig viele · mehrere Geräte',
        text: 'Wer zuerst buzzert, darf raten. Falsch geraten? Für die Runde gesperrt!',
    },
];

export function createHomeScreen(ctx) {
    const { navigate, songs, socket } = ctx;

    const notice = el('p', { class: 'notice hidden', role: 'status', 'aria-live': 'polite' });

    function showNotice(message) {
        notice.textContent = message;
        notice.classList.remove('hidden');
    }

    const socketReady = () => Boolean(socket && socket.connected);

    /* Mode cards */
    const modeCards = MODES.map(mode => {
        const card = el('button', {
            class: 'mode-card',
            dataset: { mode: mode.id },
            onclick: () => {
                if (mode.id === 'buzzer') {
                    if (!socketReady()) {
                        showNotice('Buzzer braucht den Spielserver. Starte lokal den Flask-Server (backend/app.py), dann ist der Modus verfügbar.');
                        return;
                    }
                    navigate('buzzer-host');
                } else {
                    navigate('setup', { mode: mode.id });
                }
            },
        },
            el('span', { class: 'mode-card-icon' }, icon(mode.icon)),
            el('span', { class: 'mode-card-title' }, mode.title),
            el('span', { class: 'mode-card-meta' }, mode.meta),
            el('span', { class: 'mode-card-text' }, mode.text),
            mode.id === 'buzzer' ? el('span', { class: 'mode-card-badge' }, 'Server erforderlich') : null,
        );
        return card;
    });

    function refreshBuzzerCard() {
        const card = modeCards.find(c => c.dataset.mode === 'buzzer');
        card.classList.toggle('is-disabled', !socketReady());
        card.setAttribute('aria-disabled', String(!socketReady()));
    }
    refreshBuzzerCard();

    const onSocketChange = () => refreshBuzzerCard();
    if (socket) {
        socket.on('connect', onSocketChange);
        socket.on('disconnect', onSocketChange);
    }

    /* Join form */
    const codeInput = el('input', {
        class: 'text-input code-input', type: 'text', placeholder: 'Raumcode',
        maxlength: '6', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
    });
    const nameInput = el('input', {
        class: 'text-input', type: 'text', placeholder: 'Dein Name', maxlength: '15',
    });

    function joinRoom() {
        const roomCode = codeInput.value.trim().toUpperCase();
        const playerName = nameInput.value.trim();
        if (!socketReady()) return showNotice('Beitreten geht nur, wenn der Buzzer-Server läuft.');
        if (!roomCode) return showNotice('Bitte gib einen Raumcode ein.');
        if (!playerName) return showNotice('Bitte gib deinen Namen ein.');
        navigate('buzzer-player', { roomCode, playerName });
    }

    [codeInput, nameInput].forEach(input =>
        input.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); }));

    const element = el('div', { class: 'screen home-screen' },
        el('div', { class: 'home-inner' },
            el('div', { class: 'hero' },
                el('div', { class: 'hero-mark', 'aria-hidden': 'true' },
                    el('div', { class: 'vinyl vinyl-sm spinning' },
                        el('div', { class: 'vinyl-disc' }, el('div', { class: 'vinyl-label' })))),
                el('p', { class: 'hero-kicker' }, `${songs.length || '660'} Songs · 1960–2025`),
                el('h1', { class: 'hero-title' }, 'BeatGuessr'),
                el('p', { class: 'hero-tagline' }, 'Erkenne den Song, ordne die Jahrzehnte – oder schnapp dir den Buzzer.'),
            ),
            notice,
            el('div', { class: 'mode-grid' }, modeCards),
            el('div', { class: 'join-section' },
                el('div', { class: 'join-divider' }, el('span', {}, 'oder einem Spiel beitreten')),
                el('div', { class: 'join-form' },
                    codeInput,
                    nameInput,
                    el('button', { class: 'btn btn-primary', onclick: joinRoom },
                        'Beitreten', icon('arrowRight', 'icon-sm')),
                ),
            ),
        ),
    );

    return {
        element,
        destroy() {
            if (socket) {
                socket.off('connect', onSocketChange);
                socket.off('disconnect', onSocketChange);
            }
        },
    };
}
