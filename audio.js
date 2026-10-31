(() => {
    'use strict';

    let audioCtx = null;
    let enabled = true;

    function init() {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Web Audio API не поддерживается:', e);
                enabled = false;
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function play(freq, duration = 0.1, type = 'sine', volume = 0.08) {
        if (!enabled || !audioCtx) return;

        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

            gain.gain.setValueAtTime(volume, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch (e) {}
    }

    function setEnabled(v) {
        enabled = !!v;
    }
    function isEnabled() {
        return enabled;
    }

    window.Audio = {
        init,
        play,
        setEnabled,
        isEnabled
    };
})();