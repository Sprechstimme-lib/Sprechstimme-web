// Background waveform animation
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
    { amplitude: 80, frequency: 0.002, phase: 0, color: 'rgba(99, 102, 241, 0.25)' },
    { amplitude: 60, frequency: 0.003, phase: Math.PI / 3, color: 'rgba(59, 130, 246, 0.25)' },
    { amplitude: 100, frequency: 0.0015, phase: Math.PI / 2, color: 'rgba(6, 182, 212, 0.25)' }
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
    time += 0.015;
    requestAnimationFrame(animateBackground);
}

animateBackground();

// Scroll progress indicator
window.addEventListener('scroll', () => {
    const scrollProgress = document.querySelector('.scroll-progress');
    const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (window.scrollY / windowHeight) * 100;
    scrollProgress.style.width = scrolled + '%';
});

// Navbar scroll effect
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    if (window.pageYOffset > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Smooth scrolling for anchor links
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

// Copy to clipboard functionality
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

// Intersection Observer for scroll animations
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

// Mini waveform visualizations in synthesis section
const miniWaveforms = document.querySelectorAll('.mini-waveform');

function drawMiniWaveform(canvas, type) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const amplitude = height / 3;

    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        const y = (height / 2) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw waveform
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
        let y;
        const t = x / width * Math.PI * 3;

        switch(type) {
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
            case 'fm':
                // FM synthesis simulation
                const carrier = Math.sin(t * 2);
                const modulator = Math.sin(t * 5);
                y = centerY + Math.sin(t * 2 + modulator * 2) * amplitude;
                break;
            case 'wavetable':
                // Wavetable morphing simulation
                const wave1 = Math.sin(t);
                const wave2 = Math.sin(t * 2);
                const morph = (Math.sin(t / 2) + 1) / 2;
                y = centerY + (wave1 * (1 - morph) + wave2 * morph) * amplitude;
                break;
            case 'noise':
                // Noise visualization
                y = centerY + (Math.random() * 2 - 1) * amplitude * 0.6;
                break;
            default:
                y = centerY + Math.sin(t) * amplitude;
        }

        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.stroke();
}

function initMiniWaveforms() {
    miniWaveforms.forEach(canvas => {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth - 40;
        canvas.height = 140;

        const type = canvas.getAttribute('data-type');
        drawMiniWaveform(canvas, type);
    });
}

if (miniWaveforms.length > 0) {
    initMiniWaveforms();
    window.addEventListener('resize', initMiniWaveforms);
}

// Active navigation based on scroll position
const sections = document.querySelectorAll('section[id]');

function updateActiveNav() {
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 150;
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

// Add smooth reveal animation to cards on scroll
const revealCards = () => {
    const cards = document.querySelectorAll('.feature-card, .example-card, .analysis-card, .synthesis-card, .doc-card');

    cards.forEach(card => {
        const cardTop = card.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;

        if (cardTop < windowHeight - 100) {
            card.classList.add('visible');
        }
    });
};

window.addEventListener('scroll', revealCards);
window.addEventListener('load', revealCards);

// Parallax effect for hero section
const hero = document.querySelector('.hero');
if (hero) {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const heroContent = hero.querySelector('.hero-content');
        if (heroContent && scrolled < window.innerHeight) {
            heroContent.style.transform = `translateY(${scrolled * 0.3}px)`;
            heroContent.style.opacity = 1 - (scrolled / window.innerHeight) * 0.5;
        }
    });
}

// Add hover effect to stats
const statItems = document.querySelectorAll('.stat-item');
statItems.forEach(item => {
    item.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.1)';
        this.style.transition = 'transform 0.3s ease';
    });

    item.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
    });
});

// Animate stats numbers on scroll
const animateStats = () => {
    const statsBar = document.querySelector('.stats-bar');
    if (!statsBar) return;

    const statsTop = statsBar.getBoundingClientRect().top;
    const windowHeight = window.innerHeight;

    if (statsTop < windowHeight - 100) {
        statsBar.classList.add('stats-animated');
    }
};

window.addEventListener('scroll', animateStats);
window.addEventListener('load', animateStats);

// Enhanced button hover effects
const buttons = document.querySelectorAll('.btn');
buttons.forEach(button => {
    button.addEventListener('mousemove', (e) => {
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        button.style.setProperty('--mouse-x', `${x}px`);
        button.style.setProperty('--mouse-y', `${y}px`);
    });
});

// Smooth fade-in for images and media
const mediaElements = document.querySelectorAll('img, video, canvas');
mediaElements.forEach(element => {
    element.style.opacity = '0';
    element.style.transition = 'opacity 0.5s ease';

    if (element.complete || element.tagName === 'CANVAS') {
        element.style.opacity = '1';
    } else {
        element.addEventListener('load', () => {
            element.style.opacity = '1';
        });
    }
});

// Add ripple effect to copy buttons
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        this.appendChild(ripple);

        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';

        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});

// Log loaded message
console.log('%c🎵 Sprechstimme', 'font-size: 24px; font-weight: bold; color: #6366f1;');
console.log('%cProfessional Python Music Synthesis Library', 'font-size: 14px; color: #06b6d4;');
console.log('%cVisit: https://github.com/Sprechstimme-lib/Sprechstimme', 'font-size: 12px; color: #a8a8c0;');
