/**
 * Buzzer mode – host screen.
 * Flow: configure target score -> create room -> lobby -> game.
 * The host device plays the music and judges the answers.
 */
import { el, icon, setChildren } from '../lib/dom.js';
import { sfx } from '../lib/sfx.js';
import { PreviewPlayer, createVinyl, openModal, scoreboard, screenHeader } from '../components/widgets.js';

const SCORE_CHOICES = [5, 10, 15, 20];

export function createBuzzerHostScreen(ctx) {
    const { navigate, socket } = ctx;

    if (!socket || !socket.connected) {
        // Backend vanished between screens; home shows the explanation.
        queueMicrotask(() => navigate('home'));
        return { element: el('div') };
    }

    let maxScore = 10;
    let roomCode = null;
    let players = [];
    let currentSong = null;
    let gameStarted = false;
    let activeModal = null;

    /* --- shared DOM ------------------------------------------------ */
    const vinyl = createVinyl();
    const player = new PreviewPlayer({ onPlayStateChange: p => vinyl.setSpinning(p) });

    const headerCode = el('span', { class: 'room-chip hidden' });
    const body = el('main', { class: 'game-main buzzer-host-main' });

    const element = el('div', { class: 'screen game-screen-shell' },
        screenHeader({
            iconName: 'bell',
            title: 'Buzzer',
            center: headerCode,
            right: el('button', {
                class: 'btn btn-icon', title: 'Beenden', 'aria-label': 'Beenden',
                onclick: () => exit(),
            }, icon('close')),
        }),
        body,
    );

    /* --- phase 1: configure ---------------------------------------- */
    function renderConfig() {
        const scoreButtons = SCORE_CHOICES.map(score =>
            el('button', {
                class: `count-btn${score === maxScore ? ' active' : ''}`,
                onclick: event => {
                    maxScore = score;
                    event.currentTarget.parentElement.querySelectorAll('.count-btn')
                        .forEach(b => b.classList.toggle('active', Number(b.textContent) === score));
                },
            }, `${score}`));

        setChildren(body, el('div', { class: 'centered-column' },
            el('div', { class: 'card setup-card' },
                el('h2', {}, 'Neues Buzzer-Spiel'),
                el('label', { class: 'field-label' }, 'Punkte zum Gewinnen'),
                el('div', { class: 'count-row' }, scoreButtons),
                el('button', {
                    class: 'btn btn-primary btn-lg',
                    onclick: () => socket.emit('create_room', { maxScore }),
                }, 'Raum erstellen', icon('arrowRight', 'icon-sm')),
            ),
        ));
    }

    /* --- phase 2: lobby --------------------------------------------- */
    const lobbyPlayerList = el('div', { class: 'player-list' });
    const lobbyCount = el('span', {}, '0');
    const startBtn = el('button', {
        class: 'btn btn-primary btn-lg', disabled: true,
        onclick: () => {
            socket.emit('start_game');
            gameStarted = true;
            renderGame();
        },
    }, 'Spiel starten', icon('play', 'icon-sm'));

    function renderLobby() {
        setChildren(body, el('div', { class: 'centered-column' },
            el('div', { class: 'card setup-card lobby-card' },
                el('h2', {}, 'Warte auf Spieler …'),
                el('p', { class: 'muted' }, 'Teile diesen Code mit deinen Mitspielern:'),
                el('div', { class: 'room-code-display' }, roomCode),
                el('p', { class: 'muted small' }, `Ziel: ${maxScore} Punkte · max. 8 Spieler`),
                el('h3', { class: 'section-title' }, 'Spieler (', lobbyCount, ')'),
                lobbyPlayerList,
                startBtn,
            ),
        ));
        renderLobbyPlayers();
    }

    function renderLobbyPlayers() {
        lobbyCount.textContent = `${players.length}`;
        startBtn.disabled = players.length < 1;
        if (players.length === 0) {
            setChildren(lobbyPlayerList, el('p', { class: 'muted' }, 'Noch keine Spieler beigetreten …'));
        } else {
            setChildren(lobbyPlayerList, players.map(p =>
                el('div', { class: `player-row static${p.isConnected === false ? ' disconnected' : ''}` },
                    el('span', { class: 'player-dot' }),
                    el('span', {}, p.name),
                )));
        }
    }

    /* --- phase 3: game ---------------------------------------------- */
    const songTitle = el('h2', { class: 'song-title' }, 'Warte auf Song …');
    const songMeta = el('p', { class: 'song-meta' }, 'Starte die erste Runde.');
    const judgeArea = el('div', { class: 'judge-area card' });
    const scoreboardArea = el('div', { class: 'card scoreboard-card' });
    const judgeArtist = el('input', { type: 'checkbox', id: 'judge-artist' });
    const judgeTitle = el('input', { type: 'checkbox', id: 'judge-title' });

    function renderGame() {
        setChildren(body,
            el('div', { class: 'now-playing card slim' },
                vinyl.element,
                el('div', { class: 'now-playing-info' },
                    songTitle,
                    songMeta,
                    player.element,
                ),
            ),
            judgeArea,
            el('div', { class: 'host-controls' },
                el('button', { class: 'btn btn-primary', onclick: () => startRound() },
                    'Nächster Song', icon('skip', 'icon-sm')),
                el('button', { class: 'btn btn-ghost', onclick: () => socket.emit('skip_round') }, 'Überspringen'),
                el('button', { class: 'btn btn-ghost danger', onclick: () => endGame() }, 'Spiel beenden'),
            ),
            scoreboardArea,
        );
        renderJudgeWaiting();
        renderScoreboard();
    }

    function startRound() {
        socket.emit('start_round');
        judgeArtist.checked = false;
        judgeTitle.checked = false;
    }

    function renderJudgeWaiting() {
        setChildren(judgeArea, el('p', { class: 'hint pulse' }, 'Warte auf Buzzer …'));
    }

    function renderJudge(currentBuzzer, queue) {
        setChildren(judgeArea,
            el('div', { class: 'current-buzzer' }, icon('bolt'), el('b', {}, currentBuzzer.name)),
            el('div', { class: 'judge-row' },
                el('label', { class: 'check-label' }, judgeArtist, el('span', {}, 'Künstler richtig')),
                el('label', { class: 'check-label' }, judgeTitle, el('span', {}, 'Titel richtig')),
            ),
            el('button', {
                class: 'btn btn-primary',
                onclick: () => socket.emit('judge', {
                    correctArtist: judgeArtist.checked,
                    correctTitle: judgeTitle.checked,
                }),
            }, 'Bewerten', icon('check', 'icon-sm')),
            queue.length ? el('p', { class: 'muted small' },
                `Warteschlange: ${queue.map(p => p.name).join(', ')}`) : null,
        );
    }

    function renderScoreboard() {
        setChildren(scoreboardArea,
            el('h3', { class: 'section-title' }, 'Punktestand'),
            scoreboard(players, { maxScore }));
    }

    /* --- socket handlers -------------------------------------------- */
    const handlers = {
        room_created(data) {
            roomCode = data.roomCode;
            maxScore = data.maxScore;
            headerCode.textContent = `Raum ${roomCode}`;
            headerCode.classList.remove('hidden');
            renderLobby();
        },
        room_state(state) {
            players = state.players || [];
            maxScore = state.maxScore || maxScore;
            if (!gameStarted) {
                renderLobbyPlayers();
                return;
            }
            renderScoreboard();
            if (state.currentBuzzer) {
                renderJudge(state.currentBuzzer, (state.buzzQueue || []).slice(1));
            } else if (state.roundActive) {
                renderJudgeWaiting();
            }
        },
        player_joined() {
            sfx.buzz();
        },
        round_started(data) {
            // The server also broadcasts a stripped payload to the players'
            // room (which includes the host) – only react to the full one.
            if (!data.song || !data.song.title) return;
            currentSong = data.song;
            songTitle.textContent = `${currentSong.artist} – ${currentSong.title}`;
            songMeta.textContent = `${currentSong.year}${currentSong.context ? ` · ${currentSong.context}` : ''}`;
            vinyl.reveal(currentSong.cover_url);
            player.load(currentSong.preview_url, { autoplay: true });
            judgeArtist.checked = false;
            judgeTitle.checked = false;
            renderJudgeWaiting();
        },
        player_buzzed() {
            sfx.buzz();
        },
        judge_result(data) {
            if (data.points > 0) sfx.correct(); else sfx.wrong();
            if (data.roundEnded) {
                renderJudgeWaiting();
                songMeta.textContent = 'Runde beendet – starte den nächsten Song.';
                if (!data.allLockedOut) setTimeout(() => player.stop(), 500);
            }
        },
        round_skipped() {
            player.stop();
            renderJudgeWaiting();
            songMeta.textContent = 'Runde übersprungen.';
        },
        game_ended(data) {
            player.stop();
            showGameOver(data);
        },
    };
    Object.entries(handlers).forEach(([event, fn]) => socket.on(event, fn));

    function showGameOver(data) {
        activeModal = openModal(el('div', { class: 'gameover-modal' },
            el('div', { class: 'trophy-mark' }, icon('trophy')),
            el('h2', {}, data.winner || 'Niemand'),
            el('p', { class: 'win-subtitle' }, 'hat gewonnen!'),
            scoreboard(data.finalScores || []),
            el('button', {
                class: 'btn btn-primary btn-lg',
                onclick: () => { activeModal.close(); activeModal = null; leaveAndGoHome(); },
            }, 'Zurück zum Menü', icon('home', 'icon-sm')),
        ));
    }

    function endGame() {
        if (confirm('Spiel wirklich beenden?')) socket.emit('end_game');
    }

    function exit() {
        if (gameStarted && !confirm('Spiel wirklich verlassen?')) return;
        leaveAndGoHome();
    }

    function leaveAndGoHome() {
        if (socket.connected) socket.emit('leave_room');
        navigate('home');
    }

    /* --- start ------------------------------------------------------- */
    renderConfig();

    return {
        element,
        destroy() {
            Object.entries(handlers).forEach(([event, fn]) => socket.off(event, fn));
            if (activeModal) activeModal.close();
            player.destroy();
        },
    };
}
