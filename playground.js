// Sprechstimme Playground - Pyodide Implementation

// Analytics - Track page visits
(async function trackVisit() {
    try {
        // Get public IP address
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();

        // Send to Cloudflare worker
        await fetch('https://sprechstimme-web.sprechstimme-is-beautiful.workers.dev', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ip: ipData.ip,
                page: window.location.pathname,
                timestamp: new Date().toISOString()
            })
        });
    } catch (e) {
        // Silently fail - don't impact user experience
    }
})();

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
// Returns a Promise that resolves when audio playback completes
window.playWavFromBase64 = function(base64Data) {
    return new Promise(async (resolve, reject) => {
        try {
            initAudio();

            // Resume audio context if suspended (required for user interaction policy)
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            // Decode base64 to ArrayBuffer
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Decode audio data
            const audioBuffer = await audioContext.decodeAudioData(bytes.buffer.slice(0));

            // Create buffer source
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;

            // Connect to master gain
            source.connect(masterGain);

            // Play
            source.start(0);
            setAudioStatus('playing');

            // Resolve when audio ends
            source.onended = () => {
                setAudioStatus('ready');
                resolve();
            };

        } catch (error) {
            log(`Error playing audio: ${error.message}`, 'error');
            console.error('WAV playback error:', error);
            reject(error);
        }
    });
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

# Strategy: Create a stub sounddevice module FIRST, before any installation
# This prevents the real sounddevice from being imported and failing
print("Creating sounddevice stub module...")

# Create a minimal sounddevice module that provides the API sprechstimme expects
# but doesn't try to initialize PortAudio
import types

sounddevice_stub = types.ModuleType('sounddevice')

# Add minimal attributes that sprechstimme might need
sounddevice_stub.play = lambda *args, **kwargs: None  # No-op play function
sounddevice_stub.wait = lambda: None  # No-op wait function
sounddevice_stub.stop = lambda: None  # No-op stop function
sounddevice_stub.OutputStream = None  # Placeholder

# Inject our stub into sys.modules BEFORE installing anything
sys.modules['sounddevice'] = sounddevice_stub
print("✓ Installed sounddevice stub module")

# Now install sprechstimme - it will find our stub sounddevice in sys.modules
print("Installing sprechstimme from PyPI...")
await micropip.install('sprechstimme')
print("✓ Sprechstimme installed successfully")
`);

        log('Setting up audio playback...', 'info');

        // Create helper functions for WAV playback using Track API
        await pyodide.runPythonAsync(`
import js
from pyodide.ffi import to_js
import sys
import io
import base64
import os

# Helper function to play WAV data in browser (async - waits for completion)
async def _play_wav(wav_data):
    """Internal function to play WAV data via JavaScript and wait for completion"""
    wav_base64 = base64.b64encode(wav_data).decode('utf-8')
    # Await the JavaScript promise to wait for audio to finish
    await js.playWavFromBase64(wav_base64)

# Import sprechstimme after stubbing sounddevice
import sprechstimme as sp

# Store original functions
_original_new = sp.new
_original_create = sp.create
_original_play = sp.play

# Track synthesizer configurations
_synth_configs = {}

def custom_new(name):
    """Wrapper for sp.new()"""
    _synth_configs[name] = {'wavetype': sp.waves.sine}
    return _original_new(name)

def custom_create(name, **kwargs):
    """Wrapper for sp.create() - store config for later use"""
    if name in _synth_configs:
        _synth_configs[name].update(kwargs)
    else:
        _synth_configs[name] = kwargs
    return _original_create(name, **kwargs)

async def _async_play(synth_name, notes, duration=1.0, **kwargs):
    """Async implementation that generates and plays audio, waiting for completion"""
    try:
        # Create a Track for audio generation
        track = sp.Track(bpm=120)

        # Calculate duration in beats (at 120 bpm, 1 beat = 0.5 seconds)
        beats = duration * 2

        # Add the note(s) to the track
        track.add(synth_name, notes=notes, duration=beats)

        # Export to a temporary file in the virtual filesystem
        temp_file = "/tmp/sprechstimme_output.wav"
        track.export(temp_file)

        # Read the WAV file and play it
        with open(temp_file, 'rb') as f:
            wav_data = f.read()

        if len(wav_data) > 44:  # WAV header is 44 bytes, need actual audio data
            await _play_wav(wav_data)  # Wait for audio to finish playing
        else:
            print(f"Warning: Generated audio file is too small ({len(wav_data)} bytes)")

        # Clean up
        try:
            os.remove(temp_file)
        except:
            pass

    except Exception as e:
        print(f"Audio playback error: {e}")
        import traceback
        traceback.print_exc()

# Import run_sync to make async functions work synchronously
from pyodide.ffi import run_sync

def custom_play(synth_name, notes, duration=1.0, **kwargs):
    """Wrapper that plays audio and waits for completion (works without await)"""
    run_sync(_async_play(synth_name, notes, duration, **kwargs))

# Replace sprechstimme functions with our wrappers
sp.new = custom_new
sp.create = custom_create
sp.play = custom_play
`);

        isPyodideReady = true;
        log('✓ Python environment ready!', 'success');
        log('✓ Sprechstimme library installed from PyPI', 'success');
        log('Usage: sp.new("synth") → sp.create("synth", wavetype=sp.waves.sine) → sp.play("synth", "C4", duration=1.0)', 'info');
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

import sprechstimme as sp

# Step 1: Create a new synthesizer
sp.new("lead")

# Step 2: Configure the synthesizer with a waveform
sp.create("lead", wavetype=sp.waves.sine)

# Step 3: Play a note (A4 = MIDI 69)
sp.play("lead", "A4", duration=1.0)

print("Playing A4!")`,

    chord: `import sprechstimme as sp

# Create and configure a synthesizer
sp.new("pad")
sp.create("pad", wavetype=sp.waves.sine)

# Play a C major chord (C4, E4, G4)
sp.play("pad", ["C4", "E4", "G4"], duration=2.0)

print("Playing C major chord!")`,

    melody: `import sprechstimme as sp

# Create a synthesizer for the melody
sp.new("lead")
sp.create("lead", wavetype=sp.waves.sawtooth)

# Play a simple melody (C major scale)
notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]

for note in notes:
    sp.play("lead", note, duration=0.3)

print("Melody complete!")`,

    synthesis: `import sprechstimme as sp

# Create a synthesizer with sawtooth wave
sp.new("synth")
sp.create("synth", wavetype=sp.waves.sawtooth)

# Play A4 (440 Hz)
sp.play("synth", "A4", duration=1.0)

print("Playing sawtooth wave at A4 (440 Hz)")`,

    arpeggio: `import sprechstimme as sp

# Create synthesizer
sp.new("arp")
sp.create("arp", wavetype=sp.waves.triangle)

# C major arpeggio pattern
arpeggio = ["C4", "E4", "G4", "C5", "G4", "E4", "C4"]

for note in arpeggio:
    sp.play("arp", note, duration=0.2)

print("Arpeggio complete!")`,

    sequence: `import sprechstimme as sp

# Create a synthesizer
sp.new("seq")
sp.create("seq", wavetype=sp.waves.square)

# Musical sequence with varying durations
sequence = [
    ("C4", 0.4),
    ("E4", 0.4),
    ("G4", 0.4),
    ("C5", 0.8),
]

print("Playing sequence...")
for note, duration in sequence:
    sp.play("seq", note, duration=duration)

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
