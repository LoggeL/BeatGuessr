/**
 * Buzzer mode – player screen. Mobile-first: one giant buzzer.
 */
import { el, icon, setChildren } from '../lib/dom.js';
import { sfx } from '../lib/sfx.js';
import { openModal, scoreboard, screenHeader } from '../components/widgets.js';

export function createBuzzerPlayerScreen(ctx, { roomCode, playerName }) {
    const { navigate, socket } = ctx;

    if (!socket || !socket.connected) {
        queueMicrotask(() => navigate('home'));
        return { element: el('div') };
    }

    let players = [];
    let maxScore = 10;
    let gameStarted = false;
    let roundActive = false;
    let isLockedOut = false;
    let hasBuzzed = false;
    let activeModal = null;
    let exitTimer = null;

    /* --- DOM ------------------------------------------------------ */
    const scoreChip = el('span', { class: 'room-chip' }, '0 Punkte');
    const statusText = el('p', { class: 'buzzer-status' }, 'Warte auf Spielstart …');
    const feedback = el('p', { class: 'buzzer-feedback hidden', role: 'status', 'aria-live': 'polite' });
    const buzzerBtn = el('button', { class: 'buzzer-btn waiting', disabled: true, onclick: () => buzz() },
        icon('bolt', 'buzzer-icon'),
        el('span', { class: 'buzzer-text' }, 'BUZZ!'));
    const body = el('main', { class: 'game-main buzzer-player-main' });

    const element = el('div', { class: 'screen game-screen-shell' },
        screenHeader({
            iconName: 'bell',
            title: playerName,
            center: el('span', { class: 'room-chip' }, `Raum ${roomCode}`),
            right: scoreChip,
        }),
        body,
    );

    const lobbyList = el('div', { class: 'player-list' });

    function renderLobby() {
        setChildren(body, el('div', { class: 'centered-column' },
            el('div', { class: 'card setup-card lobby-card' },
                el('h2', {}, 'Warte auf Spielstart …'),
                el('p', { class: 'muted' }, 'Der Host startet das Spiel in Kürze.'),
                el('h3', { class: 'section-title' }, 'Spieler im Raum'),
                lobbyList,
            ),
        ));
    }

    const scoreboardArea = el('div', { class: 'card scoreboard-card' });

    function renderGame() {
        setChildren(body,
            el('div', { class: 'buzzer-stage' }, statusText, buzzerBtn, feedback),
            scoreboardArea,
        );
        renderScoreboard();
    }

    function renderScoreboard() {
        setChildren(scoreboardArea, scoreboard(players, { meId: socket.id, maxScore }));
    }

    /* --- buzzer state machine -------------------------------------- */
    function setBuzzerState(state, text) {
        buzzerBtn.classList.remove('waiting', 'ready', 'buzzed', 'locked');
        buzzerBtn.classList.add(state);
        buzzerBtn.disabled = state !== 'ready';
        statusText.textContent = text;
    }

    function refreshBuzzerState(state) {
        if (!gameStarted) return;
        if (!roundActive) setBuzzerState('waiting', 'Warte auf nächste Runde …');
        else if (isLockedOut) setBuzzerState('locked', 'Gesperrt für diese Runde');
        else if (hasBuzzed) setBuzzerState('buzzed', 'Du hast gebuzzert!');
        else if (state && state.currentBuzzer) setBuzzerState('buzzed', `${state.currentBuzzer.name} antwortet …`);
        else setBuzzerState('ready', 'Drück den Buzzer!');
    }

    function buzz() {
        if (buzzerBtn.disabled || isLockedOut || hasBuzzed || !roundActive) return;
        if (!socket.connected) return;
        hasBuzzed = true;
        socket.emit('buzz');
        sfx.buzz();
        if (navigator.vibrate) navigator.vibrate(80);
        setBuzzerState('buzzed', 'Du hast gebuzzert!');
    }

    function onKeydown(event) {
        if (event.code === 'Space' && gameStarted) {
            event.preventDefault();
            buzz();
        }
    }
    document.addEventListener('keydown', onKeydown);

    /* --- feedback --------------------------------------------------- */
    function showFeedback(message, type = 'info') {
        feedback.textContent = message;
        feedback.className = `buzzer-feedback ${type}`;
    }

    function hideFeedback() {
        feedback.className = 'buzzer-feedback hidden';
    }

    /* --- socket handlers -------------------------------------------- */
    const handlers = {
        joined_room(data) {
            gameStarted = data.gameStarted;
            if (gameStarted) {
                renderGame();
                refreshBuzzerState();
            }
        },
        room_state(state) {
            players = state.players || [];
            roundActive = state.roundActive;
            maxScore = state.maxScore || maxScore;

            const me = players.find(p => p.id === socket.id);
            if (me) {
                isLockedOut = me.isLockedOut;
                scoreChip.textContent = `${me.score} Punkte`;
            }

            setChildren(lobbyList, players.map(p =>
                el('div', { class: `player-row static${p.isConnected === false ? ' disconnected' : ''}` },
                    el('span', { class: 'player-dot' }),
                    el('span', {}, p.name + (p.id === socket.id ? ' (Du)' : '')),
                )));
            renderScoreboard();
            refreshBuzzerState(state);
        },
        game_started() {
            gameStarted = true;
            renderGame();
            refreshBuzzerState();
        },
        round_started() {
            roundActive = true;
            isLockedOut = false;
            hasBuzzed = false;
            hideFeedback();
            setBuzzerState('ready', 'Drück den Buzzer!');
        },
        player_buzzed(data) {
            if (data.playerId !== socket.id) sfx.buzz();
        },
        judge_result(data) {
            if (data.playerId === socket.id) {
                if (data.points > 0) {
                    sfx.correct();
                    const parts = [];
                    if (data.correctArtist) parts.push('Künstler');
                    if (data.correctTitle) parts.push('Titel');
                    showFeedback(`+${data.points} Punkt${data.points > 1 ? 'e' : ''}! (${parts.join(' & ')} richtig)`, 'success');
                } else {
                    sfx.wrong();
                    isLockedOut = true;
                    setBuzzerState('locked', 'Gesperrt für diese Runde');
                    showFeedback('Falsch! Gesperrt für diese Runde.', 'error');
                }
            } else if (data.points > 0) {
                showFeedback(`${data.playerName} bekommt ${data.points} Punkt${data.points > 1 ? 'e' : ''}!`, 'info');
            } else if (data.lockedOut) {
                showFeedback(`${data.playerName} wurde gesperrt!`, 'info');
            }

            if (data.roundEnded) {
                roundActive = false;
                isLockedOut = false;
                hasBuzzed = false;
                refreshBuzzerState();
                if (data.song && data.song.title) {
                    setTimeout(() => showFeedback(`Es war: „${data.song.title}“ von ${data.song.artist}`, 'info'), 1500);
                }
            }
        },
        round_skipped(data) {
            roundActive = false;
            isLockedOut = false;
            hasBuzzed = false;
            refreshBuzzerState();
            if (data && data.song && data.song.title) {
                showFeedback(`Übersprungen – es war: „${data.song.title}“ von ${data.song.artist}`, 'info');
            }
        },
        game_ended(data) {
            activeModal = openModal(el('div', { class: 'gameover-modal' },
                el('div', { class: 'trophy-mark' }, icon('trophy')),
                el('h2', {}, data.winner || 'Niemand'),
                el('p', { class: 'win-subtitle' }, 'hat gewonnen!'),
                scoreboard(data.finalScores || [], { meId: socket.id }),
                el('button', {
                    class: 'btn btn-primary btn-lg',
                    onclick: () => { activeModal.close(); activeModal = null; navigate('home'); },
                }, 'Zurück zum Menü', icon('home', 'icon-sm')),
            ));
        },
        host_disconnected() {
            showFeedback('Der Host hat das Spiel verlassen.', 'error');
            exitTimer = setTimeout(() => navigate('home'), 2500);
        },
        error(data) {
            showFeedback(data.message || 'Fehler', 'error');
            if (!gameStarted && players.length === 0) {
                // Join failed (room not found / full) – back to start.
                exitTimer = setTimeout(() => navigate('home'), 2000);
            }
        },
    };
    Object.entries(handlers).forEach(([event, fn]) => socket.on(event, fn));

    /* --- start ------------------------------------------------------- */
    renderLobby();
    socket.emit('join_room', { roomCode: roomCode.toUpperCase(), playerName });

    return {
        element,
        destroy() {
            Object.entries(handlers).forEach(([event, fn]) => socket.off(event, fn));
            document.removeEventListener('keydown', onKeydown);
            if (exitTimer) clearTimeout(exitTimer);
            if (activeModal) activeModal.close();
            if (socket.connected) socket.emit('leave_room');
        },
    };
}
