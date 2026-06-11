/**
 * Song data: loading, decade helpers and a no-repeat draw deck.
 */

/**
 * Load songs: tries the Flask API first (local dev), falls back to the
 * static JSON file (GitHub Pages). Relative URLs keep subpath hosting working.
 */
export async function loadSongs() {
    try {
        const response = await fetch('api/songs');
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.songs) && data.songs.length) {
                return { songs: data.songs, apiAvailable: true };
            }
        }
    } catch { /* no backend – expected on static hosting */ }

    try {
        const response = await fetch('data/songs.json');
        if (response.ok) {
            const data = await response.json();
            return { songs: data.songs || [], apiAvailable: false };
        }
    } catch { /* handled below */ }

    return { songs: [], apiAvailable: false };
}

/** Decade key for a year, e.g. 1983 -> '80s'. Everything before 1970 counts as 60s. */
export function decadeKey(year) {
    const decade = Math.floor(year / 10) * 10;
    if (decade <= 1960) return '60s';
    if (decade >= 2020) return '20s';
    return `${String(decade).slice(2)}s`;
}

/**
 * Draw deck over the song pool that never repeats within a session.
 * With autoReset the pool refills once exhausted (endless Classic mode).
 */
export class Deck {
    constructor(songs, { autoReset = false } = {}) {
        this.songs = songs;
        this.autoReset = autoReset;
        this.usedIds = new Set();
    }

    get remaining() {
        return this.songs.length - this.usedIds.size;
    }

    draw() {
        let available = this.songs.filter(s => !this.usedIds.has(s.id));
        if (available.length === 0) {
            if (!this.autoReset || this.songs.length === 0) return null;
            this.usedIds.clear();
            available = this.songs;
        }
        const song = available[Math.floor(Math.random() * available.length)];
        this.usedIds.add(song.id);
        return song;
    }

    reset() {
        this.usedIds.clear();
    }
}
