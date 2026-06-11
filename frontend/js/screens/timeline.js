/**
 * Timeline mode: place songs chronologically into your own timeline.
 * Hot-seat for 2–4 players, first to 10 cards wins.
 */
import { el, icon, setChildren } from '../lib/dom.js';
import { Deck } from '../lib/songs.js';
import { sfx } from '../lib/sfx.js';
import { PreviewPlayer, createVinyl, openModal, songCard, confettiBurst, screenHeader } from '../components/widgets.js';
import { PLAYER_COLORS } from './setup.js';

const WIN_SCORE = 10;

class TimelinePlayer {
    constructor(name, color) {
        this.name = name;
        this.color = color;
        this.timeline = []; // songs sorted by year
    }

    get score() {
        return this.timeline.length;
    }

    hasWon() {
        return this.score >= WIN_SCORE;
    }

    addCard(song) {
        this.timeline.push(song);
        this.timeline.sort((a, b) => a.year - b.year);
    }

    /** N cards have N+1 insert positions: before, between each pair, after. */
    positionOptions() {
        const years = this.timeline.map(s => s.year);
        if (years.length === 0) return [{ position: 0, label: 'Erste Karte' }];

        const options = [{ position: 0, label: `Vor ${years[0]}` }];
        for (let i = 0; i < years.length - 1; i++) {
            options.push({ position: i + 1, label: `${years[i]} – ${years[i + 1]}` });
        }
        options.push({ position: years.length, label: `Nach ${years[years.length - 1]}` });
        return options;
    }

    isCorrectGuess(position, year) {
        const years = this.timeline.map(s => s.year);
        if (years.length === 0) return true;
        const before = position > 0 ? years[position - 1] : -Infinity;
        const after = position < years.length ? years[position] : Infinity;
        return year >= before && year <= after;
    }
}

export function createTimelineScreen(ctx, { playerNames }) {
    const { navigate, songs } = ctx;

    const players = playerNames.map((name, i) => new TimelinePlayer(name, PLAYER_COLORS[i % PLAYER_COLORS.length]));
    const deck = new Deck(songs);

    let currentIndex = 0;
    let currentSong = null;
    let selectedPosition = null;
    let activeModal = null;

    /* --- DOM ------------------------------------------------------ */
    const vinyl = createVinyl();
    const player = new PreviewPlayer({ onPlayStateChange: p => vinyl.setSpinning(p) });

    const turnLabel = el('div', { class: 'turn-label' });
    const pillsArea = el('div', { class: 'header-stats' });
    const timelineStrip = el('div', { class: 'timeline-strip' });
    const selectionHint = el('p', { class: 'hint' }, 'Wähle eine Lücke in der Timeline.');
    const confirmBtn = el('button', {
        class: 'btn btn-primary btn-lg', disabled: true,
        onclick: () => submitGuess(),
    }, 'Auswahl bestätigen', icon('check', 'icon-sm'));

    const element = el('div', { class: 'screen game-screen-shell' },
        screenHeader({
            iconName: 'calendar',
            title: 'Timeline',
            center: pillsArea,
            right: el('button', {
                class: 'btn btn-icon', title: 'Beenden', 'aria-label': 'Beenden',
                onclick: () => exit(),
            }, icon('close')),
        }),
        el('main', { class: 'game-main timeline-main' },
            el('div', { class: 'now-playing card slim' },
                vinyl.element,
                el('div', { class: 'now-playing-info' },
                    turnLabel,
                    el('h2', { class: 'song-title mystery' }, '??? – ???'),
                    player.element,
                ),
            ),
            el('section', { class: 'timeline-section card' },
                el('h3', { class: 'section-title' }, 'Wo passt dieser Song?'),
                timelineStrip,
                el('div', { class: 'confirm-row' }, selectionHint, confirmBtn),
            ),
        ),
    );

    /* --- rendering ------------------------------------------------ */
    function currentPlayer() {
        return players[currentIndex];
    }

    function renderHeader() {
        const active = currentPlayer();
        setChildren(turnLabel,
            el('span', { class: 'player-dot', style: { background: active.color } }),
            el('b', {}, active.name),
            el('span', { class: 'muted' }, ` · ${active.score}/${WIN_SCORE} Karten`));
        setChildren(pillsArea, players.map((p, i) =>
            el('span', { class: `player-pill${i === currentIndex ? ' active' : ''}` },
                el('span', { class: 'player-dot', style: { background: p.color } }),
                `${p.name}: ${p.score}`)));
    }

    function renderTimeline() {
        const active = currentPlayer();
        const options = active.positionOptions();
        const nodes = [];

        const slotFor = option => el('button', {
            class: `slot-btn${selectedPosition === option.position ? ' selected' : ''}`,
            title: option.label,
            onclick: () => selectPosition(option.position),
        },
            el('span', { class: 'slot-plus' }, '+'),
            el('span', { class: 'slot-label' }, option.label));

        active.timeline.forEach((song, i) => {
            nodes.push(slotFor(options[i]));
            nodes.push(songCard(song));
        });
        nodes.push(slotFor(options[options.length - 1]));

        setChildren(timelineStrip, nodes);
    }

    function selectPosition(position) {
        selectedPosition = position;
        confirmBtn.disabled = false;
        const label = currentPlayer().positionOptions().find(o => o.position === position)?.label;
        selectionHint.textContent = `Einordnen: ${label}`;
        renderTimeline();
    }

    /* --- game flow ------------------------------------------------ */
    function startTurn() {
        currentSong = deck.draw();
        if (!currentSong) return endByExhaustion();

        selectedPosition = null;
        confirmBtn.disabled = true;
        selectionHint.textContent = 'Wähle eine Lücke in der Timeline.';
        vinyl.conceal();
        player.load(currentSong.preview_url, { autoplay: true });
        renderHeader();
        renderTimeline();
    }

    function submitGuess() {
        if (selectedPosition === null || !currentSong) return;
        player.stop();

        const active = currentPlayer();
        const correct = active.isCorrectGuess(selectedPosition, currentSong.year);
        if (correct) {
            active.addCard(currentSong);
            sfx.correct();
        } else {
            sfx.wrong();
        }

        const won = active.hasWon();
        showRevealModal({ correct, song: currentSong, player: active, won });
    }

    function showRevealModal({ correct, song, player: active, won }) {
        activeModal = openModal(el('div', { class: 'reveal-modal' },
            el('img', { class: 'reveal-cover', src: song.cover_url || '', alt: 'Album-Cover' }),
            el('h2', { class: 'reveal-title' }, song.title),
            el('p', { class: 'reveal-artist' }, song.artist),
            el('div', { class: 'reveal-year-box' },
                el('span', { class: 'reveal-year' }, `${song.year}`),
                song.context ? el('span', { class: 'reveal-context' }, song.context) : null),
            el('div', { class: `result-banner ${correct ? 'correct' : 'incorrect'}` },
                icon(correct ? 'check' : 'close', 'icon-sm'),
                correct ? 'Richtig! Karte hinzugefügt.' : 'Falsch! Karte abgelegt.'),
            el('button', {
                class: 'btn btn-primary btn-lg',
                onclick: () => {
                    activeModal.close();
                    activeModal = null;
                    if (won) showWinScreen(active);
                    else nextTurn();
                },
            }, won ? 'Gewonnen!' : 'Nächster Spieler', icon(won ? 'trophy' : 'arrowRight', 'icon-sm')),
        ));
    }

    function nextTurn() {
        currentIndex = (currentIndex + 1) % players.length;
        startTurn();
    }

    function showWinScreen(winner) {
        player.stop();
        const winView = el('div', { class: 'win-screen' },
            el('div', { class: 'trophy-mark' }, icon('trophy')),
            el('h1', { class: 'winner-name', style: { color: winner.color } }, winner.name),
            el('p', { class: 'win-subtitle' }, 'hat gewonnen!'),
            el('div', { class: 'final-timeline' },
                el('h3', { class: 'section-title' }, 'Finale Timeline'),
                el('div', { class: 'timeline-strip static' }, winner.timeline.map(song => songCard(song)))),
            el('button', { class: 'btn btn-primary btn-lg', onclick: () => navigate('home') },
                'Nochmal spielen', icon('refresh', 'icon-sm')),
        );
        confettiBurst(winView);
        setChildren(element, winView);
    }

    function endByExhaustion() {
        const best = [...players].sort((a, b) => b.score - a.score)[0];
        showWinScreen(best);
    }

    function exit() {
        player.stop();
        navigate('home');
    }

    /* --- start ---------------------------------------------------- */
    players.forEach(p => {
        const card = deck.draw();
        if (card) p.addCard(card);
    });
    startTurn();

    return {
        element,
        destroy() {
            if (activeModal) activeModal.close();
            player.destroy();
        },
    };
}
