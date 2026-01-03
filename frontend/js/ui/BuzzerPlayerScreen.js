/**
 * BuzzerPlayerScreen - Manages the player view for Buzzer mode
 */
class BuzzerPlayerScreen {
    constructor(socket) {
        this.socket = socket;
        
        // State
        this.roomCode = null;
        this.playerName = null;
        this.myScore = 0;
        this.isLockedOut = false;
        this.hasBuzzed = false;
        this.roundActive = false;
        this.gameStarted = false;
        this.players = [];
        this.maxScore = 10;
        
        // DOM Elements
        this.screen = document.getElementById('buzzer-player-screen');
        this.lobby = document.getElementById('buzzer-player-lobby');
        this.game = document.getElementById('buzzer-player-game');
        this.playerNameDisplay = document.getElementById('buzzer-player-name');
        this.playerScoreDisplay = document.getElementById('buzzer-player-score');
        this.roomCodeDisplay = document.getElementById('player-room-code');
        this.lobbyPlayerList = document.getElementById('player-lobby-list');
        
        // Buzzer elements
        this.buzzerBtn = document.getElementById('buzzer-btn');
        this.buzzerStatus = document.getElementById('buzzer-status');
        this.buzzerStatusText = document.getElementById('buzzer-status-text');
        this.buzzerFeedback = document.getElementById('buzzer-feedback');
        
        // Scoreboard
        this.scoreboard = document.getElementById('player-scoreboard');
        
        // Sound effects
        this.sounds = {
            buzz: document.getElementById('sound-buzz'),
            correct: document.getElementById('sound-correct'),
            wrong: document.getElementById('sound-wrong'),
            locked: document.getElementById('sound-locked')
        };
        
        this.setupEventListeners();
        this.setupSocketListeners();
    }
    
    setupEventListeners() {
        this.buzzerBtn.addEventListener('click', () => this.buzz());
        
        // Also allow spacebar to buzz
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.screen.classList.contains('active') && this.gameStarted) {
                e.preventDefault();
                this.buzz();
            }
        });
    }
    
    setupSocketListeners() {
        this.socket.on('joined_room', (data) => {
            this.roomCode = data.roomCode;
            this.playerName = data.playerName;
            this.gameStarted = data.gameStarted;
            
            this.roomCodeDisplay.textContent = data.roomCode;
            this.playerNameDisplay.textContent = data.playerName;
            
            if (data.gameStarted) {
                this.showGame();
            }
        });
        
        this.socket.on('room_state', (state) => {
            this.updateRoomState(state);
        });
        
        this.socket.on('game_started', () => {
            this.gameStarted = true;
            this.showGame();
        });
        
        this.socket.on('round_started', () => {
            this.onRoundStarted();
        });
        
        this.socket.on('player_buzzed', (data) => {
            if (data.playerId !== this.socket.id) {
                // Someone else buzzed
                this.playSound('buzz');
            }
        });
        
        this.socket.on('judge_result', (data) => {
            this.onJudgeResult(data);
        });
        
        this.socket.on('round_skipped', () => {
            this.onRoundEnded();
        });
        
        this.socket.on('game_ended', (data) => {
            this.onGameEnded(data);
        });
        
        this.socket.on('host_disconnected', () => {
            this.showFeedback('Host hat das Spiel verlassen', 'error');
            setTimeout(() => {
                this.hide();
                window.dispatchEvent(new CustomEvent('exitBuzzerMode'));
            }, 2000);
        });
        
        this.socket.on('error', (data) => {
            this.showFeedback(data.message, 'error');
        });
    }
    
    joinRoom(roomCode, playerName) {
        this.socket.emit('join_room', {
            roomCode: roomCode.toUpperCase(),
            playerName: playerName
        });
    }
    
    show() {
        this.screen.classList.add('active');
        this.lobby.classList.remove('hidden');
        this.game.classList.add('hidden');
    }
    
    showGame() {
        this.lobby.classList.add('hidden');
        this.game.classList.remove('hidden');
        this.setWaitingForRound();
    }
    
    hide() {
        this.screen.classList.remove('active');
    }
    
    updateRoomState(state) {
        this.players = state.players || [];
        this.roundActive = state.roundActive;
        this.maxScore = state.maxScore;
        
        // Find my score and locked status
        const me = this.players.find(p => p.id === this.socket.id);
        if (me) {
            this.myScore = me.score;
            this.isLockedOut = me.isLockedOut;
            this.playerScoreDisplay.textContent = this.myScore;
        }
        
        // Update lobby player list
        this.lobbyPlayerList.innerHTML = this.players.map(p => `
            <div class="lobby-player ${!p.isConnected ? 'disconnected' : ''}">
                <span class="player-dot"></span>
                <span class="player-name">${p.name}</span>
                ${p.id === this.socket.id ? '<span class="you-badge">(Du)</span>' : ''}
            </div>
        `).join('');
        
        // Update scoreboard
        this.updateScoreboard();
        
        // Update buzzer state based on room state
        if (this.gameStarted) {
            if (!this.roundActive) {
                this.setWaitingForRound();
            } else if (this.isLockedOut) {
                this.setLockedOut();
            } else if (this.hasBuzzed) {
                this.setHasBuzzed();
            } else if (state.currentBuzzer) {
                this.setBuzzerTaken(state.currentBuzzer.name);
            } else {
                this.setReadyToBuzz();
            }
        }
    }
    
    updateScoreboard() {
        const sorted = [...this.players].sort((a, b) => b.score - a.score);
        this.scoreboard.innerHTML = sorted.map((p, i) => `
            <div class="scoreboard-entry ${p.id === this.socket.id ? 'is-me' : ''} ${p.isLockedOut ? 'locked-out' : ''}">
                <span class="rank">${i + 1}</span>
                <span class="name">${p.name}${p.id === this.socket.id ? ' (Du)' : ''}</span>
                <span class="score">${p.score}/${this.maxScore}</span>
                ${p.isLockedOut ? '<span class="locked-badge">🔒</span>' : ''}
            </div>
        `).join('');
    }
    
    onRoundStarted() {
        this.roundActive = true;
        this.isLockedOut = false;
        this.hasBuzzed = false;
        this.setReadyToBuzz();
        this.hideFeedback();
    }
    
    setWaitingForRound() {
        this.buzzerBtn.disabled = true;
        this.buzzerBtn.classList.remove('ready', 'locked', 'buzzed');
        this.buzzerBtn.classList.add('waiting');
        this.buzzerStatusText.textContent = 'Warte auf nächste Runde...';
    }
    
    setReadyToBuzz() {
        this.buzzerBtn.disabled = false;
        this.buzzerBtn.classList.remove('waiting', 'locked', 'buzzed');
        this.buzzerBtn.classList.add('ready');
        this.buzzerStatusText.textContent = 'Drück den Buzzer!';
    }
    
    setHasBuzzed() {
        this.buzzerBtn.disabled = true;
        this.buzzerBtn.classList.remove('waiting', 'locked', 'ready');
        this.buzzerBtn.classList.add('buzzed');
        this.buzzerStatusText.textContent = 'Du hast gebuzzert!';
    }
    
    setBuzzerTaken(name) {
        this.buzzerBtn.disabled = true;
        this.buzzerBtn.classList.remove('waiting', 'locked', 'ready');
        this.buzzerBtn.classList.add('buzzed');
        this.buzzerStatusText.textContent = `${name} antwortet...`;
    }
    
    setLockedOut() {
        this.buzzerBtn.disabled = true;
        this.buzzerBtn.classList.remove('waiting', 'ready', 'buzzed');
        this.buzzerBtn.classList.add('locked');
        this.buzzerStatusText.textContent = 'Gesperrt für diese Runde';
    }
    
    buzz() {
        if (this.buzzerBtn.disabled || this.isLockedOut || this.hasBuzzed || !this.roundActive) {
            return;
        }
        
        this.hasBuzzed = true;
        this.socket.emit('buzz');
        this.playSound('buzz');
        this.setHasBuzzed();
    }
    
    onJudgeResult(data) {
        // Check if this result is about me
        if (data.playerId === this.socket.id) {
            if (data.points > 0) {
                this.playSound('correct');
                let msg = `+${data.points} Punkt${data.points > 1 ? 'e' : ''}!`;
                if (data.correctArtist && data.correctTitle) {
                    msg += ' (Beides richtig!)';
                } else if (data.correctArtist) {
                    msg += ' (Künstler richtig)';
                } else if (data.correctTitle) {
                    msg += ' (Titel richtig)';
                }
                this.showFeedback(msg, 'success');
            } else {
                this.playSound('wrong');
                this.isLockedOut = true;
                this.setLockedOut();
                this.showFeedback('Falsch! Gesperrt für diese Runde.', 'error');
            }
        } else {
            // Someone else was judged
            if (data.points > 0) {
                this.showFeedback(`${data.playerName} hat ${data.points} Punkt${data.points > 1 ? 'e' : ''} bekommen!`, 'info');
            } else if (data.lockedOut) {
                this.showFeedback(`${data.playerName} wurde gesperrt!`, 'info');
            }
        }
        
        if (data.roundEnded) {
            this.onRoundEnded();
            
            if (data.song) {
                // Show the song that was played
                setTimeout(() => {
                    this.showFeedback(`Es war: "${data.song.title}" von ${data.song.artist}`, 'info');
                }, 1500);
            }
        }
    }
    
    onRoundEnded() {
        this.roundActive = false;
        this.isLockedOut = false;
        this.hasBuzzed = false;
        this.setWaitingForRound();
    }
    
    onGameEnded(data) {
        // Show game over modal
        const modal = document.getElementById('buzzer-gameover-modal');
        document.getElementById('buzzer-winner-name').textContent = data.winner || 'Niemand';
        
        const scoresDiv = document.getElementById('buzzer-final-scores');
        scoresDiv.innerHTML = data.finalScores.map((p, i) => `
            <div class="final-score-entry ${p.id === this.socket.id ? 'is-me' : ''}">
                <span class="rank">${i + 1}.</span>
                <span class="name">${p.name}${p.id === this.socket.id ? ' (Du)' : ''}</span>
                <span class="score">${p.score} Punkte</span>
            </div>
        `).join('');
        
        modal.classList.add('active');
        
        document.getElementById('buzzer-play-again-btn').onclick = () => {
            modal.classList.remove('active');
            this.hide();
            window.dispatchEvent(new CustomEvent('exitBuzzerMode'));
        };
    }
    
    showFeedback(message, type = 'info') {
        this.buzzerFeedback.textContent = message;
        this.buzzerFeedback.className = `buzzer-feedback ${type}`;
        this.buzzerFeedback.classList.remove('hidden');
    }
    
    hideFeedback() {
        this.buzzerFeedback.classList.add('hidden');
    }
    
    playSound(name) {
        const sound = this.sounds[name];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {});
        }
    }
}

window.BuzzerPlayerScreen = BuzzerPlayerScreen;
