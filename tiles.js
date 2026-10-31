(() => {
    'use strict';

    // ─── Частицы ──────────────────────────────────────────
    const particles = [];

    function spawnParticles(x, y, color, count = 8, speed = 3) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * speed + 1;
            particles.push({
                x, y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s - 1,
                life: 1,
                color,
                size: Math.random() * 4 + 2
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.vx *= 0.96;
            p.life -= 0.025;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles(ctx) {
        for (const p of particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ─── Звёзды фона ──────────────────────────────────────
    const stars = [];
    for (let i = 0; i < 400; i++) {
        stars.push({
            x: Math.random(),
            y: Math.random(),
            size: Math.random() * 2.4 + 0.4,
            speed: 0.1 + Math.random() * 0.25,
            twinkle: Math.random() * 10,
            color: Math.random() < 0.2 ? '#a8c8ff' : (Math.random() < 0.1 ? '#d0e0ff' : '#fff')
        });
    }

    // ─── Палитры для тем ──────────────────────────────────
    const THEMES = {
        forest: {
            wall: '#3a2a1a', wallDark: '#2a1a0a',
            grass: '#2a5a2a', grassLight: '#3a8a3a',
            platform: '#7acc4a', platformDark: '#2d5a2d',
            water: 'rgba(60, 140, 180, 0.7)',
            spike: '#c84a4a'
        },
        desert: {
            wall: '#8a6a3a', wallDark: '#5a3a1a',
            grass: '#c8a860', grassLight: '#e0c080',
            platform: '#d4a060', platformDark: '#6a4a2a',
            water: 'rgba(80, 180, 220, 0.7)',
            spike: '#c84a4a'
        },
        mountains: {
            wall: '#5a6a7a', wallDark: '#3a4a5a',
            grass: '#8a9aaa', grassLight: '#b8c8d8',
            platform: '#8a9aaa', platformDark: '#3a4a5a',
            water: 'rgba(140, 200, 240, 0.7)',
            spike: '#cc5555'
        },
        dungeon: {
            wall: '#2a1a3a', wallDark: '#1a0a2a',
            grass: '#4a2a5a', grassLight: '#6a3a7a',
            platform: '#5a3a7a', platformDark: '#2a1a3a',
            water: 'rgba(80, 40, 120, 0.7)',
            spike: '#cc88ff'
        }
    };

    function getTheme() {
        return THEMES[Level.state.theme] || THEMES.forest;
    }

    // ─── Тайлы ────────────────────────────────────────────
    function drawWall(ctx, x, y, T, theme, showGrass) {
        ctx.fillStyle = theme.wall;
        ctx.fillRect(x, y, T, T);
        ctx.strokeStyle = theme.wallDark;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);

        if (showGrass) {
            ctx.fillStyle = theme.grass;
            ctx.fillRect(x, y, T, 8);

            ctx.strokeStyle = theme.grassLight;
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(x + 8 + i * 12, y + 2);
                ctx.lineTo(x + 12 + i * 12, y - 6);
                ctx.stroke();
            }
        }
    }

    function drawPlatform(ctx, x, y, T, theme) {
        ctx.fillStyle = theme.platform;
        ctx.fillRect(x, y + 8, T, T / 3);
        ctx.strokeStyle = theme.platformDark;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 8.5, T - 1, T / 3 - 1);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(x + 2, y + 9, T - 4, 2);

        ctx.strokeStyle = theme.grassLight;
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            ctx.moveTo(x + 12 + i * 16, y + 8);
            ctx.lineTo(x + 16 + i * 16, y);
            ctx.stroke();
        }
    }

    function drawBerry(ctx, x, y, T, gx, gy) {
        const bob = Math.sin(performance.now() * 0.004 + gx + gy) * 3;
        const cx = x + T / 2;
        const cy = y + T / 2 + bob;

        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
        glow.addColorStop(0, 'rgba(255, 100, 150, 0.5)');
        glow.addColorStop(1, 'rgba(255, 100, 150, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e8305a';
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx - 6, cy - 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 6, cy - 2, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(cx - 4, cy - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2a8a2a';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 10, 5, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawCrystal(ctx, x, y, T, gx, gy) {
        const bob = Math.sin(performance.now() * 0.005 + gx * 1.3 + gy) * 4;
        const cx = x + T / 2;
        const cy = y + T / 2 + bob;

        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
        glow.addColorStop(0, 'rgba(168, 220, 255, 0.7)');
        glow.addColorStop(1, 'rgba(168, 220, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, 28, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#a8d8ff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx + 10, cy - 2);
        ctx.lineTo(cx + 8, cy + 10);
        ctx.lineTo(cx, cy + 14);
        ctx.lineTo(cx - 8, cy + 10);
        ctx.lineTo(cx - 10, cy - 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(80, 130, 200, 0.6)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx + 10, cy - 2);
        ctx.lineTo(cx, cy + 14);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy - 8);
        ctx.lineTo(cx + 1, cy - 5);
        ctx.lineTo(cx - 1, cy - 1);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(60, 100, 160, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx + 10, cy - 2);
        ctx.lineTo(cx + 8, cy + 10);
        ctx.lineTo(cx, cy + 14);
        ctx.lineTo(cx - 8, cy + 10);
        ctx.lineTo(cx - 10, cy - 2);
        ctx.closePath();
        ctx.stroke();
    }

    function drawNut(ctx, x, y, T, gx, gy) {
        const bob = Math.sin(performance.now() * 0.004 + gx * 0.9 + gy * 0.7) * 3;
        const cx = x + T / 2;
        const cy = y + T / 2 + bob;

        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
        glow.addColorStop(0, 'rgba(255, 200, 100, 0.6)');
        glow.addColorStop(1, 'rgba(255, 200, 100, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#8b5a2b';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 3, 12, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#5a3a1b';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 8, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(60, 30, 10, 0.5)';
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.arc(cx, cy + 3 + i * 3, 10, 0.3, Math.PI - 0.3);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255, 220, 180, 0.7)';
        ctx.beginPath();
        ctx.ellipse(cx - 4, cy - 2, 3, 4, -0.5, 0, Math.PI * 2);
        ctx.fill();

        const now = performance.now() * 0.003;
        const pulse = Math.sin(now) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 200, ${0.5 + pulse * 0.5})`;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', cx + 14, cy - 14);
    }

    function drawSpike(ctx, x, y, T, theme) {
        ctx.fillStyle = theme.spike;
        for (let s = 0; s < 4; s++) {
            const sx = x + s * (T / 4);
            ctx.beginPath();
            ctx.moveTo(sx, y + T);
            ctx.lineTo(sx + T / 8, y + T / 3);
            ctx.lineTo(sx + T / 4, y + T);
            ctx.closePath();
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (let s = 0; s < 4; s++) {
            const sx = x + s * (T / 4);
            ctx.beginPath();
            ctx.moveTo(sx + T / 8, y + T / 3);
            ctx.lineTo(sx + T / 12, y + T / 2);
            ctx.lineTo(sx + T / 6, y + T / 2);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawWater(ctx, x, y, T, theme, gx, gy, grid) {
        const now = performance.now() * 0.002;
        const isTop = gy > 0 && grid[gy - 1][gx] !== Level.TILE.WATER;

        const grad = ctx.createLinearGradient(x, y, x, y + T);
        grad.addColorStop(0, theme.water);
        grad.addColorStop(1, 'rgba(20, 50, 100, 0.85)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, T, T);

        if (isTop) {
            const wave = Math.sin(now + gx * 0.5) * 3;
            ctx.fillStyle = 'rgba(200, 240, 255, 0.6)';
            ctx.fillRect(x, y + wave, T, 3);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(x + T * 0.3 + Math.sin(now * 2 + gx) * 4, y + wave + 6, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawPortal(ctx, x, y, w, h, isOpen) {
        const now = performance.now() * 0.002;
        const cx = x + w / 2;
        const cy = y + h / 2;

        const glowRadius = w * 1.5;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        if (isOpen) {
            glow.addColorStop(0, 'rgba(100, 255, 200, 0.7)');
            glow.addColorStop(0.5, 'rgba(60, 200, 255, 0.3)');
            glow.addColorStop(1, 'rgba(60, 200, 255, 0)');
        } else {
            glow.addColorStop(0, 'rgba(100, 100, 120, 0.4)');
            glow.addColorStop(1, 'rgba(100, 100, 120, 0)');
        }
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        const pulse = isOpen ? 1 + Math.sin(now * 2) * 0.05 : 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(pulse, pulse);

        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
        if (isOpen) {
            coreGrad.addColorStop(0, '#0a2a3a');
            coreGrad.addColorStop(0.7, '#1a4a5a');
            coreGrad.addColorStop(1, '#2a6a7a');
        } else {
            coreGrad.addColorStop(0, '#1a1a2a');
            coreGrad.addColorStop(1, '#2a2a3a');
        }
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isOpen ? '#88ffcc' : '#4a4a5a';
        ctx.lineWidth = 4;
        ctx.shadowColor = isOpen ? '#88ffcc' : '#4a4a5a';
        ctx.shadowBlur = isOpen ? 20 : 0;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (isOpen) {
            for (let i = 0; i < 6; i++) {
                const angle = now * 2 + i * Math.PI / 3;
                const r = w * 0.3;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r * 1.2;
                ctx.fillStyle = `rgba(150, 255, 220, ${0.6 + Math.sin(now * 3 + i) * 0.4})`;
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();

        if (!isOpen) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔒', cx, cy);
        }
    }

    // ─── Отрисовка уровня ─────────────────────────────────
    function drawLevel(ctx, camX, camY, viewW, viewH) {
        const T = Level.tileSize;
        const W = Level.width;
        const H = Level.height;
        const grid = Level.grid;
        const theme = getTheme();

        const startCol = Math.max(0, Math.floor(camX / T) - 1);
        const endCol = Math.min(W, Math.ceil((camX + viewW) / T) + 1);
        const startRow = Math.max(0, Math.floor(camY / T) - 1);
        const endRow = Math.min(H, Math.ceil((camY + viewH) / T) + 1);

        for (let gy = startRow; gy < endRow; gy++) {
            for (let gx = startCol; gx < endCol; gx++) {
                const tile = grid[gy][gx];
                if (tile === Level.TILE.EMPTY) continue;

                const x = gx * T;
                const y = gy * T;

                switch (tile) {
                    case Level.TILE.WALL: {
                        const showGrass = gy > 0 && grid[gy - 1][gx] !== Level.TILE.WALL;
                        drawWall(ctx, x, y, T, theme, showGrass);
                        break;
                    }
                    case Level.TILE.PLATFORM:
                        drawPlatform(ctx, x, y, T, theme);
                        break;
                    case Level.TILE.BERRY:
                        drawBerry(ctx, x, y, T, gx, gy);
                        break;
                    case Level.TILE.CRYSTAL:
                        drawCrystal(ctx, x, y, T, gx, gy);
                        break;
                    case Level.TILE.NUT:
                        drawNut(ctx, x, y, T, gx, gy);
                        break;
                    case Level.TILE.SPIKE:
                        drawSpike(ctx, x, y, T, theme);
                        break;
                    case Level.TILE.WATER:
                        drawWater(ctx, x, y, T, theme, gx, gy, grid);
                        break;
                }
            }
        }

        const portal = Level.portal;
        drawPortal(ctx, portal.x, portal.y, portal.w, portal.h, Level.isPortalOpen());
    }

    // ─── Отрисовка фона ───────────────────────────────────
    function drawBackground(ctx, viewW, viewH, camX, camY) {
        const grad = ctx.createLinearGradient(0, 0, 0, viewH);
        grad.addColorStop(0, '#010206');
        grad.addColorStop(0.5, '#030610');
        grad.addColorStop(1, '#060a18');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, viewW, viewH);

        const topGrad = ctx.createRadialGradient(viewW / 2, 0, 0, viewW / 2, 0, viewH * 0.8);
        topGrad.addColorStop(0, 'rgba(50, 150, 255, 0.15)');
        topGrad.addColorStop(1, 'rgba(50, 150, 255, 0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, viewW, viewH * 0.8);

        const botGrad = ctx.createRadialGradient(viewW / 2, viewH, 0, viewW / 2, viewH, viewH * 0.8);
        botGrad.addColorStop(0, 'rgba(40, 230, 200, 0.12)');
        botGrad.addColorStop(1, 'rgba(40, 230, 200, 0)');
        ctx.fillStyle = botGrad;
        ctx.fillRect(0, viewH * 0.2, viewW, viewH * 0.8);

        const now = performance.now() * 0.003;
        for (const s of stars) {
            const sx = ((s.x * viewW - camX * s.speed) % viewW + viewW) % viewW;
            const sy = ((s.y * viewH - camY * s.speed) % viewH + viewH) % viewH;
            const twinkle = Math.sin(now + s.twinkle) * 0.5 + 0.5;

            ctx.globalAlpha = 0.2 + twinkle * 0.8;
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ─── Публичный API ────────────────────────────────────
    window.Tiles = {
        drawBackground,
        drawLevel,
        drawParticles,
        spawnParticles,
        updateParticles
    };

    window.Particles = {
        spawn: spawnParticles,
        update: updateParticles,
        draw: drawParticles
    };
})();