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

// WAV file playback function (exposed to Pyodide)
window.playWavFromBase64 = async function(base64Data) {
    try {
        initAudio();

        // Decode base64 to ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Decode audio data
        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);

        // Create buffer source
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Connect to master gain
        source.connect(masterGain);

        // Play
        source.start(0);
        setAudioStatus('playing');
        log('♪ Playing audio from sprechstimme', 'success');

        source.onended = () => {
            setAudioStatus('ready');
        };

    } catch (error) {
        log(`Error playing audio: ${error.message}`, 'error');
        console.error('WAV playback error:', error);
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

        log('Installing sprechstimme from PyPI...', 'info');

        // Load micropip and install sprechstimme with sounddevice patching
        await pyodide.loadPackage('micropip');

        await pyodide.runPythonAsync(`
import micropip
import sys

# Install sprechstimme (this will also install sounddevice)
await micropip.install('sprechstimme')

# Now patch the installed sounddevice module to prevent PortAudio error
import pathlib

# Find the sounddevice.py file in site-packages
sounddevice_path = pathlib.Path('/lib/python3.11/site-packages/sounddevice.py')

if sounddevice_path.exists():
    # Read the file
    content = sounddevice_path.read_text()

    # Comment out the line that raises the PortAudio error
    # This is around line 71: "raise OSError('PortAudio library not found')"
    content = content.replace(
        "raise OSError('PortAudio library not found')",
        "# raise OSError('PortAudio library not found')  # Patched for Pyodide"
    )

    # Write it back
    sounddevice_path.write_text(content)

    print("Patched sounddevice to work in browser environment")
`);

        log('Setting up audio playback...', 'info');

        // Create helper functions for WAV playback
        await pyodide.runPythonAsync(`
import js
from pyodide.ffi import to_js
import sys
import io
import base64

# Helper function to save and play WAV
def _play_wav(wav_data):
    """Internal function to save and play WAV data"""
    # Convert WAV bytes to base64
    wav_base64 = base64.b64encode(wav_data).decode('utf-8')
    # Call JavaScript to play it
    js.playWavFromBase64(wav_base64)

# Import sprechstimme after patching sounddevice
import sprechstimme

# Store original play function
original_play = sprechstimme.play

def custom_play(*args, **kwargs):
    """Wrapper that captures WAV output and plays it"""
    # Create a BytesIO buffer to capture output
    buffer = io.BytesIO()

    # If no output file is specified, set buffer as output
    if 'output' not in kwargs:
        kwargs['output'] = buffer

    # Call original function
    result = original_play(*args, **kwargs)

    # If we captured to buffer, play it
    if kwargs.get('output') == buffer:
        buffer.seek(0)
        wav_data = buffer.read()
        if len(wav_data) > 0:
            _play_wav(wav_data)

    return result

# Patch sprechstimme.play
sprechstimme.play = custom_play
`);

        isPyodideReady = true;
        log('✓ Python environment ready!', 'success');
        log('✓ Sprechstimme library installed from PyPI', 'success');
        log('You can now use the real sprechstimme library!', 'info');
        setAudioStatus('ready');

    } catch (error) {
        log(`Failed to load Python: ${error.message}`, 'error');
        console.error('Pyodide initialization error:', error);
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
# Using the actual sprechstimme library from PyPI

import sprechstimme

# Play a single tone at 440 Hz (A4) for 1 second
sprechstimme.play(440, duration=1.0)

# Try other frequencies:
# sprechstimme.play(523, duration=1.0)  # C5
# sprechstimme.play(261, duration=1.0)  # C4`,

    chord: `import sprechstimme

# Play multiple frequencies (C major chord)
# C4 = 261.63 Hz, E4 = 329.63 Hz, G4 = 392.00 Hz
sprechstimme.play(261.63, duration=2.0)
sprechstimme.play(329.63, duration=2.0)
sprechstimme.play(392.00, duration=2.0)

print("Playing C major chord!")`,

    melody: `import sprechstimme

# Play a simple melody (C major scale)
# Each call generates a separate audio file
notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]
# C4, D4, E4, F4, G4, A4, B4, C5

for freq in notes:
    sprechstimme.play(freq, duration=0.5)

print("Melody generated! (All notes will play)")`,

    synthesis: `import sprechstimme

# Basic sine wave synthesis
# Generate a 440 Hz tone (A4)
sprechstimme.play(440, duration=1.0)

print("Playing 440 Hz sine wave")

# The real sprechstimme library generates WAV files
# that are played back in your browser!`,

    arpeggio: `import sprechstimme

# C major arpeggio
# C4, E4, G4, C5, G4, E4, C4
arpeggio = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63]

for freq in arpeggio:
    sprechstimme.play(freq, duration=0.3)

print("Arpeggio complete!")`,

    sequence: `import sprechstimme

# Create a musical sequence
# Play a simple pattern
sequence = [
    (261.63, 0.5),  # C4
    (329.63, 0.5),  # E4
    (392.00, 0.5),  # G4
    (523.25, 1.0),  # C5
]

print("Playing sequence...")
for freq, duration in sequence:
    sprechstimme.play(freq, duration=duration)

print("Sequence complete!")`
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
