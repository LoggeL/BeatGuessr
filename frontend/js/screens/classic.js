/**
 * Classic mode: listen, guess title & artist, self-score 0/1/2.
 * Endless play, hot-seat for 2–4 players.
 */
import { el, icon, setChildren } from '../lib/dom.js';
import { Deck } from '../lib/songs.js';
import { sfx } from '../lib/sfx.js';
import { PreviewPlayer, createVinyl, openModal, screenHeader } from '../components/widgets.js';
import { PLAYER_COLORS } from './setup.js';

const SCORE_OPTIONS = [
    { points: 0, label: 'Nichts' },
    { points: 1, label: 'Titel oder Künstler' },
    { points: 2, label: 'Beides!' },
];

export function createClassicScreen(ctx, { playerNames }) {
    const { navigate, songs } = ctx;

    const players = playerNames.map((name, i) => ({
        name,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        points: 0,
    }));
    const multiplayer = players.length > 1;
    const deck = new Deck(songs, { autoReset: true });

    let currentSong = null;
    let songsPlayed = 0;
    let currentIndex = 0;
    let activeModal = null;

    /* --- DOM ------------------------------------------------------ */
    const vinyl = createVinyl({ size: 'lg' });
    const player = new PreviewPlayer({ onPlayStateChange: p => vinyl.setSpinning(p) });

    const statsArea = el('div', { class: 'header-stats' });
    const songTitle = el('h2', { class: 'song-title mystery' }, '??? – ???');
    const songMeta = el('p', { class: 'song-meta' }, 'Drück auf Play und hör genau hin.');
    const actionArea = el('div', { class: 'action-area' });

    const element = el('div', { class: 'screen game-screen-shell' },
        screenHeader({
            iconName: 'mic',
            title: 'Classic',
            center: statsArea,
            right: el('button', {
                class: 'btn btn-icon', title: 'Beenden', 'aria-label': 'Beenden',
                onclick: () => exit(),
            }, icon('close')),
        }),
        el('main', { class: 'game-main classic-main' },
            el('div', { class: 'now-playing card' },
                vinyl.element,
                el('div', { class: 'now-playing-info' },
                    songTitle,
                    songMeta,
                    player.element,
                ),
            ),
            actionArea,
        ),
    );

    /* --- rendering ------------------------------------------------ */
    function renderStats() {
        if (multiplayer) {
            setChildren(statsArea, players.map((p, i) =>
                el('span', { class: `player-pill${i === currentIndex ? ' active' : ''}` },
                    el('span', { class: 'player-dot', style: { background: p.color } }),
                    `${p.name}: ${p.points}`)));
        } else {
            setChildren(statsArea,
                el('span', { class: 'stat' }, el('b', {}, `${players[0].points}`), ' Punkte'),
                el('span', { class: 'stat' }, el('b', {}, `${songsPlayed}`), ' Songs'),
            );
        }
    }

    function renderPreReveal() {
        setChildren(actionArea,
            el('p', { class: 'hint' }, 'Höre den Song und rate Titel & Künstler!'),
            el('button', { class: 'btn btn-primary btn-lg', onclick: reveal },
                'Auflösen', icon('eye', 'icon-sm')),
        );
    }

    function renderPostReveal() {
        setChildren(actionArea,
            el('p', { class: 'hint' }, multiplayer
                ? `${players[currentIndex].name}, wie viel hast du gewusst?`
                : 'Wie viel hast du gewusst?'),
            el('div', { class: 'score-row' }, SCORE_OPTIONS.map(option =>
                el('button', { class: 'score-btn', onclick: () => scoreAndAdvance(option.points) },
                    el('span', { class: 'score-points' }, `+${option.points}`),
                    el('span', { class: 'score-label' }, option.label)))),
        );
    }

    /* --- game flow ------------------------------------------------ */
    function loadNextSong({ autoplay = true } = {}) {
        currentSong = deck.draw();
        if (!currentSong) return exit();

        vinyl.conceal();
        songTitle.classList.add('mystery');
        songTitle.textContent = '??? – ???';
        songMeta.textContent = 'Drück auf Play und hör genau hin.';
        player.load(currentSong.preview_url, { autoplay });
        renderPreReveal();
        renderStats();
    }

    function reveal() {
        if (!currentSong) return;
        vinyl.reveal(currentSong.cover_url);
        songTitle.classList.remove('mystery');
        songTitle.textContent = `${currentSong.artist} – ${currentSong.title}`;
        songMeta.textContent = `${currentSong.year}${currentSong.context ? ` · ${currentSong.context}` : ''}`;
        renderPostReveal();
    }

    function scoreAndAdvance(points) {
        players[currentIndex].points += points;
        songsPlayed += 1;
        if (points > 0) sfx.correct(); else sfx.tick();
        player.stop();

        if (multiplayer) {
            currentIndex = (currentIndex + 1) % players.length;
            renderStats();
            showTurnModal();
        } else {
            loadNextSong();
        }
    }

    function showTurnModal() {
        const next = players[currentIndex];
        activeModal = openModal(el('div', { class: 'turn-modal' },
            el('p', { class: 'muted' }, 'Nächster Spieler'),
            el('h2', { class: 'turn-name', style: { color: next.color } }, next.name),
            el('button', {
                class: 'btn btn-primary btn-lg',
                onclick: () => { activeModal.close(); activeModal = null; loadNextSong(); },
            }, 'Los geht’s', icon('play', 'icon-sm')),
        ));
    }

    function exit() {
        player.stop();
        navigate('home');
    }

    /* --- start ---------------------------------------------------- */
    renderStats();
    if (multiplayer) {
        renderPreReveal();
        showTurnModal();
    } else {
        loadNextSong({ autoplay: false });
    }

    return {
        element,
        destroy() {
            if (activeModal) activeModal.close();
            player.destroy();
        },
    };
}
