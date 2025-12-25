/**
 * ClassicScreen - Handles the Classic game mode
 * Player guesses song title & artist, then self-scores +0, +1, or +2
 * Infinite play with no repeating songs within a session
 */
class ClassicScreen {
    constructor(songs, audioPlayer) {
        this.songs = songs;
        this.audioPlayer = audioPlayer;
        
        // Game state
        this.players = [];
        this.currentPlayerIndex = 0;
        this.score = 0; // Legacy support / Single player score
        this.songsPlayed = 0; // Total songs played across all players
        this.usedSongIds = new Set();
        this.currentSong = null;
        this.isRevealed = false;
        
        // DOM elements
        this.screen = document.getElementById('classic-screen');
        this.scoreDisplay = document.getElementById('classic-score');
        this.songsPlayedDisplay = document.getElementById('classic-songs-played');
        this.singleStats = document.getElementById('classic-single-stats');
        this.multiStats = document.getElementById('classic-multi-stats');
        
        this.coverPlaceholder = this.screen.querySelector('.cover-placeholder');
        this.coverImg = document.getElementById('classic-cover');
        this.songHidden = document.getElementById('classic-song-hidden');
        this.songRevealed = document.getElementById('classic-song-revealed');
        this.titleDisplay = document.getElementById('classic-title');
        this.artistDisplay = document.getElementById('classic-artist');
        this.yearDisplay = document.getElementById('classic-year');
        this.playBtn = document.getElementById('classic-play-btn');
        this.progressBar = document.getElementById('classic-progress');
        this.timeDisplay = document.getElementById('classic-time-display');
        this.preReveal = document.getElementById('classic-pre-reveal');
        this.postReveal = document.getElementById('classic-post-reveal');
        this.revealBtn = document.getElementById('classic-reveal-btn');
        this.backBtn = document.getElementById('classic-back-btn');
        this.audioElement = document.getElementById('classic-audio-player');
        this.volumeSlider = document.getElementById('classic-volume-slider');
        
        // Turn Modal
        this.turnModal = document.getElementById('turn-modal');
        this.nextPlayerName = document.getElementById('next-player-name');
        this.startTurnBtn = document.getElementById('start-turn-btn');
        
        // Set initial volume
        if (this.volumeSlider) {
            this.audioElement.volume = this.volumeSlider.value;
        }
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Play/Pause button
        this.playBtn.addEventListener('click', () => this.togglePlay());
        
        // Volume slider
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => {
                this.audioElement.volume = e.target.value;
            });
        }
        
        // Reveal button
        this.revealBtn.addEventListener('click', () => this.revealSong());
        
        // Score buttons
        document.querySelectorAll('.score-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const points = parseInt(e.currentTarget.dataset.points);
                this.addScore(points);
            });
        });
        
        // Back button
        this.backBtn.addEventListener('click', () => {
            this.stop();
            window.dispatchEvent(new CustomEvent('exitClassicMode'));
        });
        
        // Turn modal button
        this.startTurnBtn.addEventListener('click', () => {
            this.turnModal.classList.remove('active');
            this.loadNextSong();
        });
        
        // Audio events
        this.audioElement.addEventListener('timeupdate', () => this.updateProgress());
        this.audioElement.addEventListener('ended', () => this.onAudioEnded());
        this.audioElement.addEventListener('play', () => this.playBtn.textContent = '⏸');
        this.audioElement.addEventListener('pause', () => this.playBtn.textContent = '▶');
    }

    /**
     * Start game with specific players
     */
    start(playerNames) {
        this.players = playerNames.map((name, index) => {
            return new Player(index, name, Player.COLORS[index % Player.COLORS.length]);
        });
        this.currentPlayerIndex = 0;
        this.show();
    }

    /**
     * Show the classic screen and start a new session
     */
    show() {
        this.screen.classList.add('active');
        this.reset();
        
        // If multiplayer, show turn modal first
        if (this.players.length > 1) {
            this.showTurnModal();
        } else {
            this.loadNextSong();
        }
    }

    /**
     * Show turn modal for current player
     */
    showTurnModal() {
        const player = this.players[this.currentPlayerIndex];
        this.nextPlayerName.textContent = player.name;
        this.nextPlayerName.style.color = player.color;
        this.turnModal.classList.add('active');
    }

    /**
     * Hide the classic screen
     */
    hide() {
        this.screen.classList.remove('active');
        this.turnModal.classList.remove('active');
        this.stop();
    }

    /**
     * Reset the game state for a new session
     */
    reset() {
        this.score = 0;
        this.songsPlayed = 0;
        this.usedSongIds.clear();
        this.currentSong = null;
        this.isRevealed = false;
        
        // Reset player scores
        this.players.forEach(p => p.points = 0);
        
        this.updateDisplay();
    }

    /**
     * Get a random song that hasn't been used yet
     */
    getRandomUnusedSong() {
        const availableSongs = this.songs.filter(song => !this.usedSongIds.has(song.id));
        
        if (availableSongs.length === 0) {
            // All songs used - reset and start over
            console.log('All songs played! Resetting pool...');
            this.usedSongIds.clear();
            return this.songs[Math.floor(Math.random() * this.songs.length)];
        }
        
        return availableSongs[Math.floor(Math.random() * availableSongs.length)];
    }

    /**
     * Load the next song
     */
    loadNextSong() {
        this.currentSong = this.getRandomUnusedSong();
        this.usedSongIds.add(this.currentSong.id);
        this.isRevealed = false;
        
        // Reset UI to hidden state
        this.songHidden.classList.remove('hidden');
        this.songRevealed.classList.add('hidden');
        this.coverImg.classList.add('hidden');
        this.coverPlaceholder.style.display = 'flex';
        this.preReveal.classList.remove('hidden');
        this.postReveal.classList.add('hidden');
        
        // Load audio
        this.audioElement.src = this.currentSong.preview_url;
        this.audioElement.load();
        this.progressBar.style.width = '0%';
        this.timeDisplay.textContent = '0:00 / 0:30';
        this.playBtn.textContent = '▶';
    }

    /**
     * Toggle play/pause
     */
    togglePlay() {
        if (this.audioElement.paused) {
            this.audioElement.play().catch(e => console.log('Play failed:', e));
        } else {
            this.audioElement.pause();
        }
    }

    /**
     * Stop playback
     */
    stop() {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
    }

    /**
     * Update progress bar and time display
     */
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

    /**
     * Handle audio ended
     */
    onAudioEnded() {
        this.playBtn.textContent = '▶';
    }

    /**
     * Reveal the current song
     */
    revealSong() {
        if (!this.currentSong || this.isRevealed) return;
        
        this.isRevealed = true;
        
        // Show song info
        this.titleDisplay.textContent = this.currentSong.title;
        this.artistDisplay.textContent = this.currentSong.artist;
        this.yearDisplay.textContent = this.currentSong.year;
        
        // Show cover
        this.coverImg.src = this.currentSong.cover_url;
        this.coverImg.classList.remove('hidden');
        this.coverPlaceholder.style.display = 'none';
        
        // Toggle UI
        this.songHidden.classList.add('hidden');
        this.songRevealed.classList.remove('hidden');
        this.preReveal.classList.add('hidden');
        this.postReveal.classList.remove('hidden');
    }

    /**
     * Add points and load next song
     */
    addScore(points) {
        // Add points to current player
        if (this.players.length > 0) {
            this.players[this.currentPlayerIndex].addPoints(points);
        } else {
            this.score += points; // Fallback
        }
        
        this.songsPlayed++;
        this.updateDisplay();
        this.stop();
        
        // Handle next turn
        if (this.players.length > 1) {
            // Next player
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            this.showTurnModal();
        } else {
            // Single player - just load next
            setTimeout(() => {
                this.loadNextSong();
            }, 300);
        }
    }

    /**
     * Update the score and songs played display
     */
    updateDisplay() {
        if (this.players.length > 1) {
            // Multiplayer Display
            this.singleStats.classList.add('hidden');
            this.multiStats.classList.remove('hidden');
            
            this.multiStats.innerHTML = '';
            this.players.forEach((player, index) => {
                const pill = document.createElement('div');
                pill.className = `score-pill ${index === this.currentPlayerIndex ? 'active' : ''}`;
                pill.innerHTML = `
                    <span class="score-color" style="background: ${player.color}"></span>
                    <span>${player.name}: ${player.points}</span>
                `;
                this.multiStats.appendChild(pill);
            });
            
        } else {
            // Single Player Display
            this.singleStats.classList.remove('hidden');
            this.multiStats.classList.add('hidden');
            
            // Use player[0] score if available, else legacy this.score
            const currentScore = this.players.length > 0 ? this.players[0].points : this.score;
            
            this.scoreDisplay.textContent = currentScore;
            this.songsPlayedDisplay.textContent = this.songsPlayed;
        }
    }
}

// Export for use in other files
window.ClassicScreen = ClassicScreen;
