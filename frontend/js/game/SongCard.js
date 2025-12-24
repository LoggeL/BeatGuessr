/**
 * SongCard - Represents a song with its metadata
 */
class SongCard {
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.artist = data.artist;
        this.year = data.year;
        this.context = data.context || '';
        this.previewUrl = data.preview_url;
        this.coverUrl = data.cover_url;
        this.album = data.album || '';
        this.spotifyUrl = data.spotify_url || '';
    }

    /**
     * Get the decade class for styling
     */
    getDecadeClass() {
        const decade = Math.floor(this.year / 10) * 10;
        if (decade <= 1960) return 'decade-60s';
        if (decade === 1970) return 'decade-70s';
        if (decade === 1980) return 'decade-80s';
        if (decade === 1990) return 'decade-90s';
        if (decade === 2000) return 'decade-00s';
        if (decade === 2010) return 'decade-10s';
        return 'decade-20s';
    }

    /**
     * Create HTML element for the card
     */
    createElement(showYear = true) {
        const card = document.createElement('div');
        card.className = `song-card ${this.getDecadeClass()}`;
        card.dataset.songId = this.id;
        card.dataset.year = this.year;

        card.innerHTML = `
            ${this.coverUrl ? `<img class="card-cover" src="${this.coverUrl}" alt="${this.title}">` : ''}
            <div class="card-year">${showYear ? this.year : '???'}</div>
            <div class="card-title" title="${this.title}">${this.title}</div>
        `;

        return card;
    }
}

// Export for use in other files
window.SongCard = SongCard;
