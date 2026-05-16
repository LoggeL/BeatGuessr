/**
 * SetupScreen - Handles the game setup UI
 */
class SetupScreen {
    constructor(onStart) {
        this.screen = document.getElementById('setup-screen');
        this.playerCountButtons = document.querySelectorAll('.count-btn');
        this.playerInputs = document.querySelectorAll('.player-input');
        this.startButton = document.getElementById('start-game-btn');
        this.rulesList = document.getElementById('setup-rules-list');
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
            this.setPlayerCount(1);
            this.updateRules([
                '🎧 Ein Song wird abgespielt',
                '🎤 Rate Titel und Künstler',
                '✅ Vergib +1 für Künstler und +1 für Titel',
                '🔁 Danach kommt direkt der nächste Song',
                '🏆 Spiel so lange, wie ihr wollt'
            ]);
            
        } else {
            icon.textContent = '📅';
            title.textContent = 'Timeline Modus';
            tagline.textContent = 'Erkenne die Ära, sortiere die Hits!';
            
            // Disable 1 player option
            btn1.style.display = 'none';
            
            this.setPlayerCount(Math.max(2, this.playerCount));
            this.updateRules([
                '🎧 Ein Song wird abgespielt (30 Sekunden Vorschau)',
                '📅 Rate, wo der Song zeitlich in deine Sammlung passt',
                '✅ Richtig? Der Song wird deiner Timeline hinzugefügt',
                '❌ Falsch? Der Song wird abgelegt',
                '🏆 Wer zuerst 10 Songs gesammelt hat, gewinnt!'
            ]);
        }
    }

    updateRules(rules) {
        if (!this.rulesList) return;
        this.rulesList.innerHTML = '';
        rules.forEach(rule => {
            const li = document.createElement('li');
            li.textContent = rule;
            this.rulesList.appendChild(li);
        });
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
