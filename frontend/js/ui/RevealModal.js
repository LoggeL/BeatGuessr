/**
 * RevealModal - Handles the song reveal modal
 */
class RevealModal {
    constructor() {
        this.modal = document.getElementById('reveal-modal');
        this.coverImg = document.getElementById('reveal-cover-img');
        this.title = document.getElementById('reveal-title');
        this.artist = document.getElementById('reveal-artist');
        this.year = document.getElementById('reveal-year');
        this.context = document.getElementById('reveal-context');
        this.result = document.getElementById('reveal-result');
        this.nextBtn = document.getElementById('next-turn-btn');
        
        this.onNext = null;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.nextBtn.addEventListener('click', () => {
            this.hide();
            if (this.onNext) {
                this.onNext();
            }
        });
    }

    /**
     * Show the reveal modal with result
     * @param {Object} result - The guess result
     * @param {boolean} result.correct - Whether the guess was correct
     * @param {SongCard} result.song - The song that was guessed
     * @param {Player} result.player - The player who guessed
     */
    show(result, onNext) {
        this.onNext = onNext;
        
        const { correct, song, player } = result;
        
        // Set song info
        this.coverImg.src = song.coverUrl || '';
        this.title.textContent = song.title;
        this.artist.textContent = song.artist;
        this.year.textContent = song.year;
        this.context.textContent = song.context;
        
        // Set result
        this.result.className = `reveal-result ${correct ? 'correct' : 'incorrect'}`;
        this.result.innerHTML = correct
            ? `<span class="result-icon">✅</span><span class="result-text">Richtig! Karte hinzugefügt</span>`
            : `<span class="result-icon">❌</span><span class="result-text">Falsch! Karte abgelegt</span>`;
        
        // Update button text
        if (player.hasWon()) {
            this.nextBtn.innerHTML = `<span>Gewonnen!</span><span class="btn-icon">🏆</span>`;
        } else {
            this.nextBtn.innerHTML = `<span>Nächster Spieler</span><span class="btn-icon">➡️</span>`;
        }
        
        // Show modal
        this.modal.classList.add('active');
    }

    /**
     * Hide the modal
     */
    hide() {
        this.modal.classList.remove('active');
    }
}

// Export for use in other files
window.RevealModal = RevealModal;
