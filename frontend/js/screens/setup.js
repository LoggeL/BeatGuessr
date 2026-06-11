/**
 * Setup screen for Classic and Timeline: player count, names, rules.
 */
import { el, icon } from '../lib/dom.js';

export const PLAYER_COLORS = ['#f472b6', '#2dd4bf', '#fbbf24', '#a78bfa'];

const CONFIG = {
    classic: {
        icon: 'mic',
        title: 'Classic',
        tagline: 'Erkenne Titel & Künstler!',
        counts: [1, 2, 3, 4],
        defaultCount: 1,
        rules: [
            'Ein Song wird abgespielt (30-Sekunden-Vorschau)',
            'Rate Titel und Künstler',
            'Vergib dir +1 für den Künstler und +1 für den Titel',
            'Danach kommt direkt der nächste Song',
            'Spielt so lange, wie ihr wollt',
        ],
    },
    timeline: {
        icon: 'calendar',
        title: 'Timeline',
        tagline: 'Erkenne die Ära, sortiere die Hits!',
        counts: [2, 3, 4],
        defaultCount: 3,
        rules: [
            'Ein Song wird abgespielt (30-Sekunden-Vorschau)',
            'Rate, wo der Song zeitlich in deine Sammlung passt',
            'Richtig? Der Song wandert in deine Timeline',
            'Falsch? Die Karte wird abgelegt',
            'Wer zuerst 10 Songs gesammelt hat, gewinnt!',
        ],
    },
};

export function createSetupScreen(ctx, { mode }) {
    const { navigate } = ctx;
    const config = CONFIG[mode];
    let playerCount = config.defaultCount;

    const countButtons = config.counts.map(count =>
        el('button', {
            class: 'count-btn', dataset: { count },
            onclick: () => setPlayerCount(count),
        }, `${count}`));

    const nameRows = Array.from({ length: 4 }, (_, i) =>
        el('div', { class: 'player-row' },
            el('span', { class: 'player-dot', style: { background: PLAYER_COLORS[i] } }),
            el('input', {
                class: 'text-input', type: 'text',
                placeholder: `Spieler ${i + 1}`, maxlength: '15',
            }),
        ));

    function setPlayerCount(count) {
        playerCount = count;
        countButtons.forEach(btn =>
            btn.classList.toggle('active', Number(btn.dataset.count) === count));
        nameRows.forEach((row, i) => row.classList.toggle('hidden', i >= count));
    }
    setPlayerCount(playerCount);

    function start() {
        const playerNames = nameRows.slice(0, playerCount).map((row, i) =>
            row.querySelector('input').value.trim() || `Spieler ${i + 1}`);
        navigate(mode, { playerNames });
    }

    const element = el('div', { class: 'screen setup-screen' },
        el('div', { class: 'setup-inner' },
            el('button', { class: 'btn btn-ghost back-btn', onclick: () => navigate('home') },
                icon('arrowRight', 'icon-sm icon-flip'), 'Zurück'),
            el('div', { class: 'setup-head' },
                el('span', { class: 'setup-icon' }, icon(config.icon)),
                el('h1', {}, config.title),
                el('p', { class: 'muted' }, config.tagline),
            ),
            el('div', { class: 'card setup-card' },
                el('label', { class: 'field-label' }, 'Anzahl Spieler'),
                el('div', { class: 'count-row' }, countButtons),
                el('div', { class: 'player-rows' }, nameRows),
                el('button', { class: 'btn btn-primary btn-lg', onclick: start },
                    'Spiel starten', icon('play', 'icon-sm')),
            ),
            el('div', { class: 'card rules-card' },
                el('h3', {}, 'Spielregeln'),
                el('ol', { class: 'rules-list' }, config.rules.map(rule => el('li', {}, rule))),
            ),
        ),
    );

    return { element };
}
