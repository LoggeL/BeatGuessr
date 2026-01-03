/**
 * BuzzerHostScreen - Manages the host view for Buzzer mode
 */
class BuzzerHostScreen {
    constructor(socket, songs, audioPlayer) {
        this.socket = socket;
        this.songs = songs;
        this.audioPlayer = audioPlayer;
        
        // State
        this.roomCode = null;
        this.maxScore = 10;
        this.players = [];
        this.currentSong = null;
        this.roundActive = false;
        this.gameStarted = false;
        
        // DOM Elements
        this.screen = document.getElementById('buzzer-host-screen');
        this.lobby = document.getElementById('buzzer-host-lobby');
        this.game = document.getElementById('buzzer-host-game');
        this.roomCodeDisplay = document.getElementById('host-room-code');
        this.roomCodeLarge = document.getElementById('host-room-code-large');
        this.playerCount = document.getElementById('host-player-count');
        this.playerList = document.getElementById('host-player-list');
        this.startBtn = document.getElementById('start-buzzer-game-btn');
        
        // Game elements
        this.coverPlaceholder = this.game.querySelector('.cover-placeholder');
        this.coverImg = document.getElementById('buzzer-host-cover');
        this.titleDisplay = document.getElementById('buzzer-host-title');
        this.artistDisplay = document.getElementById('buzzer-host-artist');
        this.yearDisplay = document.getElementById('buzzer-host-year');
        this.playBtn = document.getElementById('buzzer-host-play-btn');
        this.progressBar = document.getElementById('buzzer-host-progress');
        this.timeDisplay = document.getElementById('buzzer-host-time-display');
        this.volumeSlider = document.getElementById('buzzer-host-volume');
        this.audioElement = document.getElementById('buzzer-host-audio');
        
        // Buzzer elements
        this.buzzerWaiting = document.getElementById('buzzer-waiting');
        this.buzzerCurrent = document.getElementById('buzzer-current');
        this.currentBuzzerName = document.getElementById('current-buzzer-name');
        this.judgeArtist = document.getElementById('judge-artist-correct');
        this.judgeTitle = document.getElementById('judge-title-correct');
        this.judgeSubmitBtn = document.getElementById('judge-submit-btn');
        this.queueList = document.getElementById('buzzer-queue-list');
        this.queueNames = document.getElementById('queue-names');
        
        // Control buttons
        this.nextRoundBtn = document.getElementById('next-round-btn');
        this.skipRoundBtn = document.getElementById('skip-round-btn');
        this.endGameBtn = document.getElementById('end-buzzer-game-btn');
        this.backBtn = document.getElementById('buzzer-host-back-btn');
        
        // Scoreboard
        this.scoreboard = document.getElementById('host-scoreboard');
        
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
        // Score selector
        document.querySelectorAll('.score-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.score-option').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.maxScore = parseInt(e.target.dataset.score);
            });
        });
        
        // Start game button
        this.startBtn.addEventListener('click', () => this.startGame());
        
        // Audio controls
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.volumeSlider.addEventListener('input', (e) => {
            this.audioElement.volume = e.target.value;
        });
        this.audioElement.addEventListener('timeupdate', () => this.updateProgress());
        this.audioElement.addEventListener('ended', () => this.onAudioEnded());
        this.audioElement.addEventListener('play', () => this.playBtn.textContent = '⏸');
        this.audioElement.addEventListener('pause', () => this.playBtn.textContent = '▶');
        
        // Judge buttons
        this.judgeSubmitBtn.addEventListener('click', () => this.submitJudgement());
        
        // Control buttons
        this.nextRoundBtn.addEventListener('click', () => this.startRound());
        this.skipRoundBtn.addEventListener('click', () => this.skipRound());
        this.endGameBtn.addEventListener('click', () => this.endGame());
        this.backBtn.addEventListener('click', () => this.exitGame());
    }
    
    setupSocketListeners() {
        this.socket.on('room_created', (data) => {
            this.roomCode = data.roomCode;
            this.maxScore = data.maxScore;
            this.roomCodeDisplay.textContent = data.roomCode;
            this.roomCodeLarge.textContent = data.roomCode;
        });
        
        this.socket.on('room_state', (state) => {
            this.updateRoomState(state);
        });
        
        this.socket.on('player_joined', (data) => {
            this.playSound('buzz');
        });
        
        this.socket.on('round_started', (data) => {
            this.onRoundStarted(data);
        });
        
        this.socket.on('player_buzzed', (data) => {
            this.playSound('buzz');
        });
        
        this.socket.on('judge_result', (data) => {
            this.onJudgeResult(data);
        });
        
        this.socket.on('round_skipped', (data) => {
            this.onRoundSkipped(data);
        });
        
        this.socket.on('game_ended', (data) => {
            this.onGameEnded(data);
        });
    }
    
    createRoom() {
        this.socket.emit('create_room', { maxScore: this.maxScore });
    }
    
    show() {
        this.screen.classList.add('active');
        this.lobby.classList.remove('hidden');
        this.game.classList.add('hidden');
        this.gameStarted = false;
        this.createRoom();
    }
    
    hide() {
        this.screen.classList.remove('active');
        this.stopAudio();
    }
    
    updateRoomState(state) {
        this.players = state.players || [];
        this.roundActive = state.roundActive;
        this.maxScore = state.maxScore;
        
        // Update player count and list
        this.playerCount.textContent = this.players.length;
        
        if (this.players.length === 0) {
            this.playerList.innerHTML = '<p class="no-players">Noch keine Spieler beigetreten...</p>';
        } else {
            this.playerList.innerHTML = this.players.map(p => `
                <div class="lobby-player ${!p.isConnected ? 'disconnected' : ''}">
                    <span class="player-dot"></span>
                    <span class="player-name">${p.name}</span>
                    ${p.score > 0 ? `<span class="player-score-badge">${p.score}</span>` : ''}
                    ${!p.isConnected ? '<span class="disconnected-badge">⚠️</span>' : ''}
                </div>
            `).join('');
        }
        
        // Enable start button if enough players
        this.startBtn.disabled = this.players.length < 1;
        
        // Update scoreboard
        this.updateScoreboard();
        
        // Update buzzer display
        if (state.currentBuzzer) {
            this.showCurrentBuzzer(state.currentBuzzer.name);
            this.updateBuzzQueue(state.buzzQueue.slice(1)); // Exclude current buzzer
        } else if (this.roundActive) {
            this.showWaitingForBuzz();
        }
    }
    
    updateScoreboard() {
        const sorted = [...this.players].sort((a, b) => b.score - a.score);
        this.scoreboard.innerHTML = sorted.map((p, i) => `
            <div class="scoreboard-entry ${p.isLockedOut ? 'locked-out' : ''}">
                <span class="rank">${i + 1}</span>
                <span class="name">${p.name}</span>
                <span class="score">${p.score}/${this.maxScore}</span>
                ${p.isLockedOut ? '<span class="locked-badge">🔒</span>' : ''}
            </div>
        `).join('');
    }
    
    startGame() {
        this.socket.emit('start_game');
        this.gameStarted = true;
        this.lobby.classList.add('hidden');
        this.game.classList.remove('hidden');
    }
    
    startRound() {
        this.socket.emit('start_round');
        this.judgeArtist.checked = false;
        this.judgeTitle.checked = false;
    }
    
    onRoundStarted(data) {
        this.currentSong = data.song;
        this.roundActive = true;
        
        // Show song info to host
        this.titleDisplay.textContent = this.currentSong.title;
        this.artistDisplay.textContent = this.currentSong.artist;
        this.yearDisplay.textContent = this.currentSong.year;
        
        // Load cover
        if (this.currentSong.cover_url) {
            this.coverImg.src = this.currentSong.cover_url;
            this.coverImg.classList.remove('hidden');
            this.coverPlaceholder.style.display = 'none';
        }
        
        // Load and play audio
        this.audioElement.src = this.currentSong.preview_url;
        this.audioElement.load();
        this.audioElement.play().catch(e => console.log('Autoplay blocked:', e));
        
        // Reset UI
        this.showWaitingForBuzz();
        this.judgeArtist.checked = false;
        this.judgeTitle.checked = false;
    }
    
    showWaitingForBuzz() {
        this.buzzerWaiting.classList.remove('hidden');
        this.buzzerCurrent.classList.add('hidden');
        this.queueList.classList.add('hidden');
    }
    
    showCurrentBuzzer(name) {
        this.buzzerWaiting.classList.add('hidden');
        this.buzzerCurrent.classList.remove('hidden');
        this.currentBuzzerName.textContent = name;
    }
    
    updateBuzzQueue(queue) {
        if (queue.length > 0) {
            this.queueList.classList.remove('hidden');
            this.queueNames.innerHTML = queue.map(p => `<span class="queue-player">${p.name}</span>`).join('');
        } else {
            this.queueList.classList.add('hidden');
        }
    }
    
    submitJudgement() {
        const correctArtist = this.judgeArtist.checked;
        const correctTitle = this.judgeTitle.checked;
        
        this.socket.emit('judge', {
            correctArtist,
            correctTitle
        });
    }
    
    onJudgeResult(data) {
        if (data.points > 0) {
            this.playSound('correct');
        } else {
            this.playSound('wrong');
        }
        
        if (data.roundEnded) {
            this.roundActive = false;
            this.showWaitingForBuzz();
            
            if (!data.allLockedOut) {
                // Someone got it right - pause audio briefly
                setTimeout(() => this.stopAudio(), 500);
            }
        }
        
        if (data.gameEnded) {
            // Game over modal will be shown by game_ended event
        }
    }
    
    skipRound() {
        this.socket.emit('skip_round');
    }
    
    onRoundSkipped(data) {
        this.roundActive = false;
        this.stopAudio();
        this.showWaitingForBuzz();
    }
    
    endGame() {
        if (confirm('Spiel wirklich beenden?')) {
            this.socket.emit('end_game');
        }
    }
    
    onGameEnded(data) {
        this.stopAudio();
        
        // Show game over modal
        const modal = document.getElementById('buzzer-gameover-modal');
        document.getElementById('buzzer-winner-name').textContent = data.winner || 'Niemand';
        
        const scoresDiv = document.getElementById('buzzer-final-scores');
        scoresDiv.innerHTML = data.finalScores.map((p, i) => `
            <div class="final-score-entry">
                <span class="rank">${i + 1}.</span>
                <span class="name">${p.name}</span>
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
    
    exitGame() {
        if (this.gameStarted) {
            if (!confirm('Spiel wirklich verlassen?')) return;
        }
        this.stopAudio();
        this.socket.emit('leave_room');
        this.hide();
        window.dispatchEvent(new CustomEvent('exitBuzzerMode'));
    }
    
    togglePlay() {
        if (this.audioElement.paused) {
            this.audioElement.play().catch(e => console.log('Play failed:', e));
        } else {
            this.audioElement.pause();
        }
    }
    
    stopAudio() {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
    }
    
    updateProgress() {
        const current = this.audioElement.currentTime;
        const duration = this.audioElement.duration || 30;
        const percent = (current / duration) * 100;
        
        this.progressBar.style.width = `${percent}%`;
        
        const currentMins = Math.floor(current / 60);
        const currentSecs = Math.floor(current % 60).toString().padStart(2, '0');
        const durationMins = Math.floor(duration / 60);
        const durationSecs = Math.floor(duration % 60).toString().padStart(2, '0');
        
        this.timeDisplay.textContent = `${currentMins}:${currentSecs} / ${durationMins}:${durationSecs}`;
    }
    
    onAudioEnded() {
        this.playBtn.textContent = '▶';
    }
    
    playSound(name) {
        const sound = this.sounds[name];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {});
        }
    }
}

window.BuzzerHostScreen = BuzzerHostScreen;
