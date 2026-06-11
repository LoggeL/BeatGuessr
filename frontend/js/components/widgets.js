/**
 * Shared UI components: preview player, vinyl cover, modals,
 * scoreboards, song cards and confetti.
 */
import { el, icon, formatTime, setChildren } from '../lib/dom.js';
import { decadeKey } from '../lib/songs.js';

/* ---------------------------------------------------------------- *
 * Preview player: play/pause, seekable progress, time, volume.
 * Owns its own <audio> element.
 * ---------------------------------------------------------------- */
export class PreviewPlayer {
    constructor({ onPlayStateChange = null } = {}) {
        this.audio = new Audio();
        this.audio.preload = 'auto';
        this.onPlayStateChange = onPlayStateChange;

        this.playIcon = icon('play');
        this.pauseIcon = icon('pause');
        this.playBtn = el('button', { class: 'play-btn', 'aria-label': 'Abspielen' }, this.playIcon);
        this.progressFill = el('div', { class: 'progress-fill' });
        this.progressTrack = el('div', { class: 'progress-track' }, this.progressFill);
        this.timeLabel = el('span', { class: 'time-label' }, '0:00 / 0:30');
        this.volumeSlider = el('input', {
            class: 'volume-slider', type: 'range',
            min: '0', max: '1', step: '0.01', value: '0.9',
            'aria-label': 'Lautstärke',
        });

        this.element = el('div', { class: 'preview-player' },
            this.playBtn,
            el('div', { class: 'progress-area' }, this.progressTrack, this.timeLabel),
            el('div', { class: 'volume-area' }, icon('volume', 'icon-sm'), this.volumeSlider),
        );

        this.audio.volume = parseFloat(this.volumeSlider.value);

        this.playBtn.addEventListener('click', () => this.toggle());
        this.volumeSlider.addEventListener('input', () => {
            this.audio.volume = parseFloat(this.volumeSlider.value);
        });
        this.progressTrack.addEventListener('click', event => {
            if (!this.audio.duration) return;
            const rect = this.progressTrack.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
            this.audio.currentTime = ratio * this.audio.duration;
        });

        this.audio.addEventListener('timeupdate', () => this.renderProgress());
        this.audio.addEventListener('play', () => this.setPlaying(true));
        this.audio.addEventListener('pause', () => this.setPlaying(false));
        this.audio.addEventListener('ended', () => this.setPlaying(false));
    }

    setPlaying(playing) {
        setChildren(this.playBtn, playing ? this.pauseIcon : this.playIcon);
        this.playBtn.setAttribute('aria-label', playing ? 'Pausieren' : 'Abspielen');
        if (this.onPlayStateChange) this.onPlayStateChange(playing);
    }

    renderProgress() {
        const current = this.audio.currentTime || 0;
        const duration = this.audio.duration || 30;
        this.progressFill.style.width = `${(current / duration) * 100}%`;
        this.timeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    }

    load(url, { autoplay = false } = {}) {
        this.audio.src = url;
        this.audio.load();
        this.progressFill.style.width = '0%';
        this.timeLabel.textContent = '0:00 / 0:30';
        if (autoplay) this.play();
    }

    play() {
        this.audio.play().catch(() => { /* autoplay blocked – user can press play */ });
    }

    toggle() {
        if (this.audio.paused) this.play();
        else this.audio.pause();
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }

    destroy() {
        this.stop();
        this.audio.removeAttribute('src');
        this.audio.load();
    }
}

/* ---------------------------------------------------------------- *
 * Vinyl cover: a spinning record while the song is a mystery,
 * flips to the album cover on reveal.
 * ---------------------------------------------------------------- */
export function createVinyl({ size = '' } = {}) {
    const cover = el('img', { class: 'vinyl-cover', alt: 'Album-Cover' });
    const element = el('div', { class: `vinyl${size ? ` vinyl-${size}` : ''}` },
        el('div', { class: 'vinyl-disc' },
            el('div', { class: 'vinyl-label' }, icon('music'))),
        cover,
    );

    return {
        element,
        setSpinning(spinning) {
            element.classList.toggle('spinning', spinning);
        },
        reveal(url) {
            if (url) cover.src = url;
            element.classList.add('revealed');
        },
        conceal() {
            element.classList.remove('revealed');
            cover.removeAttribute('src');
        },
    };
}

/* ---------------------------------------------------------------- *
 * Modal
 * ---------------------------------------------------------------- */
export function openModal(content, { wide = false } = {}) {
    const card = el('div', { class: `modal-card${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true' }, content);
    const overlay = el('div', { class: 'modal-overlay' }, card);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    return {
        close() {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 250);
        },
    };
}

/* ---------------------------------------------------------------- *
 * Song card (timeline) with decade-colored year chip.
 * ---------------------------------------------------------------- */
export function songCard(song, { hideYear = false, highlight = false } = {}) {
    return el('div', { class: `song-card decade-${decadeKey(song.year)}${highlight ? ' highlight' : ''}` },
        song.cover_url ? el('img', { class: 'song-card-cover', src: song.cover_url, alt: '', loading: 'lazy' }) : null,
        el('span', { class: 'song-card-year' }, hideYear ? '?' : song.year),
        el('span', { class: 'song-card-title', title: `${song.artist} – ${song.title}` }, song.title),
    );
}

/* ---------------------------------------------------------------- *
 * Scoreboard (Buzzer mode): ranked list with lock state.
 * players: [{ id, name, score, isLockedOut, isConnected }]
 * ---------------------------------------------------------------- */
export function scoreboard(players, { meId = null, maxScore = null } = {}) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    return el('div', { class: 'scoreboard' },
        sorted.map((player, index) => el('div', {
            class: 'scoreboard-row'
                + (player.id === meId ? ' is-me' : '')
                + (player.isLockedOut ? ' locked-out' : '')
                + (player.isConnected === false ? ' disconnected' : ''),
        },
            el('span', { class: 'rank' }, `${index + 1}`),
            el('span', { class: 'name' }, player.name + (player.id === meId ? ' (Du)' : '')),
            player.isLockedOut ? icon('lock', 'icon-sm lock-icon') : null,
            el('span', { class: 'score' }, maxScore ? `${player.score}/${maxScore}` : `${player.score}`),
        )),
    );
}

/* ---------------------------------------------------------------- *
 * Confetti
 * ---------------------------------------------------------------- */
const CONFETTI_COLORS = ['#8b7cf8', '#f472b6', '#34d399', '#fbbf24', '#38bdf8', '#fb7185'];

export function confettiBurst(container, count = 80) {
    const layer = el('div', { class: 'confetti-layer', 'aria-hidden': 'true' });
    for (let i = 0; i < count; i++) {
        layer.appendChild(el('span', {
            class: 'confetti-piece',
            style: {
                left: `${Math.random() * 100}%`,
                background: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
                animationDelay: `${Math.random() * 2.5}s`,
                animationDuration: `${2.5 + Math.random() * 2.5}s`,
                width: `${6 + Math.random() * 6}px`,
            },
        }));
    }
    container.appendChild(layer);
    return layer;
}

/* ---------------------------------------------------------------- *
 * Screen header bar
 * ---------------------------------------------------------------- */
export function screenHeader({ iconName, title, center = null, right = null }) {
    return el('header', { class: 'screen-header' },
        el('div', { class: 'header-brand' }, icon(iconName), el('span', {}, title)),
        el('div', { class: 'header-center' }, center),
        el('div', { class: 'header-right' }, right),
    );
}
