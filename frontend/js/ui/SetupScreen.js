/**
 * SetupScreen - Handles the game setup UI
 */
class SetupScreen {
    constructor(onStart) {
        this.screen = document.getElementById('setup-screen');
        this.playerCountButtons = document.querySelectorAll('.count-btn');
        this.playerInputs = document.querySelectorAll('.player-input');
        this.startButton = document.getElementById('start-game-btn');
        this.onStart = onStart;
        
        this.playerCount = 3;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Player count buttons
        this.playerCountButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setPlayerCount(parseInt(btn.dataset.count));
            });
        });

        // Start button
        this.startButton.addEventListener('click', () => this.handleStart());
    }

    /**
     * Set the number of players
     */
    setPlayerCount(count) {
        this.playerCount = count;
        
        // Update button states
        this.playerCountButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.count) === count);
        });

        // Show/hide player inputs
        this.playerInputs.forEach((input, index) => {
            input.classList.toggle('hidden', index >= count);
        });
    }

    /**
     * Get player names from inputs
     */
    getPlayerNames() {
        const names = [];
        for (let i = 0; i < this.playerCount; i++) {
            const input = this.playerInputs[i].querySelector('input');
            const name = input.value.trim() || `Spieler ${i + 1}`;
            names.push(name);
        }
        return names;
    }

    /**
     * Handle start button click
     */
    handleStart() {
        const names = this.getPlayerNames();
        if (this.onStart) {
            this.onStart(names);
        }
    }

    /**
     * Show the setup screen
     */
    show() {
        this.screen.classList.add('active');
    }

    /**
     * Hide the setup screen
     */
    hide() {
        this.screen.classList.remove('active');
    }
}

// Export for use in other files
window.SetupScreen = SetupScreen;
