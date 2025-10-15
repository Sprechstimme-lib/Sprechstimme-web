const bgCanvas = document.getElementById('waveform-bg');
const bgCtx = bgCanvas.getContext('2d');

function resizeCanvas() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let time = 0;
const waves = [
    { amplitude: 80, frequency: 0.002, phase: 0, color: 'rgba(99, 102, 241, 0.3)' },
    { amplitude: 60, frequency: 0.003, phase: Math.PI / 3, color: 'rgba(59, 130, 246, 0.3)' },
    { amplitude: 100, frequency: 0.0015, phase: Math.PI / 2, color: 'rgba(6, 182, 212, 0.3)' }
];

function drawWave(wave, offset) {
    bgCtx.beginPath();
    bgCtx.strokeStyle = wave.color;
    bgCtx.lineWidth = 2;

    for (let x = 0; x < bgCanvas.width; x++) {
        const y = bgCanvas.height / 2 +
            Math.sin(x * wave.frequency + time + wave.phase) * wave.amplitude +
            offset;

        if (x === 0) {
            bgCtx.moveTo(x, y);
        } else {
            bgCtx.lineTo(x, y);
        }
    }

    bgCtx.stroke();
}

function animateBackground() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    waves.forEach((wave, index) => {
        const offset = (index - 1) * 100;
        drawWave(wave, offset);
    });
    time += 0.02;
    requestAnimationFrame(animateBackground);
}

animateBackground();

window.addEventListener('scroll', () => {
    const scrollProgress = document.querySelector('.scroll-progress');
    const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (window.scrollY / windowHeight) * 100;
    scrollProgress.style.width = scrolled + '%';
});

const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    if (window.pageYOffset > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || !href) return;

        e.preventDefault();
        const target = document.querySelector(href);

        if (target) {
            const offsetTop = target.offsetTop - 100;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });

            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            if (this.classList.contains('nav-link')) {
                this.classList.add('active');
            }
        }
    });
});

document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
        const textToCopy = this.getAttribute('data-copy');
        try {
            await navigator.clipboard.writeText(textToCopy);
            const originalText = this.textContent;
            this.textContent = 'Copied!';
            this.classList.add('copied');
            setTimeout(() => {
                this.textContent = originalText;
                this.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    });
});

document.querySelectorAll('.nav-group-title').forEach(button => {
    button.addEventListener('click', function() {
        const content = this.nextElementSibling;
        const isActive = this.classList.contains('active');

        if (isActive) {
            this.classList.remove('active');
            content.classList.remove('show');
        } else {
            document.querySelectorAll('.nav-group-title').forEach(btn => {
                btn.classList.remove('active');
                if (btn.nextElementSibling) {
                    btn.nextElementSibling.classList.remove('show');
                }
            });
            this.classList.add('active');
            content.classList.add('show');
        }
    });
});

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

document.querySelectorAll('.feature-card, .example-card').forEach(el => {
    scrollObserver.observe(el);
});

let audioContext;
let oscillator;
let gainNode;
let isPlaying = false;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

const waveformCanvas = document.getElementById('waveform-canvas');
const waveformCtx = waveformCanvas.getContext('2d');
const freqSlider = document.getElementById('frequency');
const freqValue = document.getElementById('freq-value');
const durationSlider = document.getElementById('duration');
const durationValue = document.getElementById('duration-value');
const waveformSelect = document.getElementById('waveform-type');
const playButton = document.getElementById('play-sound');

function resizeWaveformCanvas() {
    const container = waveformCanvas.parentElement;
    waveformCanvas.width = container.clientWidth - 40;
    waveformCanvas.height = 300;
    drawWaveform();
}

resizeWaveformCanvas();
window.addEventListener('resize', resizeWaveformCanvas);

freqSlider.addEventListener('input', function() {
    freqValue.textContent = this.value;
    drawWaveform();
});

durationSlider.addEventListener('input', function() {
    durationValue.textContent = this.value;
});

waveformSelect.addEventListener('change', drawWaveform);

function drawWaveform() {
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    const centerY = height / 2;
    const amplitude = height / 3;
    const waveformType = waveformSelect.value;

    waveformCtx.clearRect(0, 0, width, height);

    waveformCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    waveformCtx.lineWidth = 1;

    for (let i = 0; i < 5; i++) {
        const y = (height / 4) * i;
        waveformCtx.beginPath();
        waveformCtx.moveTo(0, y);
        waveformCtx.lineTo(width, y);
        waveformCtx.stroke();
    }

    waveformCtx.strokeStyle = '#06b6d4';
    waveformCtx.lineWidth = 2;
    waveformCtx.beginPath();

    for (let x = 0; x < width; x++) {
        let y;
        const t = x / width * Math.PI * 4;

        switch(waveformType) {
            case 'sine':
                y = centerY + Math.sin(t) * amplitude;
                break;
            case 'square':
                y = centerY + (Math.sin(t) >= 0 ? amplitude : -amplitude);
                break;
            case 'sawtooth':
                y = centerY + ((t % (Math.PI * 2)) / (Math.PI * 2) * 2 - 1) * amplitude;
                break;
            case 'triangle':
                const mod = t % (Math.PI * 2);
                if (mod < Math.PI) {
                    y = centerY + (mod / Math.PI * 2 - 1) * amplitude;
                } else {
                    y = centerY + (3 - mod / Math.PI * 2) * amplitude;
                }
                break;
        }

        if (x === 0) {
            waveformCtx.moveTo(x, y);
        } else {
            waveformCtx.lineTo(x, y);
        }
    }

    waveformCtx.stroke();

    waveformCtx.fillStyle = '#a0a0b0';
    waveformCtx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    waveformCtx.fillText(`${freqSlider.value} Hz ${waveformType} wave`, 20, 30);
}

playButton.addEventListener('click', function() {
    if (isPlaying) {
        if (oscillator) {
            oscillator.stop();
            oscillator.disconnect();
            gainNode.disconnect();
            isPlaying = false;
            playButton.textContent = 'Play Sound';
            playButton.style.background = '';
        }
        return;
    }

    initAudio();

    const frequency = parseFloat(freqSlider.value);
    const duration = parseFloat(durationSlider.value);
    const waveformType = waveformSelect.value;

    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();

    oscillator.type = waveformType;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + duration - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);

    isPlaying = true;
    playButton.textContent = 'Stop Sound';
    playButton.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';

    oscillator.onended = () => {
        isPlaying = false;
        playButton.textContent = 'Play Sound';
        playButton.style.background = '';
    };
});

drawWaveform();

const sections = document.querySelectorAll('section[id]');

function updateActiveNav() {
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');

        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${sectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}

window.addEventListener('scroll', updateActiveNav);
