/**
 * GameState - Manages the game state machine
 * Events are emitted for UI updates, making it ready for multiplayer
 */
class GameState {
    constructor() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.songPool = []; // All available songs
        this.usedSongIds = new Set();
        this.currentSong = null;
        this.selectedPosition = null;
        this.status = 'setup'; // setup, playing, finished
        this.winner = null;
        
        // Event listeners
        this.listeners = {};
    }

    /**
     * Subscribe to game events
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * Emit a game event
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    /**
     * Initialize the game with players and songs
     */
    async init(playerNames, songs) {
        this.songPool = songs.map(s => new SongCard(s));
        this.usedSongIds = new Set();
        this.currentPlayerIndex = 0;
        this.status = 'playing';
        this.winner = null;

        // Create players
        this.players = playerNames.map((name, i) => 
            new Player(i, name, Player.COLORS[i])
        );

        // Give each player a starting card
        for (const player of this.players) {
            const startingCard = this.drawRandomCard();
            if (startingCard) {
                player.addCard(startingCard);
            }
        }

        this.emit('game:started', { players: this.players });
        this.emit('turn:start', { player: this.getCurrentPlayer() });
    }

    /**
     * Get current player
     */
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    /**
     * Draw a random card from the pool
     */
    drawRandomCard() {
        const available = this.songPool.filter(s => !this.usedSongIds.has(s.id));
        if (available.length === 0) return null;

        const card = available[Math.floor(Math.random() * available.length)];
        this.usedSongIds.add(card.id);
        return card;
    }

    /**
     * Start a new turn - draw a card for guessing
     */
    startTurn() {
        this.currentSong = this.drawRandomCard();
        this.selectedPosition = null;

        if (!this.currentSong) {
            this.emit('game:no-cards', {});
            return null;
        }

        this.emit('card:drawn', { 
            song: this.currentSong,
            player: this.getCurrentPlayer()
        });

        return this.currentSong;
    }

    /**
     * Select a position for the guess
     */
    selectPosition(position) {
        this.selectedPosition = position;
        this.emit('position:selected', { position });
    }

    /**
     * Submit the guess and check if correct
     */
    submitGuess() {
        if (this.selectedPosition === null || !this.currentSong) {
            return null;
        }

        const player = this.getCurrentPlayer();
        const isCorrect = player.isCorrectGuess(this.selectedPosition, this.currentSong.year);

        if (isCorrect) {
            player.addCard(this.currentSong, this.selectedPosition);
        }

        const result = {
            correct: isCorrect,
            song: this.currentSong,
            position: this.selectedPosition,
            player: player
        };

        this.emit('guess:result', result);

        // Check for winner
        if (player.hasWon()) {
            this.status = 'finished';
            this.winner = player;
            this.emit('game:won', { winner: player });
            return result;
        }

        // Next turn
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.currentSong = null;
        this.selectedPosition = null;

        return result;
    }

    /**
     * Get the song data by ID
     */
    getSongById(id) {
        return this.songPool.find(s => s.id === id);
    }

    /**
     * Reset the game
     */
    reset() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.usedSongIds = new Set();
        this.currentSong = null;
        this.selectedPosition = null;
        this.status = 'setup';
        this.winner = null;
        this.emit('game:reset', {});
    }
}

// Game events
GameState.Events = {
    GAME_STARTED: 'game:started',
    GAME_RESET: 'game:reset',
    GAME_WON: 'game:won',
    GAME_NO_CARDS: 'game:no-cards',
    TURN_START: 'turn:start',
    CARD_DRAWN: 'card:drawn',
    POSITION_SELECTED: 'position:selected',
    GUESS_RESULT: 'guess:result'
};

// Export for use in other files
window.GameState = GameState;
