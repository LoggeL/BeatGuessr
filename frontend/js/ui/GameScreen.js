/**
 * GameScreen - Handles the main game UI
 */
class GameScreen {
    constructor(gameState, audioPlayer) {
        this.gameState = gameState;
        this.audioPlayer = audioPlayer;
        
        this.screen = document.getElementById('game-screen');
        this.currentPlayerName = document.getElementById('current-player-name');
        this.currentPlayerScore = document.getElementById('current-player-score');
        this.allPlayersScores = document.getElementById('all-players-scores');
        this.timelineContainer = document.getElementById('timeline');
        this.positionButtons = document.getElementById('position-buttons');
        this.lockGuessBtn = document.getElementById('lock-guess-btn');
        this.currentCover = document.getElementById('current-cover');
        
        this.timeline = new Timeline(this.timelineContainer);
        this.selectedPosition = null;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Lock guess button
        this.lockGuessBtn.addEventListener('click', () => this.handleLockGuess());

        // Game state events
        this.gameState.on('turn:start', (data) => this.handleTurnStart(data));
        this.gameState.on('card:drawn', (data) => this.handleCardDrawn(data));
        this.gameState.on('position:selected', (data) => this.handlePositionSelected(data));
    }

    /**
     * Show the game screen
     */
    show() {
        this.screen.classList.add('active');
    }

    /**
     * Hide the game screen
     */
    hide() {
        this.screen.classList.remove('active');
    }

    /**
     * Update the UI for the current player
     */
    updateCurrentPlayer() {
        const player = this.gameState.getCurrentPlayer();
        this.currentPlayerName.textContent = player.name;
        this.currentPlayerName.style.color = player.color;
        this.currentPlayerScore.textContent = player.score;
    }

    /**
     * Update all players' scores in header
     */
    updateAllScores() {
        this.allPlayersScores.innerHTML = '';
        
        this.gameState.players.forEach((player, index) => {
            const pill = document.createElement('div');
            pill.className = `score-pill ${index === this.gameState.currentPlayerIndex ? 'active' : ''}`;
            pill.innerHTML = `
                <span class="score-color" style="background: ${player.color}"></span>
                <span>${player.name}: ${player.score}</span>
            `;
            this.allPlayersScores.appendChild(pill);
        });
    }

    /**
     * Handle turn start
     */
    handleTurnStart(data) {
        this.updateCurrentPlayer();
        this.updateAllScores();
        this.selectedPosition = null;
        this.lockGuessBtn.disabled = true;
        
        // Draw a card for this turn
        this.gameState.startTurn();
    }

    /**
     * Handle card drawn
     */
    handleCardDrawn(data) {
        const { song, player } = data;
        
        // Load audio
        this.audioPlayer.load(song.previewUrl);
        
        // Hide cover initially (will reveal after guess)
        this.currentCover.classList.add('hidden');
        
        // Render timeline with slots
        this.renderTimelineWithSlots(player);
        
        // Generate position buttons
        this.renderPositionButtons(player);
    }

    /**
     * Render the timeline with position slots
     */
    renderTimelineWithSlots(player) {
        this.timeline.render(
            player,
            true,
            this.selectedPosition,
            (position) => this.selectPosition(position)
        );
    }

    /**
     * Render position buttons
     */
    renderPositionButtons(player) {
        this.positionButtons.innerHTML = '';
        
        const options = player.getPositionOptions();
        
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = `position-btn ${this.selectedPosition === option.position ? 'selected' : ''}`;
            btn.textContent = option.label;
            btn.addEventListener('click', () => this.selectPosition(option.position));
            this.positionButtons.appendChild(btn);
        });
    }

    /**
     * Select a position
     */
    selectPosition(position) {
        this.selectedPosition = position;
        this.gameState.selectPosition(position);
        this.lockGuessBtn.disabled = false;
        
        // Update UI
        const player = this.gameState.getCurrentPlayer();
        this.renderTimelineWithSlots(player);
        this.renderPositionButtons(player);
    }

    /**
     * Handle position selected (from game state)
     */
    handlePositionSelected(data) {
        // UI already updated in selectPosition
    }

    /**
     * Handle lock guess button
     */
    handleLockGuess() {
        if (this.selectedPosition === null) return;
        
        this.audioPlayer.stop();
        const result = this.gameState.submitGuess();
        
        if (result) {
            // Show reveal modal (handled by app.js)
            window.dispatchEvent(new CustomEvent('showReveal', { detail: result }));
        }
    }

    /**
     * Prepare for next turn
     */
    prepareNextTurn() {
        this.selectedPosition = null;
        this.lockGuessBtn.disabled = true;
        this.currentCover.classList.add('hidden');
        
        if (this.gameState.status === 'playing') {
            this.gameState.emit('turn:start', { player: this.gameState.getCurrentPlayer() });
        }
    }
}

// Export for use in other files
window.GameScreen = GameScreen;
