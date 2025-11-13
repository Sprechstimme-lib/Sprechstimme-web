// Sprechstimme Playground - Web Audio Implementation

// Audio Context
let audioContext = null;
let masterGain = null;
let analyser = null;
let currentWaveType = 'sine';
let currentVolume = 0.5;
let activeOscillators = [];

// Note to frequency mapping
const noteFrequencies = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51
};

// Initialize Audio Context
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = currentVolume;

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        masterGain.connect(analyser);
        analyser.connect(audioContext.destination);

        log('Audio system initialized', 'success');
        startVisualizer();
    }
}

// Sprechstimme API Implementation
const sp = {
    play: function(note, duration = 1.0) {
        initAudio();
        const freq = noteFrequencies[note.toUpperCase()];
        if (!freq) {
            log(`Error: Unknown note "${note}"`, 'error');
            return;
        }

        playTone(freq, duration, note);
        log(`♪ Playing ${note} (${freq.toFixed(2)} Hz) for ${duration}s`, 'success');
    },

    playChord: function(notes, duration = 1.0) {
        initAudio();
        log(`♪ Playing chord: [${notes.join(', ')}] for ${duration}s`, 'success');

        notes.forEach(note => {
            const freq = noteFrequencies[note.toUpperCase()];
            if (freq) {
                playTone(freq, duration, note, 0.3); // Lower volume for chords
            }
        });
    },

    playMelody: function(notes, durations) {
        initAudio();
        if (notes.length !== durations.length) {
            log('Error: notes and durations must have same length', 'error');
            return;
        }

        log(`♪ Playing melody: ${notes.length} notes`, 'success');

        let time = 0;
        notes.forEach((note, i) => {
            const freq = noteFrequencies[note.toUpperCase()];
            const dur = durations[i];
            if (freq) {
                setTimeout(() => {
                    playTone(freq, dur, note);
                }, time * 1000);
            }
            time += dur;
        });
    },

    setWave: function(waveType) {
        currentWaveType = waveType;
        document.getElementById('wave-select').value = waveType;
        log(`Waveform changed to: ${waveType}`, 'info');
    },

    setVolume: function(volume) {
        currentVolume = Math.max(0, Math.min(1, volume));
        if (masterGain) {
            masterGain.gain.value = currentVolume;
        }
        const slider = document.getElementById('volume-control');
        slider.value = currentVolume * 100;
        document.getElementById('volume-value').textContent = Math.round(currentVolume * 100) + '%';
        log(`Volume set to: ${Math.round(currentVolume * 100)}%`, 'info');
    },

    // Additional utility functions
    sequence: function(pattern, tempo = 120) {
        const beatDuration = 60 / tempo;
        let time = 0;

        log(`♪ Playing sequence at ${tempo} BPM`, 'success');

        pattern.forEach(item => {
            if (Array.isArray(item.note)) {
                setTimeout(() => sp.playChord(item.note, item.duration), time * 1000);
            } else {
                setTimeout(() => sp.play(item.note, item.duration), time * 1000);
            }
            time += item.duration;
        });
    }
};

// Play a single tone
function playTone(frequency, duration, noteName, volumeMult = 1.0) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = currentWaveType;
    oscillator.frequency.value = frequency;

    // ADSR Envelope
    const now = audioContext.currentTime;
    const attack = 0.01;
    const decay = 0.1;
    const sustain = 0.7;
    const release = 0.1;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volumeMult, now + attack);
    gainNode.gain.linearRampToValueAtTime(sustain * volumeMult, now + attack + decay);
    gainNode.gain.setValueAtTime(sustain * volumeMult, now + duration - release);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.start(now);
    oscillator.stop(now + duration);

    activeOscillators.push({ oscillator, gainNode, note: noteName });

    // Update UI
    updatePlayingNotes(noteName);
    setAudioStatus('playing');

    oscillator.onended = () => {
        activeOscillators = activeOscillators.filter(o => o.oscillator !== oscillator);
        if (activeOscillators.length === 0) {
            setAudioStatus('ready');
            clearPlayingNotes();
        }
    };
}

// Stop all audio
function stopAllAudio() {
    activeOscillators.forEach(({ oscillator, gainNode }) => {
        try {
            gainNode.gain.cancelScheduledValues(audioContext.currentTime);
            gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.05);
            oscillator.stop(audioContext.currentTime + 0.05);
        } catch (e) {
            // Already stopped
        }
    });
    activeOscillators = [];
    setAudioStatus('ready');
    clearPlayingNotes();
    log('All audio stopped', 'info');
}

// Code Examples
const examples = {
    basic: `# Welcome to Sprechstimme Playground!
# This runs in your browser with real audio playback

import sprechstimme as sp

# Play a single note
sp.play('A4', duration=1.0)

# Try changing the note or duration!
# Available notes: C3, D3, E3, F3, G3, A3, B3, C4, D4, E4, F4, G4, A4, B4, C5, etc.`,

    chord: `import sprechstimme as sp

# Play a C major chord
sp.playChord(['C4', 'E4', 'G4'], duration=2.0)

# Try other chords:
# sp.playChord(['F4', 'A4', 'C5'], duration=2.0)  # F major
# sp.playChord(['G4', 'B4', 'D5'], duration=2.0)  # G major`,

    melody: `import sprechstimme as sp

# Play a simple melody
notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
durations = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.0]

sp.playMelody(notes, durations)`,

    synthesis: `import sprechstimme as sp

# Try different waveforms
sp.setWave('sine')
sp.play('A4', duration=1.0)

# sp.setWave('square')  # Uncomment to try!
# sp.play('A4', duration=1.0)

# sp.setWave('sawtooth')
# sp.play('A4', duration=1.0)`,

    arpeggio: `import sprechstimme as sp

# C major arpeggio
notes = ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4']
durations = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.6]

sp.playMelody(notes, durations)`,

    sequence: `import sprechstimme as sp

# Create a musical sequence
pattern = [
    {'note': 'C4', 'duration': 0.5},
    {'note': ['C4', 'E4', 'G4'], 'duration': 0.5},
    {'note': 'E4', 'duration': 0.5},
    {'note': ['C4', 'E4', 'G4'], 'duration': 0.5},
    {'note': 'G4', 'duration': 1.0}
]

sp.sequence(pattern, tempo=120)`
};

// Code execution
function executeCode() {
    const code = document.getElementById('code-editor').value;
    clearOutput();

    try {
        // Parse and convert Python-like code to JavaScript
        const lines = code.split('\n');
        const context = {}; // Store variables

        log('Executing code...', 'info');

        // Process each line
        lines.forEach((line, index) => {
            const trimmed = line.trim();

            // Skip comments, empty lines, and imports
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('import')) {
                return;
            }

            try {
                // Handle variable assignment (e.g., notes = [...])
                if (trimmed.includes('=') && !trimmed.startsWith('sp.')) {
                    const parts = trimmed.split('=');
                    const varName = parts[0].trim();
                    const varValue = parts.slice(1).join('=').trim();

                    // Convert Python syntax to JavaScript
                    const jsValue = pythonToJs(varValue);

                    // Store in context and make it available
                    context[varName] = jsValue;
                    // Also make it globally available for eval
                    window[varName] = jsValue;
                }
                // Handle sp.* commands
                else if (trimmed.startsWith('sp.')) {
                    // Convert Python-style parameters to JavaScript
                    const jsLine = pythonToJs(trimmed);
                    eval(jsLine);
                }
            } catch (e) {
                log(`Error on line ${index + 1}: ${e.message}`, 'error');
            }
        });

        // Clean up global variables
        setTimeout(() => {
            Object.keys(context).forEach(key => {
                delete window[key];
            });
        }, 100);

        if (activeOscillators.length === 0) {
            log('Code executed (no audio produced)', 'info');
        }

    } catch (error) {
        log(`Error: ${error.message}`, 'error');
    }
}

// Convert Python syntax to JavaScript
function pythonToJs(pythonCode) {
    let js = pythonCode;

    // Convert Python lists to JavaScript arrays (already compatible)
    // Convert Python dicts to JavaScript objects
    js = js.replace(/\{(['"])\s*(\w+)\1\s*:/g, '{$2:'); // {'key': -> {key:
    js = js.replace(/:\s*(['"])([^'"]+)\1/g, ': "$2"'); // Ensure string values are quoted

    // Convert Python True/False to JavaScript
    js = js.replace(/\bTrue\b/g, 'true');
    js = js.replace(/\bFalse\b/g, 'false');
    js = js.replace(/\bNone\b/g, 'null');

    // Handle Python keyword arguments (e.g., duration=1.0)
    // These are already compatible with JavaScript

    return js;
}

// UI Helper Functions
function log(message, type = 'info') {
    const output = document.getElementById('output-display');
    const placeholder = output.querySelector('.output-placeholder');
    if (placeholder) placeholder.remove();

    const line = document.createElement('div');
    line.className = `output-line ${type}`;
    line.textContent = message;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

function clearOutput() {
    const output = document.getElementById('output-display');
    output.innerHTML = '<span class="output-placeholder">Output cleared</span>';
}

function setAudioStatus(status) {
    const statusEl = document.getElementById('audio-status');
    const dot = document.querySelector('.indicator-dot');

    if (status === 'playing') {
        statusEl.textContent = 'Playing';
        dot.classList.add('playing');
    } else {
        statusEl.textContent = 'Ready';
        dot.classList.remove('playing');
    }
}

function updatePlayingNotes(note) {
    const notesDisplay = document.getElementById('current-notes');
    const placeholder = notesDisplay.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    const badge = document.createElement('span');
    badge.className = 'note-badge';
    badge.textContent = note;
    notesDisplay.appendChild(badge);

    setTimeout(() => badge.remove(), 2000);
}

function clearPlayingNotes() {
    const notesDisplay = document.getElementById('current-notes');
    setTimeout(() => {
        if (activeOscillators.length === 0) {
            notesDisplay.innerHTML = '<span class="placeholder">No notes playing</span>';
        }
    }, 2100);
}

// Visualizer
function startVisualizer() {
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        requestAnimationFrame(draw);

        analyser.getByteTimeDomainData(dataArray);

        ctx.fillStyle = '#2C2416';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#D17B47';
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }

    draw();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Run button
    document.getElementById('run-btn').addEventListener('click', () => {
        executeCode();
    });

    // Clear button
    document.getElementById('clear-btn').addEventListener('click', () => {
        clearOutput();
    });

    // Stop button
    document.getElementById('stop-btn').addEventListener('click', () => {
        stopAllAudio();
    });

    // Volume control
    const volumeSlider = document.getElementById('volume-control');
    volumeSlider.addEventListener('input', (e) => {
        currentVolume = e.target.value / 100;
        if (masterGain) {
            masterGain.gain.value = currentVolume;
        }
        document.getElementById('volume-value').textContent = e.target.value + '%';
    });

    // Waveform select
    document.getElementById('wave-select').addEventListener('change', (e) => {
        currentWaveType = e.target.value;
    });

    // Example buttons
    document.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.example-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const example = this.getAttribute('data-example');
            document.getElementById('code-editor').value = examples[example];
            clearOutput();
            log(`Loaded example: ${example}`, 'info');
        });
    });

    // Keyboard shortcut: Ctrl/Cmd + Enter to run
    document.getElementById('code-editor').addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            executeCode();
        }

        // Tab support
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            e.target.value = e.target.value.substring(0, start) + '    ' + e.target.value.substring(end);
            e.target.selectionStart = e.target.selectionEnd = start + 4;
        }
    });

    // Welcome message
    log('🎵 Welcome to Sprechstimme Playground!', 'success');
    log('Click "Run Code" or press Ctrl+Enter to execute', 'info');
});
