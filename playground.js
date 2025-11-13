// Sprechstimme Playground - Pyodide Implementation

// Audio Context
let audioContext = null;
let masterGain = null;
let analyser = null;
let currentWaveType = 'sine';
let currentVolume = 0.5;
let activeOscillators = [];

// Pyodide
let pyodide = null;
let isPyodideReady = false;

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

        startVisualizer();
    }
}

// Play a single tone
function playTone(frequency, duration, noteName, volumeMult = 1.0) {
    initAudio();

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

// Sprechstimme API for Python (exposed to Pyodide)
window.SprechstimmeAPI = {
    play: function(note, duration = 1.0) {
        const freq = noteFrequencies[note.toUpperCase()];
        if (!freq) {
            log(`Error: Unknown note "${note}"`, 'error');
            return;
        }
        playTone(freq, duration, note);
        log(`♪ Playing ${note} (${freq.toFixed(2)} Hz) for ${duration}s`, 'success');
    },

    playChord: function(notes, duration = 1.0) {
        log(`♪ Playing chord: [${notes.join(', ')}] for ${duration}s`, 'success');
        notes.forEach(note => {
            const freq = noteFrequencies[note.toUpperCase()];
            if (freq) {
                playTone(freq, duration, note, 0.3);
            }
        });
    },

    playMelody: function(notes, durations) {
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

    sequence: function(pattern, tempo = 120) {
        const beatDuration = 60 / tempo;
        let time = 0;
        log(`♪ Playing sequence at ${tempo} BPM`, 'success');

        pattern.forEach(item => {
            const note = item.note || item.get('note');
            const duration = item.duration || item.get('duration');

            if (Array.isArray(note)) {
                setTimeout(() => window.SprechstimmeAPI.playChord(note, duration), time * 1000);
            } else {
                setTimeout(() => window.SprechstimmeAPI.play(note, duration), time * 1000);
            }
            time += duration;
        });
    }
};

// Initialize Pyodide
async function initPyodide() {
    try {
        log('Loading Python environment...', 'info');
        setAudioStatus('loading');

        pyodide = await loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
        });

        // Create the sprechstimme module in Python
        await pyodide.runPythonAsync(`
import js
from pyodide.ffi import to_js
import sys
import types

# Define functions that will be in the module
def play(note, duration=1.0):
    """Play a single note"""
    js.SprechstimmeAPI.play(note, duration)

def playChord(notes, duration=1.0):
    """Play multiple notes simultaneously"""
    notes_js = to_js(notes)
    js.SprechstimmeAPI.playChord(notes_js, duration)

def playMelody(notes, durations):
    """Play a sequence of notes"""
    notes_js = to_js(notes)
    durations_js = to_js(durations)
    js.SprechstimmeAPI.playMelody(notes_js, durations_js)

def setWave(wave_type):
    """Set the waveform type: sine, square, sawtooth, triangle"""
    js.SprechstimmeAPI.setWave(wave_type)

def setVolume(volume):
    """Set volume (0.0 to 1.0)"""
    js.SprechstimmeAPI.setVolume(volume)

def sequence(pattern, tempo=120):
    """Play a sequence with tempo"""
    # Convert Python dicts to JS objects
    pattern_js = to_js([
        {'note': to_js(item['note']) if isinstance(item['note'], list) else item['note'],
         'duration': item['duration']}
        for item in pattern
    ])
    js.SprechstimmeAPI.sequence(pattern_js, tempo)

# Create a proper module
sprechstimme = types.ModuleType('sprechstimme')
sprechstimme.__doc__ = 'Sprechstimme - Browser-based audio synthesis'
sprechstimme.play = play
sprechstimme.playChord = playChord
sprechstimme.playMelody = playMelody
sprechstimme.setWave = setWave
sprechstimme.setVolume = setVolume
sprechstimme.sequence = sequence

# Register it
sys.modules['sprechstimme'] = sprechstimme
`);

        isPyodideReady = true;
        log('✓ Python environment ready!', 'success');
        log('You can now run Python code with real syntax', 'info');
        setAudioStatus('ready');

    } catch (error) {
        log(`Failed to load Python: ${error.message}`, 'error');
        setAudioStatus('error');
    }
}

// Code execution
async function executeCode() {
    if (!isPyodideReady) {
        log('Python environment is still loading...', 'error');
        return;
    }

    const code = document.getElementById('code-editor').value;
    clearOutput();

    try {
        log('Executing Python code...', 'info');

        // Redirect Python stdout to our output
        await pyodide.runPythonAsync(`
import sys
from io import StringIO

_stdout_backup = sys.stdout
sys.stdout = StringIO()
`);

        // Run the user's code
        try {
            await pyodide.runPythonAsync(code);
        } catch (error) {
            log(`Python Error: ${error.message}`, 'error');
        }

        // Get any print output
        const output = await pyodide.runPythonAsync(`
output = sys.stdout.getvalue()
sys.stdout = _stdout_backup
output
`);

        if (output) {
            output.split('\n').forEach(line => {
                if (line.trim()) {
                    log(line, 'success');
                }
            });
        }

        if (activeOscillators.length === 0 && !output) {
            log('Code executed (no output or audio)', 'info');
        }

    } catch (error) {
        log(`Error: ${error.message}`, 'error');
    }
}

// Code Examples
const examples = {
    basic: `# Welcome to Sprechstimme Playground!
# Real Python interpreter powered by Pyodide

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
    } else if (status === 'loading') {
        statusEl.textContent = 'Loading...';
        dot.classList.remove('playing');
    } else if (status === 'error') {
        statusEl.textContent = 'Error';
        dot.classList.remove('playing');
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
    // Initialize Pyodide on load
    initPyodide();

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
    log('Initializing Python environment...', 'info');
});
