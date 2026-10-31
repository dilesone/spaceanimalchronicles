(() => {
    'use strict';

    // ═══════════ ЗВЁЗДЫ ═══════════
    const starsContainer = document.getElementById('stars');
    if (starsContainer) {
        for (let i = 0; i < 400; i++) {
            const s = document.createElement('div');
            s.className = 'star';
            const size = Math.random() * 2.4 + 0.4;
            s.style.width = size + 'px';
            s.style.height = size + 'px';
            s.style.left = Math.random() * 100 + '%';
            s.style.top = Math.random() * 100 + '%';
            s.style.animationDelay = (Math.random() * 3) + 's';
            s.style.animationDuration = (2 + Math.random() * 4) + 's';
            s.style.background = Math.random() < 0.2 ? '#a8c8ff' : (Math.random() < 0.1 ? '#d0e0ff' : '#fff');
            s.style.boxShadow = `0 0 ${size * 2.5}px rgba(255,255,255,0.7)`;
            starsContainer.appendChild(s);
        }
    }

    // ═══════════ ЗВЁЗДЫ ЛОГОТИПА ═══════════
    const logoContainer = document.getElementById('logoContainer');
    if (logoContainer) {
        const starPositions = [
            { top: '-15%', left: '-15%', size: '24px' },
            { top: '30%', right: '-15%', size: '18px', delay: '0.5s' },
            { bottom: '-5%', left: '20%', size: '14px', delay: '1s' },
            { bottom: '20%', right: '10%', size: '28px', delay: '1.5s' }
        ];
        starPositions.forEach(pos => {
            const star = document.createElement('div');
            star.className = 'logo-star';
            star.style.fontSize = pos.size;
            if (pos.top) star.style.top = pos.top;
            if (pos.left) star.style.left = pos.left;
            if (pos.right) star.style.right = pos.right;
            if (pos.bottom) star.style.bottom = pos.bottom;
            if (pos.delay) star.style.animationDelay = pos.delay;
            logoContainer.appendChild(star);
        });
    }

    // ═══════════ БУКВЫ ЛОГОТИПА ═══════════
    function makeLetters(text, containerId, replaceO = false) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        for (const char of text) {
            if (replaceO && char === 'О') {
                const span = document.createElement('span');
                span.className = 'logo-letter planet-o';
                container.appendChild(span);
            } else {
                const span = document.createElement('span');
                span.className = 'logo-letter';
                span.textContent = char;
                container.appendChild(span);
            }
        }
    }
    makeLetters("ХРОНИКИ", "line1", false);
    makeLetters("ЗВЕРЬКОВ", "line2", true);

    // ═══════════ ПАРАЛЛАКС ═══════════
    const parallaxLayers = document.querySelectorAll('.parallax-layer');
    let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
    document.addEventListener('mousemove', (e) => {
        targetX = (e.clientX / window.innerWidth - 0.5) * 2;
        targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    function animateParallax() {
        mouseX += (targetX - mouseX) * 0.05;
        mouseY += (targetY - mouseY) * 0.05;
        parallaxLayers.forEach(layer => {
            const speed = parseFloat(layer.dataset.speed) || 0;
            layer.style.transform = `translate(${mouseX * speed * 40}px, ${mouseY * speed * 20}px)`;
        });
        requestAnimationFrame(animateParallax);
    }
    animateParallax();

    // ═══════════ КОМЕТЫ ═══════════
    const cometContainer = document.getElementById('comet-container');
    if (cometContainer) {
        function spawnComet() {
            const comet = document.createElement('div');
            comet.className = 'comet';
            const angle = Math.random() * Math.PI * 2;
            const angleDeg = angle * 180 / Math.PI;
            const edge = Math.random();
            let startX, startY;
            if (edge < 0.25)      { startX = Math.random() * 100; startY = -10; }
            else if (edge < 0.5)  { startX = 110; startY = Math.random() * 100; }
            else if (edge < 0.75) { startX = Math.random() * 100; startY = 110; }
            else                  { startX = -10; startY = Math.random() * 100; }
            comet.style.left = startX + '%';
            comet.style.top = startY + '%';
            comet.style.transform = `rotate(${angleDeg + 45}deg)`;
            const size = 4 + Math.random() * 6;
            comet.style.width = size + 'px';
            comet.style.height = size + 'px';
            const duration = 2.5 + Math.random() * 3.5;
            comet.style.animationDuration = duration + 's';
            cometContainer.appendChild(comet);
            setTimeout(() => comet.remove(), duration * 1000);
            setTimeout(spawnComet, 1500 + Math.random() * 2500);
        }
        setTimeout(spawnComet, 1000);
    }

    // ═══════════ ОБВОДКА-КРУГ ДЛЯ .menu-item ═══════════
    document.querySelectorAll('.menu-item').forEach(btn => {
        if (!btn.querySelector('.circle')) {
            const circle = document.createElement('span');
            circle.className = 'circle';
            circle.innerHTML = `<svg viewBox="0 0 240 70" preserveAspectRatio="none">
                <path d="M 120 8 C 60 4, 10 22, 12 40 C 14 58, 70 68, 120 64 C 180 60, 232 46, 228 30 C 224 14, 170 6, 110 12 C 80 16, 56 22, 50 30" />
            </svg>`;
            btn.appendChild(circle);
        }

        btn.addEventListener('mouseenter', () => {
            document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        btn.addEventListener('focus', () => {
            document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // ═══════════ КНОПКА "ВЫЙТИ" ═══════════
    document.querySelectorAll('[data-action="quit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Покинуть Космос?')) window.close();
        });
    });

    // ═══════════ КНОПКА "УБЕЖИЩЕ" ═══════════
    document.querySelectorAll('[data-action="sanctuary"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Убежище (в разработке)');
        });
    });
})();