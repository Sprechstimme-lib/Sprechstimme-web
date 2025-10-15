// Animated Background Waveform
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

// Navbar Scroll Effect
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
});

// Smooth Navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || !href) return;

        e.preventDefault();
        const target = document.querySelector(href);

        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });

            // Update active nav link
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            if (this.classList.contains('nav-link')) {
                this.classList.add('active');
            }
        }
    });
});

// Copy to Clipboard
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

// Documentation Sidebar Navigation
document.querySelectorAll('.nav-group-title').forEach(button => {
    button.addEventListener('click', function() {
        const content = this.nextElementSibling;
        const isActive = this.classList.contains('active');

        // Close all other groups
        document.querySelectorAll('.nav-group-title').forEach(btn => {
            btn.classList.remove('active');
            if (btn.nextElementSibling) {
                btn.nextElementSibling.classList.add('hidden');
            }
        });

        // Toggle current group
        if (!isActive) {
            this.classList.add('active');
            content.classList.remove('hidden');
        }
    });
});

// Interactive Demo - Web Audio API
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

// Set canvas size
function resizeWaveformCanvas() {
    const container = waveformCanvas.parentElement;
    waveformCanvas.width = container.clientWidth - 40;
    waveformCanvas.height = 300;
    drawWaveform();
}

resizeWaveformCanvas();
window.addEventListener('resize', resizeWaveformCanvas);

// Update frequency display
freqSlider.addEventListener('input', function() {
    freqValue.textContent = this.value;
    drawWaveform();
});

// Update duration display
durationSlider.addEventListener('input', function() {
    durationValue.textContent = this.value;
});

// Update waveform visualization
waveformSelect.addEventListener('change', drawWaveform);

function drawWaveform() {
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    const centerY = height / 2;
    const amplitude = height / 3;
    const frequency = parseFloat(freqSlider.value) / 1000;
    const waveformType = waveformSelect.value;

    waveformCtx.clearRect(0, 0, width, height);

    // Draw grid
    waveformCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    waveformCtx.lineWidth = 1;

    for (let i = 0; i < 5; i++) {
        const y = (height / 4) * i;
        waveformCtx.beginPath();
        waveformCtx.moveTo(0, y);
        waveformCtx.lineTo(width, y);
        waveformCtx.stroke();
    }

    // Draw center line
    waveformCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    waveformCtx.beginPath();
    waveformCtx.moveTo(0, centerY);
    waveformCtx.lineTo(width, centerY);
    waveformCtx.stroke();

    // Draw waveform
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

    // Draw frequency label
    waveformCtx.fillStyle = '#a0a0b0';
    waveformCtx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    waveformCtx.fillText(`${freqSlider.value} Hz ${waveformType} wave`, 20, 30);
}

// Play sound
playButton.addEventListener('click', function() {
    if (isPlaying) {
        stopSound();
        return;
    }

    initAudio();

    const frequency = parseFloat(freqSlider.value);
    const duration = parseFloat(durationSlider.value);
    const waveformType = waveformSelect.value;

    // Create oscillator
    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();

    oscillator.type = waveformType;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    // Envelope for smooth start/stop
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

    // Animate waveform during playback
    animatePlayback(duration);

    oscillator.onended = () => {
        isPlaying = false;
        playButton.textContent = 'Play Sound';
        playButton.style.background = '';
    };
});

function stopSound() {
    if (oscillator) {
        oscillator.stop();
        oscillator.disconnect();
        gainNode.disconnect();
        isPlaying = false;
        playButton.textContent = 'Play Sound';
        playButton.style.background = '';
    }
}

function animatePlayback(duration) {
    const startTime = Date.now();

    function animate() {
        if (!isPlaying) return;

        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);

        // Draw progress bar
        const width = waveformCanvas.width;
        const height = waveformCanvas.height;

        drawWaveform();

        // Progress overlay
        waveformCtx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        waveformCtx.fillRect(0, 0, width * progress, height);

        // Progress line
        waveformCtx.strokeStyle = '#6366f1';
        waveformCtx.lineWidth = 2;
        waveformCtx.beginPath();
        waveformCtx.moveTo(width * progress, 0);
        waveformCtx.lineTo(width * progress, height);
        waveformCtx.stroke();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            drawWaveform();
        }
    }

    animate();
}

// Initial waveform draw
drawWaveform();

// Enhanced Intersection Observer for Scroll Animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

let animatedCount = 0;

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            animatedCount++;

            // Get element description
            const className = entry.target.className.split(' ')[0];
            if (typeof updateDebug === 'function') {
                updateDebug(`✅ Animated ${animatedCount} elements<br>Latest: ${className}`);
            }

            // Optional: Unobserve after animation
            // scrollObserver.unobserve(entry.target);
        }
    });
}, observerOptions);

// Add scroll animations to elements
function initScrollAnimations() {
    console.log('Initializing scroll animations...');

    // Feature cards with staggered animation
    const featureCards = document.querySelectorAll('.feature-card');
    console.log('Found feature cards:', featureCards.length);
    featureCards.forEach((card, index) => {
        card.classList.add('fade-in', `stagger-${(index % 6) + 1}`);
        scrollObserver.observe(card);
    });

    // Example cards alternating animation
    const exampleCards = document.querySelectorAll('.example-card');
    console.log('Found example cards:', exampleCards.length);
    exampleCards.forEach((card, index) => {
        if (index % 2 === 0) {
            card.classList.add('fade-in-left');
        } else {
            card.classList.add('fade-in-right');
        }
        scrollObserver.observe(card);
    });

    // API items with slide up animation
    const apiItems = document.querySelectorAll('.api-item');
    console.log('Found API items:', apiItems.length);
    apiItems.forEach(item => {
        item.classList.add('slide-up');
        scrollObserver.observe(item);
    });

    // Section titles with scale animation
    const sectionTitles = document.querySelectorAll('.section-title');
    console.log('Found section titles:', sectionTitles.length);
    sectionTitles.forEach(title => {
        title.classList.add('scale-in');
        scrollObserver.observe(title);
    });

    // Doc sections
    const docSections = document.querySelectorAll('.doc-section');
    console.log('Found doc sections:', docSections.length);
    docSections.forEach(section => {
        section.classList.add('fade-in');
        scrollObserver.observe(section);
    });

    // CTA buttons
    const ctaButtons = document.querySelectorAll('.cta-buttons .btn');
    console.log('Found CTA buttons:', ctaButtons.length);
    ctaButtons.forEach((btn, index) => {
        btn.classList.add('scale-in', `stagger-${index + 1}`);
        scrollObserver.observe(btn);
    });

    // Quick install box
    const quickInstall = document.querySelector('.quick-install');
    if (quickInstall) {
        quickInstall.classList.add('scale-in');
        scrollObserver.observe(quickInstall);
    }

    // Demo container
    const demoContainer = document.querySelector('.demo-container');
    if (demoContainer) {
        demoContainer.classList.add('fade-in');
        scrollObserver.observe(demoContainer);
    }

    console.log('Scroll animations initialized!');
}

// Debug panel for animations
function createDebugPanel() {
    const debug = document.createElement('div');
    debug.id = 'animation-debug';
    debug.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(99, 102, 241, 0.9);
        color: white;
        padding: 15px;
        border-radius: 10px;
        font-family: monospace;
        font-size: 12px;
        z-index: 10000;
        max-width: 300px;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: transform 0.3s ease;
    `;
    debug.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-weight: bold;">🎬 Animation Debug</span>
            <button id="debug-toggle" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 11px;">Hide</button>
        </div>
        <div id="debug-content" style="transition: all 0.3s ease;">Initializing...</div>
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
            <button id="trigger-all" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 11px; font-weight: bold;">✨ Trigger All Animations</button>
        </div>
    `;
    document.body.appendChild(debug);

    // Toggle functionality
    let isExpanded = true;
    const toggleBtn = document.getElementById('debug-toggle');
    const content = document.getElementById('debug-content');

    toggleBtn.addEventListener('click', () => {
        isExpanded = !isExpanded;
        if (isExpanded) {
            content.style.maxHeight = '200px';
            content.style.opacity = '1';
            toggleBtn.textContent = 'Hide';
        } else {
            content.style.maxHeight = '0';
            content.style.opacity = '0';
            toggleBtn.textContent = 'Show';
        }
    });

    // Trigger all animations button
    document.getElementById('trigger-all').addEventListener('click', () => {
        document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right, .scale-in, .slide-up').forEach(el => {
            el.classList.add('visible');
        });
        updateDebug('✅ All animations triggered manually!');
    });

    return debug;
}

const debugPanel = createDebugPanel();
const debugContent = document.getElementById('debug-content');

function updateDebug(message) {
    const timestamp = new Date().toLocaleTimeString();
    debugContent.innerHTML = `${timestamp}<br>${message}`;
    console.log(`[Animation Debug] ${message}`);
}

// Initialize animations when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        updateDebug('DOM Loaded, initializing animations...');
        initScrollAnimations();
    });
} else {
    updateDebug('DOM Ready, initializing animations...');
    initScrollAnimations();
}

// Update active nav based on scroll position
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

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Space to play/stop demo
    if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        playButton.click();
    }

    // ESC to stop sound
    if (e.code === 'Escape' && isPlaying) {
        stopSound();
    }
});

// Scroll Progress Bar
function createScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.classList.add('scroll-progress');
    document.body.prepend(progressBar);

    window.addEventListener('scroll', () => {
        const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (window.scrollY / windowHeight) * 100;
        progressBar.style.width = scrolled + '%';
    });
}

createScrollProgress();

// Mouse parallax effect on hero section with enhanced smoothness
const hero = document.querySelector('.hero');
const heroContent = document.querySelector('.hero-content');
let mouseX = 0.5;
let mouseY = 0.5;
let currentX = 0;
let currentY = 0;

if (hero && heroContent) {
    hero.addEventListener('mousemove', (e) => {
        mouseX = e.clientX / window.innerWidth;
        mouseY = e.clientY / window.innerHeight;
    });

    // Smooth parallax animation
    function animateParallax() {
        currentX += (mouseX - currentX) * 0.05;
        currentY += (mouseY - currentY) * 0.05;

        const moveX = (currentX - 0.5) * 30;
        const moveY = (currentY - 0.5) * 30;

        heroContent.style.transform = `translate(${moveX}px, ${moveY}px)`;

        requestAnimationFrame(animateParallax);
    }

    animateParallax();
}

// Parallax effect for sections
const parallaxSections = document.querySelectorAll('.features, .demo-section, .examples-section');
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;

    parallaxSections.forEach((section, index) => {
        const offset = section.offsetTop;
        const speed = 0.5;
        const yPos = -(scrolled - offset) * speed;

        if (scrolled > offset - window.innerHeight && scrolled < offset + section.offsetHeight) {
            section.style.backgroundPosition = `center ${yPos}px`;
        }
    });
});

// Add smooth hover effects to buttons
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mouseenter', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement('span');
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');

        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    });
});

// Easter egg: Konami code
let konamiCode = [];
const konamiPattern = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.key);
    konamiCode = konamiCode.slice(-10);

    if (konamiCode.join(',') === konamiPattern.join(',')) {
        // Play a special chord
        initAudio();
        const notes = [261.63, 329.63, 392.00]; // C, E, G
        notes.forEach((freq, i) => {
            setTimeout(() => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.frequency.setValueAtTime(freq, audioContext.currentTime);
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.1, audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start();
                osc.stop(audioContext.currentTime + 1);
            }, i * 100);
        });

        // Visual effect
        document.body.style.animation = 'rainbow 2s ease';
        setTimeout(() => {
            document.body.style.animation = '';
        }, 2000);
    }
});

// Animate numbers on scroll (for potential stats section)
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        element.textContent = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Add tilt effect to feature cards
document.querySelectorAll('.feature-card, .example-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
    });
});

// Animated gradient for hero title
const heroTitle = document.querySelector('.gradient-text');
if (heroTitle) {
    let hue = 0;
    setInterval(() => {
        hue = (hue + 1) % 360;
        heroTitle.style.filter = `hue-rotate(${hue}deg)`;
    }, 50);
}

// Smooth reveal animation for code blocks on scroll
const codeBlocks = document.querySelectorAll('.code-example');
const codeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '0';
            setTimeout(() => {
                entry.target.style.transition = 'opacity 0.8s ease';
                entry.target.style.opacity = '1';
            }, 100);
        }
    });
}, { threshold: 0.2 });

codeBlocks.forEach(block => {
    codeObserver.observe(block);
});

// Add floating animation to feature icons
document.querySelectorAll('.feature-icon').forEach((icon, index) => {
    icon.style.animationDelay = `${index * 0.2}s`;
    icon.classList.add('float');
});

// Smooth scroll with offset for fixed navbar
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || !href) return;

        e.preventDefault();
        const target = document.querySelector(href);

        if (target) {
            const offsetTop = target.offsetTop - 80;

            // Custom smooth scroll with easing
            const startPos = window.pageYOffset;
            const distance = offsetTop - startPos;
            const duration = 800;
            let startTime = null;

            function easeInOutCubic(t) {
                return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            }

            function animation(currentTime) {
                if (startTime === null) startTime = currentTime;
                const timeElapsed = currentTime - startTime;
                const progress = Math.min(timeElapsed / duration, 1);
                const ease = easeInOutCubic(progress);

                window.scrollTo(0, startPos + distance * ease);

                if (timeElapsed < duration) {
                    requestAnimationFrame(animation);
                }
            }

            requestAnimationFrame(animation);

            // Update active nav link
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            if (this.classList.contains('nav-link')) {
                this.classList.add('active');
            }
        }
    });
});

// Add shine effect to CTA buttons
document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.classList.add('shine-effect');
});

// Enhanced navbar hide/show on scroll
let lastScrollTop = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > lastScrollTop && scrollTop > 100) {
        // Scrolling down
        navbar.style.transform = 'translateY(-100%)';
    } else {
        // Scrolling up
        navbar.style.transform = 'translateY(0)';
    }

    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
}, false);

// Add glow effect to important elements
document.querySelectorAll('.quick-install, .btn-primary').forEach(el => {
    el.classList.add('glow-on-hover');
});

// Cursor trail effect
const cursorTrail = [];
const trailLength = 5;

document.addEventListener('mousemove', (e) => {
    cursorTrail.push({ x: e.clientX, y: e.clientY, time: Date.now() });

    if (cursorTrail.length > trailLength) {
        cursorTrail.shift();
    }
});

// Typing effect for hero subtitle (on load)
window.addEventListener('load', () => {
    const subtitle = document.querySelector('.hero-subtitle');
    if (subtitle) {
        const text = subtitle.textContent;
        subtitle.textContent = '';
        subtitle.style.opacity = '1';

        let i = 0;
        const typeWriter = () => {
            if (i < text.length) {
                subtitle.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 30);
            }
        };

        setTimeout(typeWriter, 500);
    }
});

// Add particle effect to background
function createParticles() {
    const canvas = document.getElementById('waveform-bg');
    const ctx = canvas.getContext('2d');
    const particles = [];

    for (let i = 0; i < 30; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 2 + 1,
            vx: Math.random() * 0.5 - 0.25,
            vy: Math.random() * 0.5 - 0.25,
            alpha: Math.random() * 0.5 + 0.2
        });
    }

    function animateParticles() {
        particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;

            if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(99, 102, 241, ${particle.alpha})`;
            ctx.fill();
        });
    }

    // Add particles to existing animation
    const originalAnimate = animateBackground;
    animateBackground = function() {
        originalAnimate();
        animateParticles();
    };
}

setTimeout(createParticles, 1000);

console.log('%c♪ Sprechstimme ♪', 'font-size: 24px; color: #6366f1; font-weight: bold;');
console.log('%cCreate beautiful music with code!', 'font-size: 14px; color: #06b6d4;');
console.log('%cTry the Konami code for a surprise... ↑↑↓↓←→←→BA', 'font-size: 12px; color: #a0a0b0;');
