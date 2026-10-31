(() => {
    'use strict';

    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const hudBerries = document.getElementById('hud-berries');
    const hudCrystals = document.getElementById('hud-crystals');
    const hudNuts = document.getElementById('hud-nuts');
    const hudLives = document.getElementById('hud-lives');
    const hudPortal = document.getElementById('hud-portal');
    const winScreen = document.getElementById('win-screen');
    const winStats = document.getElementById('win-stats');
    const btnBackMap = document.getElementById('btn-back-map');

    let viewW = window.innerWidth;
    let viewH = window.innerHeight;
    let camX = 0, camY = 0;
    let portalOpen = false;

    function resize() {
        viewW = window.innerWidth;
        viewH = window.innerHeight;
        canvas.width = viewW;
        canvas.height = viewH;
    }
    window.addEventListener('resize', resize);
    resize();

    function updateHUD() {
        const s = Level.state.collected;
        if (hudBerries) hudBerries.textContent = `${s.berries} / ${Level.state.totalBerries}`;
        if (hudCrystals) hudCrystals.textContent = `${s.crystals} / ${Level.state.totalCrystals}`;
        if (hudNuts) hudNuts.textContent = `${s.nuts} / ${Level.state.totalNuts}`;
        if (hudLives) hudLives.textContent = '❤️'.repeat(Math.max(0, Player.state.lives));

        portalOpen = Level.isPortalOpen();
        if (hudPortal) {
            hudPortal.textContent = portalOpen ? 'ОТКРЫТ' : 'ЗАКРЫТ';
            hudPortal.style.color = portalOpen ? '#00e676' : '#ff7088';
        }
    }

    function checkPickup() {
        const p = Player.state;
        const T = Level.tileSize;
        const gx = Math.floor((p.x + Player.PHYS.W / 2) / T);
        const gy = Math.floor((p.y + Player.PHYS.H / 2) / T);

        const result = Level.collectAt(gx, gy);
        if (!result) return;

        updateHUD();

        if (result.type === 'berry') {
            if (window.Audio) Audio.play(880, 0.1, 'sine', 0.06);
            if (window.Particles) Particles.spawn(gx * T + T / 2, gy * T + T / 2, '#ff5070', 10, 4);
        } else if (result.type === 'crystal') {
            if (window.Audio) Audio.play(1046, 0.15, 'triangle', 0.07);
            if (window.Particles) Particles.spawn(gx * T + T / 2, gy * T + T / 2, '#a8d8ff', 14, 5);
        } else if (result.type === 'nut') {
            p.hasNut = true;
            if (window.Audio) Audio.play(660, 0.2, 'triangle', 0.1);
            if (window.Particles) Particles.spawn(gx * T + T / 2, gy * T + T / 2, '#ffcc33', 16, 5);
        }
    }

    function checkPortal() {
        if (!portalOpen) return;
        const p = Player.state;
        const portal = Level.portal;

        const cx = p.x + Player.PHYS.W / 2;
        const cy = p.y + Player.PHYS.H / 2;
        const portalCX = portal.x + portal.w / 2;
        const portalCY = portal.y + portal.h / 2;

        const dx = (cx - portalCX) / (portal.w / 2);
        const dy = (cy - portalCY) / (portal.h / 2);
        const inPortal = (dx * dx + dy * dy) <= 1;

        if (inPortal && p.hasNut) {
            winLevel();
        }
    }

    function winLevel() {
        window.__gameActive = false;

        const s = Level.state.collected;
        if (winStats) {
            winStats.innerHTML = `
                <div class="stat-row"><span>🍓 Ягоды</span><b>${s.berries} / ${Level.state.totalBerries}</b></div>
                <div class="stat-row"><span>💎 Кристаллы</span><b>${s.crystals} / ${Level.state.totalCrystals}</b></div>
                <div class="stat-row"><span>🌰 Орехи</span><b>${s.nuts} / ${Level.state.totalNuts}</b></div>
            `;
        }

        if (winScreen) {
            winScreen.classList.add('visible');
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    if (window.Particles) {
                        const px = Level.portal.x + Level.portal.w / 2;
                        const py = Level.portal.y + Level.portal.h / 2;
                        Particles.spawn(px, py, ['#a8d8ff', '#ffcc33', '#88ffcc'][i % 3], 20, 6);
                    }
                }, i * 100);
            }
        }

        if (window.Audio) {
            setTimeout(() => Audio.play(523, 0.2, 'sine', 0.08), 0);
            setTimeout(() => Audio.play(659, 0.2, 'sine', 0.08), 150);
            setTimeout(() => Audio.play(784, 0.2, 'sine', 0.08), 300);
            setTimeout(() => Audio.play(1046, 0.4, 'sine', 0.1), 450);
        }
    }

    // ─── Настройки ────────────────────────────────────────
    const settings = { centerMap: true, followPlayer: false };
    try {
        const saved = JSON.parse(localStorage.getItem('kz_settings') || '{}');
        if (typeof saved.centerMap === 'boolean') settings.centerMap = saved.centerMap;
        if (typeof saved.followPlayer === 'boolean') settings.followPlayer = saved.followPlayer;
    } catch (e) {}

    function updateCamera() {
        if (settings.centerMap) {
            camX = (Level.pixelWidth() - viewW) / 2;
            camY = (Level.pixelHeight() - viewH) / 2;
            return;
        }
        if (settings.followPlayer) {
            const p = Player.state;
            const targetX = p.x + Player.PHYS.W / 2 - viewW / 2;
            const targetY = p.y + Player.PHYS.H / 2 - viewH / 2;
            camX += (targetX - camX) * 0.1;
            camY += (targetY - camY) * 0.1;
            const maxX = Math.max(0, Level.pixelWidth() - viewW);
            const maxY = Math.max(0, Level.pixelHeight() - viewH);
            camX = Math.max(0, Math.min(maxX, camX));
            camY = Math.max(0, Math.min(maxY, camY));
        }
    }

    function loop() {
        if (window.__gameActive === false) return;

        Player.update();
        checkPickup();
        checkPortal();
        updateCamera();
        Tiles.updateParticles();

        Tiles.drawBackground(ctx, viewW, viewH, camX, camY);

        const offsetX = (viewW - Level.pixelWidth()) / 2;
        const offsetY = (viewH - Level.pixelHeight()) / 2;

        ctx.save();
        ctx.translate(-camX + offsetX, -camY + offsetY);

        Tiles.drawLevel(ctx, camX, camY, viewW, viewH);
        Tiles.drawParticles(ctx);
        Player.draw(ctx);

        ctx.restore();

        requestAnimationFrame(loop);
    }

    function start() {
        window.__gameActive = true;

        document.addEventListener('click', () => {
            if (window.Audio) Audio.init();
        }, { once: true });

        Level.load('level1.json').then(() => {
            Player.state.x = Level.playerStart.x;
            Player.state.y = Level.playerStart.y;
            Player.state.vx = 0;
            Player.state.vy = 0;
            Player.state.hasNut = false;
            Player.state.lives = Player.state.maxLives;
            Player.bindKeys();

            camX = (Level.pixelWidth() - viewW) / 2;
            camY = (Level.pixelHeight() - viewH) / 2;

            updateHUD();
            loop();
        }).catch(err => {
            console.error('Ошибка загрузки уровня:', err);
            ctx.fillStyle = '#ff7088';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Не удалось загрузить уровень', viewW / 2, viewH / 2);
        });
    }

    if (btnBackMap) {
        btnBackMap.addEventListener('click', () => {
            location.href = 'map.html';
        });
    }

    start();
})();