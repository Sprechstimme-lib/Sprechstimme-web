// Hero Waveform Animation
const heroCanvas = document.getElementById('hero-wave');
if (heroCanvas) {
    const ctx = heroCanvas.getContext('2d');

    function resizeHeroCanvas() {
        const parent = heroCanvas.parentElement;
        heroCanvas.width = parent.clientWidth - 64;
        heroCanvas.height = parent.clientHeight - 64;
    }

    resizeHeroCanvas();
    window.addEventListener('resize', resizeHeroCanvas);

    let phase = 0;

    function drawHeroWaveform() {
        const width = heroCanvas.width;
        const height = heroCanvas.height;
        const centerY = height / 2;
        const amplitude = height / 3;

        ctx.clearRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = '#E8DCC8';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw waveform
        ctx.beginPath();
        ctx.strokeStyle = '#D17B47';
        ctx.lineWidth = 3;

        for (let x = 0; x < width; x++) {
            const t = (x / width) * Math.PI * 4 + phase;
            const y = centerY + Math.sin(t) * amplitude * 0.8;

            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        phase += 0.02;
        requestAnimationFrame(drawHeroWaveform);
    }

    drawHeroWaveform();
}

// Tab Switching
const tabButtons = document.querySelectorAll('.tab-btn');
const examplePanels = document.querySelectorAll('.example-panel');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');

        // Update buttons
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update panels
        examplePanels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.getAttribute('data-panel') === targetTab) {
                panel.classList.add('active');
            }
        });
    });
});

// Copy to Clipboard
function copyToClipboard(button) {
    const textToCopy = button.getAttribute('data-copy');
    const decodedText = textToCopy.replace(/&#10;/g, '\n');

    navigator.clipboard.writeText(decodedText).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('copied');

        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Install copy button
const installCopyBtn = document.querySelector('.install-copy');
if (installCopyBtn) {
    installCopyBtn.addEventListener('click', function() {
        copyToClipboard(this);
    });
}

// Code example copy buttons
const copyCodeButtons = document.querySelectorAll('.copy-code');
copyCodeButtons.forEach(button => {
    button.addEventListener('click', function() {
        copyToClipboard(this);
    });
});

// Smooth Scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
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
        }
    });
});

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const fadeInObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Animate capability cards on scroll
const capabilityCards = document.querySelectorAll('.capability-card');
capabilityCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
    fadeInObserver.observe(card);
});

// Animate doc cards on scroll
const docCards = document.querySelectorAll('.doc-card');
docCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
    fadeInObserver.observe(card);
});

// Stat box hover effects
const statBoxes = document.querySelectorAll('.stat-box');
statBoxes.forEach(box => {
    box.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-8px) scale(1.05)';
    });

    box.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// Feature pill animations
const featurePills = document.querySelectorAll('.feature-pill');
featurePills.forEach((pill, index) => {
    pill.style.opacity = '0';
    pill.style.transform = 'scale(0.8)';
    pill.style.transition = `opacity 0.4s ease ${index * 0.05}s, transform 0.4s ease ${index * 0.05}s`;
});

const pillObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'scale(1)';
        }
    });
}, { threshold: 0.5 });

featurePills.forEach(pill => pillObserver.observe(pill));

// Console welcome message
console.log('%c🎵 Sprechstimme', 'font-size: 24px; font-weight: bold; color: #D17B47;');
console.log('%cProfessional Python Music Synthesis', 'font-size: 14px; color: #7D6E57;');
console.log('%cVisit: https://github.com/Sprechstimme-lib/Sprechstimme', 'font-size: 12px; color: #6B5D4F;');
