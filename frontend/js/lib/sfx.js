/**
 * Sound effects, synthesized with WebAudio (no audio files needed).
 * Context is created lazily on first use so autoplay policies are respected.
 */

let ctx = null;

function audioContext() {
    if (!ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
}

function tone({ freq, type = 'sine', delay = 0, duration = 0.15, gain = 0.12, slide = 0 }) {
    const ac = audioContext();
    if (!ac) return;

    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const amp = ac.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t0 + duration);

    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

    osc.connect(amp).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
}

export const sfx = {
    /** Game-show buzzer hit */
    buzz() {
        tone({ freq: 520, type: 'square', duration: 0.22, gain: 0.1, slide: -260 });
        tone({ freq: 260, type: 'square', duration: 0.22, gain: 0.06, slide: -130, delay: 0.02 });
    },
    /** Rising major arpeggio */
    correct() {
        [523.25, 659.25, 783.99].forEach((freq, i) =>
            tone({ freq, type: 'triangle', delay: i * 0.09, duration: 0.22, gain: 0.1 }));
    },
    /** Low descending groan */
    wrong() {
        tone({ freq: 196, type: 'sawtooth', duration: 0.35, gain: 0.08, slide: -70 });
    },
    /** Short dull thud */
    locked() {
        tone({ freq: 150, type: 'square', duration: 0.1, gain: 0.07 });
    },
    /** Tiny UI tick */
    tick() {
        tone({ freq: 880, type: 'sine', duration: 0.05, gain: 0.04 });
    },
};
