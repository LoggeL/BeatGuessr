/**
 * AudioPlayer - Handles audio playback with progress tracking
 */
class AudioPlayer {
    constructor() {
        this.audio = document.getElementById('audio-player');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.progressBar = document.getElementById('progress');
        this.timeDisplay = document.getElementById('time-display');
        this.volumeSlider = document.getElementById('volume-slider');
        
        this.isPlaying = false;
        this.duration = 30; // Default 30 seconds
        
        // Set initial volume
        if (this.volumeSlider) {
            this.audio.volume = this.volumeSlider.value;
        }
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Play/pause button
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());

        // Volume slider
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => {
                this.audio.volume = e.target.value;
            });
        }

        // Audio events
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => {
            this.duration = this.audio.duration || 30;
        });
        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updateButton();
            // Loop the audio
            this.audio.currentTime = 0;
            this.audio.play();
            this.isPlaying = true;
            this.updateButton();
        });
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
        });
    }

    /**
     * Load a new audio source
     */
    load(url) {
        this.stop();
        this.audio.src = url;
        this.audio.load();
        this.progressBar.style.width = '0%';
        this.timeDisplay.textContent = '0:00 / 0:30';
    }

    /**
     * Toggle play/pause
     */
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Play the audio
     */
    play() {
        this.audio.play().catch(e => console.error('Play error:', e));
        this.isPlaying = true;
        this.updateButton();
    }

    /**
     * Pause the audio
     */
    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updateButton();
    }

    /**
     * Stop the audio
     */
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        this.updateButton();
        this.progressBar.style.width = '0%';
    }

    /**
     * Update the play/pause button
     */
    updateButton() {
        this.playPauseBtn.textContent = this.isPlaying ? '⏸' : '▶';
    }

    /**
     * Update the progress bar
     */
    updateProgress() {
        const current = this.audio.currentTime;
        const duration = this.audio.duration || 30;
        const percent = (current / duration) * 100;
        
        this.progressBar.style.width = `${percent}%`;
        this.timeDisplay.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
    }

    /**
     * Format time as M:SS
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Export for use in other files
window.AudioPlayer = AudioPlayer;
