/**
 * BeatGuessr - Main Application
 * Ties together all components and manages screen navigation
 */
class BeatGuessrApp {
    constructor() {
        this.gameState = new GameState();
        this.audioPlayer = null;
        this.setupScreen = null;
        this.gameScreen = null;
        this.revealModal = null;
        this.classicScreen = null;
        this.songs = [];
        this.currentMode = null;
        
        this.init();
    }

    async init() {
        // Load songs from API
        await this.loadSongs();
        
        // Initialize components
        this.audioPlayer = new AudioPlayer();
        this.setupScreen = new SetupScreen((names) => this.startTimelineGame(names));
        this.gameScreen = new GameScreen(this.gameState, this.audioPlayer);
        this.revealModal = new RevealModal();
        this.classicScreen = new ClassicScreen(this.songs, this.audioPlayer);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Show mode selection screen
        this.showScreen('mode');
        
        console.log('BeatGuessr initialized!');
    }

    /**
     * Load songs from the API or local JSON
     */
    async loadSongs() {
        try {
            // Try API first (for local Flask dev server)
            const response = await fetch('/api/songs');
            if (response.ok) {
                const data = await response.json();
                this.songs = data.songs || [];
                console.log(`Loaded ${this.songs.length} songs from API`);
                return;
            }
        } catch (e) {
            console.log('API not available, trying local file...');
        }

        // Fallback to local JSON file (for GitHub Pages)
        try {
            const response = await fetch('data/songs.json');
            if (response.ok) {
                const data = await response.json();
                this.songs = data.songs || [];
                console.log(`Loaded ${this.songs.length} songs from local file`);
                return;
            }
        } catch (e) {
            console.log('Local file not available');
        }

        // Use demo songs if nothing else works
        this.songs = this.getDemoSongs();
        console.log(`Using ${this.songs.length} demo songs`);
    }

    /**
     * Get demo songs for testing when no data is available
     */
    getDemoSongs() {
        return [
            {
                id: 'demo1',
                title: 'Never Gonna Give You Up',
                artist: 'Rick Astley',
                year: 1987,
                context: 'Stock Aitken Waterman',
                preview_url: 'https://p.scdn.co/mp3-preview/e3d6a4b0b1f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3',
                cover_url: 'https://i.scdn.co/image/ab67616d0000b273c8b0e9f4e4e4e4e4e4e4e4e4',
                album: 'Whenever You Need Somebody'
            },
            {
                id: 'demo2',
                title: '99 Luftballons',
                artist: 'Nena',
                year: 1983,
                context: 'NDW-Höhepunkt',
                preview_url: 'https://p.scdn.co/mp3-preview/demo2',
                cover_url: 'https://i.scdn.co/image/demo2',
                album: '99 Luftballons'
            },
            {
                id: 'demo3',
                title: 'Take On Me',
                artist: 'a-ha',
                year: 1985,
                context: 'Live Aid Jahr',
                preview_url: 'https://p.scdn.co/mp3-preview/demo3',
                cover_url: 'https://i.scdn.co/image/demo3',
                album: 'Hunting High and Low'
            },
            {
                id: 'demo4',
                title: 'Billie Jean',
                artist: 'Michael Jackson',
                year: 1983,
                context: 'NDW-Höhepunkt',
                preview_url: 'https://p.scdn.co/mp3-preview/demo4',
                cover_url: 'https://i.scdn.co/image/demo4',
                album: 'Thriller'
            },
            {
                id: 'demo5',
                title: 'Blinding Lights',
                artist: 'The Weeknd',
                year: 2020,
                context: 'Pandemie-Hits',
                preview_url: 'https://p.scdn.co/mp3-preview/demo5',
                cover_url: 'https://i.scdn.co/image/demo5',
                album: 'After Hours'
            },
            {
                id: 'demo6',
                title: 'Despacito',
                artist: 'Luis Fonsi',
                year: 2017,
                context: 'Despacito-Sommer',
                preview_url: 'https://p.scdn.co/mp3-preview/demo6',
                cover_url: 'https://i.scdn.co/image/demo6',
                album: 'Vida'
            },
            {
                id: 'demo7',
                title: 'Gangnam Style',
                artist: 'PSY',
                year: 2012,
                context: 'Gangnam Style Jahr',
                preview_url: 'https://p.scdn.co/mp3-preview/demo7',
                cover_url: 'https://i.scdn.co/image/demo7',
                album: 'Psy 6'
            },
            {
                id: 'demo8',
                title: 'Bohemian Rhapsody',
                artist: 'Queen',
                year: 1975,
                context: 'Disco-Fieber',
                preview_url: 'https://p.scdn.co/mp3-preview/demo8',
                cover_url: 'https://i.scdn.co/image/demo8',
                album: 'A Night at the Opera'
            },
            {
                id: 'demo9',
                title: 'Smells Like Teen Spirit',
                artist: 'Nirvana',
                year: 1991,
                context: 'Grunge-Revolution',
                preview_url: 'https://p.scdn.co/mp3-preview/demo9',
                cover_url: 'https://i.scdn.co/image/demo9',
                album: 'Nevermind'
            },
            {
                id: 'demo10',
                title: 'Dancing Queen',
                artist: 'ABBA',
                year: 1976,
                context: 'Punk-Revolution',
                preview_url: 'https://p.scdn.co/mp3-preview/demo10',
                cover_url: 'https://i.scdn.co/image/demo10',
                album: 'Arrival'
            },
            {
                id: 'demo11',
                title: 'Shape of You',
                artist: 'Ed Sheeran',
                year: 2017,
                context: 'Despacito-Sommer',
                preview_url: 'https://p.scdn.co/mp3-preview/demo11',
                cover_url: 'https://i.scdn.co/image/demo11',
                album: '÷ (Divide)'
            },
            {
                id: 'demo12',
                title: 'Uptown Funk',
                artist: 'Mark Ronson ft. Bruno Mars',
                year: 2014,
                context: 'Streaming-Revolution',
                preview_url: 'https://p.scdn.co/mp3-preview/demo12',
                cover_url: 'https://i.scdn.co/image/demo12',
                album: 'Uptown Special'
            },
            {
                id: 'demo13',
                title: 'Sweet Child O\' Mine',
                artist: 'Guns N\' Roses',
                year: 1987,
                context: 'Stock Aitken Waterman',
                preview_url: 'https://p.scdn.co/mp3-preview/demo13',
                cover_url: 'https://i.scdn.co/image/demo13',
                album: 'Appetite for Destruction'
            },
            {
                id: 'demo14',
                title: 'Wonderwall',
                artist: 'Oasis',
                year: 1995,
                context: 'Techno-Hochzeit',
                preview_url: 'https://p.scdn.co/mp3-preview/demo14',
                cover_url: 'https://i.scdn.co/image/demo14',
                album: '(What\'s the Story) Morning Glory?'
            },
            {
                id: 'demo15',
                title: 'Poker Face',
                artist: 'Lady Gaga',
                year: 2008,
                context: 'Auto-Tune Ära',
                preview_url: 'https://p.scdn.co/mp3-preview/demo15',
                cover_url: 'https://i.scdn.co/image/demo15',
                album: 'The Fame'
            }
        ];
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Mode selection buttons
        document.querySelectorAll('.mode-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.selectMode(mode);
            });
        });

        // Back to modes button (from setup screen)
        document.getElementById('back-to-modes-btn').addEventListener('click', () => {
            this.showScreen('mode');
        });

        // Exit classic mode event
        window.addEventListener('exitClassicMode', () => {
            this.classicScreen.hide();
            this.showScreen('mode');
        });

        // Listen for reveal event from game screen
        window.addEventListener('showReveal', (e) => {
            this.revealModal.show(e.detail, () => {
                if (this.gameState.status === 'finished') {
                    this.showWinScreen();
                } else {
                    this.gameScreen.prepareNextTurn();
                }
            });
        });

        // Game won event
        this.gameState.on('game:won', (data) => {
            console.log('Game won by:', data.winner.name);
        });

        // Play again button
        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.resetGame();
        });
    }

    /**
     * Select a game mode
     */
    selectMode(mode) {
        this.currentMode = mode;
        
        if (mode === 'classic') {
            this.showScreen('classic');
        } else if (mode === 'timeline') {
            this.showScreen('setup');
        }
    }

    /**
     * Start a new Timeline game
     */
    async startTimelineGame(playerNames) {
        if (this.songs.length === 0) {
            alert('Keine Songs verfügbar. Bitte führe zuerst den Scraper aus.');
            return;
        }

        // Initialize game
        await this.gameState.init(playerNames, this.songs);
        
        // Switch to game screen
        this.showScreen('game');
    }

    /**
     * Show win screen
     */
    showWinScreen() {
        const winner = this.gameState.winner;
        
        // Set winner name
        document.getElementById('winner-name').textContent = winner.name;
        
        // Show final timeline
        const finalCardsContainer = document.getElementById('final-timeline-cards');
        finalCardsContainer.innerHTML = '';
        
        winner.timeline.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'final-card';
            cardEl.textContent = `${card.year} - ${card.title}`;
            finalCardsContainer.appendChild(cardEl);
        });
        
        // Create confetti
        this.createConfetti();
        
        // Show screen
        this.showScreen('win');
    }

    /**
     * Create confetti animation
     */
    createConfetti() {
        const container = document.getElementById('confetti');
        container.innerHTML = '';
        
        const colors = ['#fd79a8', '#00cec9', '#fdcb6e', '#6c5ce7', '#00b894'];
        
        for (let i = 0; i < 50; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = `${Math.random() * 3}s`;
            piece.style.animationDuration = `${2 + Math.random() * 2}s`;
            container.appendChild(piece);
        }
    }

    /**
     * Reset the game and go back to mode selection
     */
    resetGame() {
        this.gameState.reset();
        this.showScreen('mode');
    }

    /**
     * Show a specific screen
     */
    showScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        
        // Show requested screen
        switch (screenName) {
            case 'mode':
                document.getElementById('mode-screen').classList.add('active');
                break;
            case 'setup':
                this.setupScreen.show();
                break;
            case 'game':
                this.gameScreen.show();
                break;
            case 'classic':
                this.classicScreen.show();
                break;
            case 'win':
                document.getElementById('win-screen').classList.add('active');
                break;
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BeatGuessrApp();
});
