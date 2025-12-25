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
        this.mode = 'timeline'; // 'timeline' or 'classic'
        
        this.setupEventListeners();
    }

    /**
     * Configure screen for a specific mode
     */
    configure(mode) {
        this.mode = mode;
        
        const icon = document.getElementById('setup-icon');
        const title = document.getElementById('setup-title');
        const tagline = document.getElementById('setup-tagline');
        const btn1 = document.getElementById('btn-count-1');
        
        if (mode === 'classic') {
            icon.textContent = '🎤';
            title.textContent = 'Classic Modus';
            tagline.textContent = 'Erkenne Titel & Künstler!';
            
            // Enable 1 player option
            btn1.style.display = 'block';
            
            // Default to 1 player if switching to classic
            // or keep current if valid
            if (this.playerCount < 1) this.setPlayerCount(1);
            
        } else {
            icon.textContent = '📅';
            title.textContent = 'Timeline Modus';
            tagline.textContent = 'Erkenne die Ära, sortiere die Hits!';
            
            // Disable 1 player option
            btn1.style.display = 'none';
            
            // Ensure at least 2 players
            if (this.playerCount < 2) this.setPlayerCount(2);
        }
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
