/**
 * Player - Represents a player in the game
 * Designed to work for hot seat now, but ready for multiplayer later
 */
class Player {
    constructor(id, name, color) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.timeline = []; // Array of SongCard objects, sorted by year
        this.isLocal = true; // For future multiplayer: false for remote players
    }

    /**
     * Get the number of cards in timeline
     */
    get score() {
        return this.timeline.length;
    }

    /**
     * Check if player has won
     */
    hasWon() {
        return this.score >= 10;
    }

    /**
     * Add a card to the timeline at the correct position
     * @param {SongCard} card - The card to add
     * @param {number} position - The position to insert at
     */
    addCard(card, position = null) {
        if (position !== null) {
            this.timeline.splice(position, 0, card);
        } else {
            // Find correct position based on year
            const insertIndex = this.timeline.findIndex(c => c.year > card.year);
            if (insertIndex === -1) {
                this.timeline.push(card);
            } else {
                this.timeline.splice(insertIndex, 0, card);
            }
        }
        // Ensure timeline is sorted
        this.timeline.sort((a, b) => a.year - b.year);
    }

    /**
     * Get the years in the timeline
     */
    getYears() {
        return this.timeline.map(card => card.year);
    }

    /**
     * Get position options for a new card
     * Returns array of { position, label } objects
     */
    getPositionOptions() {
        const years = this.getYears();
        const options = [];

        if (years.length === 0) {
            options.push({ position: 0, label: 'Erste Karte' });
            return options;
        }

        // Before first card
        options.push({ 
            position: 0, 
            label: `Vor ${years[0]}` 
        });

        // Between cards
        for (let i = 0; i < years.length - 1; i++) {
            options.push({ 
                position: i + 1, 
                label: `${years[i]} - ${years[i + 1]}` 
            });
        }

        // After last card
        options.push({ 
            position: years.length, 
            label: `Nach ${years[years.length - 1]}` 
        });

        return options;
    }

    /**
     * Check if a guess is correct
     * @param {number} position - The guessed position
     * @param {number} year - The actual year of the card
     */
    isCorrectGuess(position, year) {
        const years = this.getYears();

        if (years.length === 0) {
            return true; // Any position is correct for empty timeline
        }

        const beforeYear = position > 0 ? years[position - 1] : -Infinity;
        const afterYear = position < years.length ? years[position] : Infinity;

        return year >= beforeYear && year <= afterYear;
    }

    /**
     * Serialize player data for API/storage
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            timeline: this.timeline.map(card => card.id),
            score: this.score
        };
    }
}

// Player colors
Player.COLORS = [
    'var(--accent-pink)',
    'var(--accent-teal)',
    'var(--accent-gold)',
    'var(--accent-purple)'
];

// Export for use in other files
window.Player = Player;
